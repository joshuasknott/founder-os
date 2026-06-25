import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { recordAuditEvent } from "./audit";
import { requireWorkerToken, workerActor } from "./authz";
import {
  canLeaseRun,
  failRunState,
  finishRunPatch,
  leaseIsValid,
  leaseRunPatch,
  localRoutingForRun,
  normalizePlainWorkerMessage,
  runnerCanHandleRouting,
  type LocalRunRouting,
  type WorkRunKind,
} from "./taskRuntime";
import {
  localRunnerHeartbeatPatch,
  localRunnerIsAlive,
  localRunnerOfflinePatch,
} from "./localRunnerRuntime";
import { saveRunOutputToLibrary } from "./workRuns";
import { taskDependenciesAreComplete } from "./workflowRuntime";

const localRunnerCapability = v.union(
  v.literal("coding"),
  v.literal("debugging"),
  v.literal("document"),
  v.literal("design"),
  v.literal("communication"),
  v.literal("schedule"),
  v.literal("data"),
  v.literal("generic"),
  v.literal("business_reasoning"),
  v.literal("product_marketing_docs"),
  v.literal("planning"),
);

const localRunnerSensitivity = v.union(
  v.literal("public"),
  v.literal("low"),
  v.literal("internal"),
  v.literal("confidential"),
  v.literal("restricted"),
);

const localRunnerOutputContract = v.union(
  v.literal("plain_text"),
  v.literal("structured_json"),
  v.literal("library_item"),
  v.literal("code_changes"),
  v.literal("public_draft"),
);

const sensitiveActionKind = v.union(
  v.literal("publish_preview"),
  v.literal("send_email"),
  v.literal("create_calendar_event"),
  v.literal("post_externally"),
  v.literal("spend_money"),
  v.literal("delete_data"),
  v.literal("change_live_asset"),
  v.literal("generic"),
);

const updateTone = v.union(
  v.literal("info"),
  v.literal("progress"),
  v.literal("review"),
  v.literal("blocked"),
  v.literal("complete"),
  v.literal("error"),
);

const founderCompletionStatus = v.union(
  v.literal("needs review"),
  v.literal("needs approval"),
  v.literal("done"),
);

const allWorkRunKinds: WorkRunKind[] = [
  "code_preview",
  "document",
  "design",
  "email",
  "schedule",
  "data_update",
  "generic",
];

async function runnerById(ctx: MutationCtx, runnerId: string) {
  return await ctx.db
    .query("localRunners")
    .withIndex("by_runner_id", (q) => q.eq("runnerId", runnerId))
    .first();
}

async function routingForRun(
  ctx: MutationCtx,
  run: Doc<"workRuns">,
): Promise<LocalRunRouting> {
  if (run.localRouting) return run.localRouting;

  const directive = await ctx.db.get(run.directiveId);
  return localRoutingForRun({
    kind: run.kind,
    title: run.title,
    objective: directive?.objective,
    classification: run.classification,
  });
}

async function markAttemptExhausted(ctx: MutationCtx, run: Doc<"workRuns">, now: number) {
  const failure = failRunState(run, {
    now,
    retryable: false,
    failureReason: "FounderOS could not finish this after several tries.",
  });

  await ctx.db.patch(run._id, failure.patch);
  if (run.taskId) {
    await ctx.db.patch(run.taskId, {
      status: "failed",
      failureReason: failure.patch.failureReason,
      retryDelayMs: undefined,
      nextRetryAt: undefined,
      failedAt: now,
      updatedAt: now,
    });
  }
  await ctx.db.insert("workRunUpdates", {
    runId: run._id,
    message: failure.updateMessage,
    tone: failure.updateTone,
    createdAt: now,
  });
}

async function markDirectiveCompleteIfAllTasksDone(ctx: MutationCtx, run: Doc<"workRuns">) {
  const directive = await ctx.db.get(run.directiveId);
  if (!directive || directive.status === "completed") return;

  const allTasks = await ctx.db
    .query("tasks")
    .withIndex("by_directive", (q) => q.eq("directiveId", run.directiveId))
    .collect();
  const allDone = allTasks.every((task) => task.status === "completed" || task.status === "failed");
  if (allDone) {
    await ctx.db.patch(run.directiveId, { status: "completed" });
  }
}

async function markDirectiveBlockedIfAllTasksTerminal(ctx: MutationCtx, run: Doc<"workRuns">) {
  const directive = await ctx.db.get(run.directiveId);
  if (!directive || directive.status === "completed" || directive.status === "blocked") return;

  const allTasks = await ctx.db
    .query("tasks")
    .withIndex("by_directive", (q) => q.eq("directiveId", run.directiveId))
    .collect();
  const allTerminal = allTasks.every((task) => task.status === "completed" || task.status === "failed");
  if (allTerminal) {
    await ctx.db.patch(run.directiveId, { status: "blocked" });
  }
}

export const register = mutation({
  args: {
    runnerId: v.string(),
    name: v.optional(v.string()),
    capabilities: v.array(localRunnerCapability),
    outputContracts: v.array(localRunnerOutputContract),
    maxSensitivity: localRunnerSensitivity,
    approvalCapabilities: v.array(sensitiveActionKind),
    heartbeatTtlMs: v.optional(v.number()),
    opencodeReady: v.optional(v.boolean()),
    opencodeSafeMessage: v.optional(v.string()),
    processId: v.optional(v.number()),
    version: v.optional(v.string()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const now = Date.now();
    const heartbeat = localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs });
    const existing = await runnerById(ctx, args.runnerId);
    const patch = {
      runnerId: args.runnerId,
      name: args.name,
      capabilities: args.capabilities,
      outputContracts: args.outputContracts,
      maxSensitivity: args.maxSensitivity,
      approvalCapabilities: args.approvalCapabilities,
      opencodeReady: args.opencodeReady,
      opencodeSafeMessage: args.opencodeSafeMessage,
      processId: args.processId,
      version: args.version,
      lastSafeMessage: "Local runner is ready.",
      startedAt: now,
      stoppedAt: undefined,
      ...heartbeat,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { ...existing, ...patch };
    }

    const runnerDbId = await ctx.db.insert("localRunners", {
      ...patch,
      status: "online",
      leaseCount: 0,
      completedCount: 0,
      failedCount: 0,
      createdAt: now,
    });
    return await ctx.db.get(runnerDbId);
  },
});

export const heartbeat = mutation({
  args: {
    runnerId: v.string(),
    heartbeatTtlMs: v.optional(v.number()),
    capabilities: v.optional(v.array(localRunnerCapability)),
    outputContracts: v.optional(v.array(localRunnerOutputContract)),
    maxSensitivity: v.optional(localRunnerSensitivity),
    approvalCapabilities: v.optional(v.array(sensitiveActionKind)),
    currentRunId: v.optional(v.id("workRuns")),
    lastSafeMessage: v.optional(v.string()),
    opencodeReady: v.optional(v.boolean()),
    opencodeSafeMessage: v.optional(v.string()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const runner = await runnerById(ctx, args.runnerId);
    if (!runner) throw new Error("Local runner is not registered.");

    const now = Date.now();
    await ctx.db.patch(runner._id, {
      ...localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs }),
      ...(args.capabilities ? { capabilities: args.capabilities } : {}),
      ...(args.outputContracts ? { outputContracts: args.outputContracts } : {}),
      ...(args.maxSensitivity ? { maxSensitivity: args.maxSensitivity } : {}),
      ...(args.approvalCapabilities ? { approvalCapabilities: args.approvalCapabilities } : {}),
      currentRunId: args.currentRunId,
      lastSafeMessage: args.lastSafeMessage ?? runner.lastSafeMessage,
      opencodeReady: args.opencodeReady ?? runner.opencodeReady,
      opencodeSafeMessage: args.opencodeSafeMessage ?? runner.opencodeSafeMessage,
    });
  },
});

export const markOffline = mutation({
  args: {
    runnerId: v.string(),
    message: v.optional(v.string()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const runner = await runnerById(ctx, args.runnerId);
    if (!runner) return null;
    const now = Date.now();
    await ctx.db.patch(runner._id, localRunnerOfflinePatch(now, args.message));
    return runner._id;
  },
});

export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("localRunners")
      .withIndex("by_heartbeat", (q) => q.lt("heartbeatExpiresAt", now))
      .take(100);

    for (const runner of expired) {
      if (runner.status === "online") {
        await ctx.db.patch(runner._id, localRunnerOfflinePatch(now));
      }
    }
    return expired.length;
  },
});

export const leaseNext = mutation({
  args: {
    runnerId: v.string(),
    leaseMs: v.optional(v.number()),
    heartbeatTtlMs: v.optional(v.number()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const now = Date.now();
    const runner = await runnerById(ctx, args.runnerId);
    if (!runner) throw new Error("Local runner is not registered.");
    if (!localRunnerIsAlive(runner, now)) {
      await ctx.db.patch(runner._id, localRunnerOfflinePatch(now));
      return null;
    }

    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(50);
    const working = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "working"))
      .order("asc")
      .take(50);

    for (const run of working) {
      const attempts = run.attemptCount ?? 0;
      const maxAttempts = run.maxAttempts ?? 3;
      const leaseExpired = typeof run.leaseExpiresAt === "number" && run.leaseExpiresAt <= now;
      if (leaseExpired && attempts >= maxAttempts) {
        await markAttemptExhausted(ctx, run, now);
      }
    }

    let candidate: Doc<"workRuns"> | null = null;
    let candidateRouting: LocalRunRouting | null = null;
    for (const run of [...queued, ...working]) {
      if (!canLeaseRun(run, allWorkRunKinds, now)) continue;
      if (run.taskId) {
        const task = await ctx.db.get(run.taskId);
        const directiveTasks = await ctx.db
          .query("tasks")
          .withIndex("by_directive", (q) => q.eq("directiveId", run.directiveId))
          .collect();
        const tasksById = new Map(directiveTasks.map((candidateTask) => [String(candidateTask._id), candidateTask]));
        if (!taskDependenciesAreComplete(task, tasksById)) continue;
      }
      const routing = await routingForRun(ctx, run);
      if (
        !runnerCanHandleRouting(
          {
            capabilities: runner.capabilities,
            outputContracts: runner.outputContracts,
            maxSensitivity: runner.maxSensitivity,
            approvalCapabilities: runner.approvalCapabilities,
          },
          routing,
        )
      ) {
        continue;
      }

      candidate = run;
      candidateRouting = routing;
      break;
    }

    const heartbeat = localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs });
    if (!candidate || !candidateRouting) {
      await ctx.db.patch(runner._id, {
        ...heartbeat,
        currentRunId: undefined,
        lastSafeMessage: "Waiting for work.",
      });
      return null;
    }

    const leaseId = `${args.runnerId}:${now}:${Math.random().toString(36).slice(2)}`;
    const patch = leaseRunPatch(candidate, {
      now,
      leaseId,
      leaseOwner: args.runnerId,
      leaseMs: args.leaseMs,
    });

    await ctx.db.patch(candidate._id, {
      ...patch,
      localRunnerId: args.runnerId,
      localRouting: candidateRouting,
    });
    if (candidate.taskId) {
      await ctx.db.patch(candidate.taskId, {
        status: "in_progress",
        executionToken: leaseId,
        retryCount: patch.attemptCount,
        retryDelayMs: undefined,
        nextRetryAt: undefined,
        startedAt: now,
        updatedAt: now,
      });
    }

    const directive = await ctx.db.get(candidate.directiveId);
    if (directive && directive.status === "pending_spec") {
      await ctx.db.patch(candidate.directiveId, { status: "in_progress" });
    }

    await ctx.db.insert("workRunUpdates", {
      runId: candidate._id,
      message:
        patch.attemptCount > 1
          ? "I'm trying this again."
          : normalizePlainWorkerMessage(`Started: ${candidate.title}`),
      tone: "progress",
      createdAt: now,
    });

    await ctx.db.patch(runner._id, {
      ...heartbeat,
      currentRunId: candidate._id,
      leaseCount: (runner.leaseCount ?? 0) + 1,
      lastSafeMessage: "Working.",
    });

    await recordAuditEvent(ctx, {
      ...workerActor(args.runnerId),
      workspaceId: candidate.workspaceId,
      action: "local_runner.leased",
      resourceType: "workRun",
      resourceId: String(candidate._id),
      summary: `Local runner started: ${candidate.title}.`,
      metadata: { leaseId, attemptCount: patch.attemptCount },
    });

    return { ...candidate, ...patch, localRunnerId: args.runnerId, localRouting: candidateRouting };
  },
});

export const progress = mutation({
  args: {
    runnerId: v.string(),
    runId: v.id("workRuns"),
    leaseId: v.optional(v.string()),
    message: v.string(),
    tone: updateTone,
    heartbeatTtlMs: v.optional(v.number()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const runner = await runnerById(ctx, args.runnerId);
    if (!runner) throw new Error("Local runner is not registered.");
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    const now = Date.now();
    if (!leaseIsValid(run, { leaseId: args.leaseId, now })) {
      throw new Error("This work is already being handled.");
    }

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(args.message),
      tone: args.tone,
      createdAt: now,
    });
    await ctx.db.patch(runner._id, {
      ...localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs }),
      currentRunId: args.runId,
      lastSafeMessage: normalizePlainWorkerMessage(args.message),
    });
  },
});

export const complete = mutation({
  args: {
    runnerId: v.string(),
    runId: v.id("workRuns"),
    leaseId: v.optional(v.string()),
    status: founderCompletionStatus,
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    message: v.optional(v.string()),
    metadata: v.optional(v.any()),
    heartbeatTtlMs: v.optional(v.number()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const runner = await runnerById(ctx, args.runnerId);
    if (!runner) throw new Error("Local runner is not registered.");
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (run.status === "completed") return args.runId;
    const now = Date.now();
    if (!leaseIsValid(run, { leaseId: args.leaseId, now })) {
      throw new Error("This work is already being handled.");
    }

    const status =
      args.status === "done"
        ? "completed"
        : args.status === "needs approval"
          ? "waiting_for_approval"
          : "needs_review";
    await ctx.db.patch(args.runId, {
      ...finishRunPatch(status, now),
      summary: args.summary,
      previewUrl: args.previewUrl ?? run.previewUrl,
      internalNotes: args.internalNotes,
      localRunnerId: args.runnerId,
    });

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(
        args.message ??
          (status === "completed"
            ? `Done: ${run.title}`
            : status === "waiting_for_approval"
              ? `Awaiting your approval to continue: ${run.title}`
              : `Ready for your review: ${run.title}`),
      ),
      tone: status === "completed" ? "complete" : status === "waiting_for_approval" ? "blocked" : "review",
      createdAt: now,
    });

    const output = status === "waiting_for_approval"
      ? null
      : await saveRunOutputToLibrary(ctx, run, {
          summary: args.summary,
          content: args.content,
          previewUrl: args.previewUrl,
          metadata: {
            ...((args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata))
              ? args.metadata
              : {}),
            ...(status === "needs_review" ? { needsReview: true } : {}),
          },
        });
    if (status === "completed") {
      await ctx.scheduler.runAfter(0, internal.memory.extractFromCompletedWork, {
        runId: args.runId,
        itemId: output?.itemId,
      });
    }

    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: status === "completed" ? "completed" : "blocked",
        outputItemId: output?.itemId,
        outputDocumentId: output?.documentId,
        completedAt: status === "completed" ? now : undefined,
        updatedAt: now,
      });
    }

    if (status === "completed") {
      await markDirectiveCompleteIfAllTasksDone(ctx, run);
    }

    await ctx.db.patch(runner._id, {
      ...localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs }),
      currentRunId: undefined,
      completedCount: (runner.completedCount ?? 0) + (status === "completed" ? 1 : 0),
      lastSafeMessage: status === "completed" ? "Done." : "Waiting for review.",
    });

    await recordAuditEvent(ctx, {
      ...workerActor(args.runnerId),
      workspaceId: run.workspaceId,
      action: "local_runner.completed",
      resourceType: "workRun",
      resourceId: String(args.runId),
      summary: args.summary ?? normalizePlainWorkerMessage(args.message ?? `Updated: ${run.title}.`),
      metadata: { status: args.status, outputItemId: output?.itemId, outputDocumentId: output?.documentId },
    });

    return args.runId;
  },
});

export const fail = mutation({
  args: {
    runnerId: v.string(),
    runId: v.id("workRuns"),
    leaseId: v.optional(v.string()),
    message: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    internalError: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
    heartbeatTtlMs: v.optional(v.number()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const runner = await runnerById(ctx, args.runnerId);
    if (!runner) throw new Error("Local runner is not registered.");
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (run.status === "completed" || run.status === "stopped") return args.runId;
    const now = Date.now();
    if (!leaseIsValid(run, { leaseId: args.leaseId, now })) {
      throw new Error("This work is already being handled.");
    }

    const failure = failRunState(run, {
      now,
      retryable: args.retryable,
      failureReason: args.failureReason ?? args.message ?? `Could not finish: ${run.title}`,
      internalError: args.internalError,
    });

    await ctx.db.patch(args.runId, {
      ...failure.patch,
      localRunnerId: args.runnerId,
    });
    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: failure.retryScheduled ? "queued" : "failed",
        failureReason: failure.patch.failureReason,
        retryCount: run.attemptCount ?? 0,
        retryDelayMs: failure.patch.retryDelayMs,
        nextRetryAt: failure.patch.nextRetryAt,
        failedAt: failure.retryScheduled ? undefined : now,
        updatedAt: now,
      });
    }

    if (!failure.retryScheduled) {
      await markDirectiveBlockedIfAllTasksTerminal(ctx, run);
    }

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: failure.updateMessage,
      tone: failure.updateTone,
      createdAt: now,
    });

    await ctx.db.patch(runner._id, {
      ...localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs }),
      currentRunId: undefined,
      failedCount: (runner.failedCount ?? 0) + (failure.retryScheduled ? 0 : 1),
      lastSafeMessage: failure.retryScheduled ? "Trying again soon." : failure.updateMessage,
    });

    await recordAuditEvent(ctx, {
      ...workerActor(args.runnerId),
      workspaceId: run.workspaceId,
      action: "local_runner.failed",
      resourceType: "workRun",
      resourceId: String(args.runId),
      summary: failure.patch.failureReason,
      metadata: { retryScheduled: failure.retryScheduled },
    });

    return args.runId;
  },
});

export const getRegistered = query({
  args: {
    runnerId: v.string(),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    return await ctx.db
      .query("localRunners")
      .withIndex("by_runner_id", (q) => q.eq("runnerId", args.runnerId))
      .first();
  },
});
