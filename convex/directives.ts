import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { actorFromIdentity, ensureDocWorkspace, isAuthorizedWorkerToken, requireCurrentUser } from "./authz";
import { recordAuditEvent } from "./audit";
import {
  buildRefinementRunModel,
  classifyTaskObjective,
  normalizePlainWorkerMessage,
  type TaskClassification,
} from "./taskRuntime";
import { normalizeModelProfile } from "./modelProfiles";

function autonomyForClassification(classification: TaskClassification): 1 | 2 | 3 {
  if (classification.workerKind === "builder") return 3;
  if (classification.requiresReview) return 2;
  return 1;
}

async function chooseAssignedAgent(
  ctx: MutationCtx,
  classification: TaskClassification,
  workspaceId: Doc<"users">["workspaceId"],
): Promise<Doc<"agents"> | null> {
  const departments = await ctx.db
    .query("departments")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const agents = (
    await Promise.all(
      departments.map((department) =>
        ctx.db
          .query("agents")
          .withIndex("by_department", (q) => q.eq("departmentId", department._id))
          .collect(),
      ),
    )
  ).flat();
  if (agents.length === 0) return null;

  const preferredRouting: Record<TaskClassification["workerKind"], Array<Doc<"agents">["routingRequest"]>> = {
    builder: ["coding", "reasoning"],
    document: ["long-context", "reasoning", "triage"],
    design: ["creative", "reasoning"],
    communications: ["triage", "creative", "reasoning"],
    generic: ["triage", "reasoning"],
  };

  return (
    agents.find((agent) =>
      preferredRouting[classification.workerKind].includes(agent.routingRequest),
    ) ??
    agents.find((agent) => agent.isActive) ??
    agents[0]
  );
}

export const createDirective = mutation({
  args: {
    title: v.string(),
    objective: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    modelProfile: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.sessionId) {
      const session = await ctx.db.get(args.sessionId);
      ensureDocWorkspace(session, current.workspaceId, "Chat");
    }
    const classification = classifyTaskObjective({
      title: args.title,
      objective: args.objective,
    });
    const modelProfile = normalizeModelProfile(args.modelProfile);
    const assignedAgent = await chooseAssignedAgent(ctx, classification, current.workspaceId);
    const directiveId = await ctx.db.insert("directives", {
      workspaceId: current.workspaceId,
      title: args.title,
      objective: args.objective,
      sessionId: args.sessionId,
      status: "pending_spec",
    });

    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      workspaceId: current.workspaceId,
      directiveId,
      title: args.title,
      description: args.objective,
      ...(assignedAgent ? { assignedAgentId: assignedAgent._id } : {}),
      status: "queued",
      autonomyLevel: autonomyForClassification(classification),
      dependencies: [],
      classification,
      workerKind: classification.workerKind,
      modelProfile,
      retryCount: 0,
      updatedAt: now,
    });

    const runId = await ctx.db.insert("workRuns", {
      workspaceId: current.workspaceId,
      directiveId,
      taskId,
      kind: classification.runKind,
      workerKind: classification.workerKind,
      classification,
      modelProfile,
      status: "queued",
      title: args.title,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("workRunUpdates", {
      runId,
      message: normalizePlainWorkerMessage("I've added this to your workspace and I'm preparing the next step."),
      tone: "info",
      createdAt: now,
    });

    if (args.sessionId) {
      await ctx.db.insert("chatMessages", {
        sessionId: args.sessionId,
        role: "user",
        content: args.objective,
      });

      await ctx.db.insert("chatMessages", {
        sessionId: args.sessionId,
        role: "assistant",
        agentName: "FounderOS",
        content: normalizePlainWorkerMessage("I've added this to your workspace and I'm preparing the next step."),
      });

      await ctx.db.patch(args.sessionId, { lastMessageAt: Date.now() });
    }

    await ctx.scheduler.runAfter(0, internal.telemetry.logEvent, {
      traceId: directiveId,
      actor: "system: Orchestrator",
      eventType: "STATE_TRANSITION" as const,
      rawPayload: {
        directive: args.title,
        transition: "created -> pending_spec",
      },
    });

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "directive.created",
      resourceType: "directive",
      resourceId: String(directiveId),
      summary: `Created task: ${args.title}.`,
      metadata: { taskId, runId, classification },
    });

    return directiveId;
  },
});

export const addClarification = mutation({
  args: {
    directiveId: v.id("directives"),
    content: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const directive = await ctx.db.get(args.directiveId);
    if (!directive) throw new Error("Task not found.");
    ensureDocWorkspace(directive, current.workspaceId, "Task");

    const sessionId = args.sessionId ?? directive.sessionId;
    if (sessionId) {
      const session = await ctx.db.get(sessionId);
      ensureDocWorkspace(session, current.workspaceId, "Chat");
    }
    const classification = classifyTaskObjective({
      title: directive.title,
      objective: `${directive.objective}\n\nFounder requested changes: ${args.content}`,
    });
    const existingTasks = await ctx.db
      .query("tasks")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();
    const modelProfile = normalizeModelProfile(
      existingTasks
        .slice()
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
        .find((task) => task.modelProfile)?.modelProfile,
    );
    const refinement = buildRefinementRunModel({
      title: directive.title,
      objective: directive.objective,
      refinement: args.content,
      classification,
    });
    const assignedAgent = await chooseAssignedAgent(ctx, classification, current.workspaceId);
    const now = Date.now();

    await ctx.db.patch(args.directiveId, {
      objective: refinement.updatedObjective,
      status: "pending_spec",
      ...(sessionId ? { sessionId } : {}),
    });

    const taskId = await ctx.db.insert("tasks", {
      workspaceId: current.workspaceId,
      directiveId: args.directiveId,
      title: refinement.taskTitle,
      description: refinement.description,
      ...(assignedAgent ? { assignedAgentId: assignedAgent._id } : {}),
      status: "queued",
      autonomyLevel: autonomyForClassification(classification),
      dependencies: [],
      classification,
      workerKind: classification.workerKind,
      modelProfile,
      retryCount: 0,
      updatedAt: now,
    });

    const runId = await ctx.db.insert("workRuns", {
      workspaceId: current.workspaceId,
      directiveId: args.directiveId,
      taskId,
      kind: refinement.runKind,
      workerKind: refinement.workerKind,
      classification,
      modelProfile,
      status: "queued",
      title: refinement.title,
      trigger: "chat",
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("workRunUpdates", {
      runId,
      message: normalizePlainWorkerMessage(refinement.message),
      tone: "info",
      createdAt: now,
    });

    if (sessionId) {
      await ctx.db.insert("chatMessages", {
        sessionId,
        role: "user",
        content: args.content,
      });

      await ctx.db.insert("chatMessages", {
        sessionId,
        role: "assistant",
        agentName: "FounderOS",
        content: normalizePlainWorkerMessage(refinement.message),
      });

      await ctx.db.patch(sessionId, { lastMessageAt: Date.now() });
    }

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "directive.clarified",
      resourceType: "directive",
      resourceId: String(args.directiveId),
      summary: `Added clarification to ${directive.title}.`,
      metadata: { taskId, runId, classification },
    });

    return args.directiveId;
  },
});

export const stopDirective = mutation({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const directive = await ctx.db.get(args.directiveId);
    if (!directive) throw new Error("Task not found.");
    ensureDocWorkspace(directive, current.workspaceId, "Task");
    if (directive.status === "completed" || directive.status === "aborted_by_principal") {
      return args.directiveId;
    }

    await ctx.db.patch(args.directiveId, { status: "aborted_by_principal" });

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();

    for (const task of tasks) {
      if (task.status !== "completed" && task.status !== "failed") {
        await ctx.db.patch(task._id, { status: "blocked" });
      }
    }

    const approvals = await ctx.db
      .query("approvalQueue")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();

    for (const approval of approvals) {
      if (approval.status === "pending" || approval.status === "shadow_pending") {
        await ctx.db.patch(approval._id, {
          status: "denied",
          principalSignature: `stopped:${Date.now()}`,
        });
      }
    }

    const workRuns = await ctx.db
      .query("workRuns")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();

    for (const run of workRuns) {
      if (run.status !== "completed" && run.status !== "stopped" && run.status !== "failed") {
        await ctx.db.patch(run._id, {
          status: "stopped",
          leaseId: undefined,
          leaseOwner: undefined,
          leaseExpiresAt: undefined,
          updatedAt: Date.now(),
        });
      }
    }

    if (directive.sessionId) {
      await ctx.db.insert("chatMessages", {
        sessionId: directive.sessionId,
        role: "assistant",
        agentName: "FounderOS",
        content: normalizePlainWorkerMessage(`Stopped: ${directive.title}`),
      });
      await ctx.db.patch(directive.sessionId, { lastMessageAt: Date.now() });
    }

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "directive.stopped",
      resourceType: "directive",
      resourceId: String(args.directiveId),
      summary: `Stopped task: ${directive.title}.`,
    });

    return args.directiveId;
  },
});

export const archiveDirective = mutation({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const directive = ensureDocWorkspace(await ctx.db.get(args.directiveId), current.workspaceId, "Task");
    const now = Date.now();
    await ctx.db.patch(args.directiveId, { archivedAt: now });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "directive.archived",
      resourceType: "directive",
      resourceId: String(args.directiveId),
      summary: `Archived task: ${directive.title}.`,
    });
    return args.directiveId;
  },
});

export const restoreDirective = mutation({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const directive = ensureDocWorkspace(await ctx.db.get(args.directiveId), current.workspaceId, "Task");
    await ctx.db.patch(args.directiveId, { archivedAt: undefined });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "directive.restored",
      resourceType: "directive",
      resourceId: String(args.directiveId),
      summary: `Restored task: ${directive.title}.`,
    });
    return args.directiveId;
  },
});

export const deleteDirective = mutation({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const directive = await ctx.db.get(args.directiveId);
    if (!directive) throw new Error("Task not found.");
    ensureDocWorkspace(directive, current.workspaceId, "Task");

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();

    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    const approvals = await ctx.db
      .query("approvalQueue")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();

    for (const approval of approvals) {
      await ctx.db.delete(approval._id);
    }

    const logs = await ctx.db
      .query("observabilityLogs")
      .withIndex("by_traceId", (q) => q.eq("traceId", args.directiveId))
      .collect();

    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    const workRuns = await ctx.db
      .query("workRuns")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();

    for (const run of workRuns) {
      const updates = await ctx.db
        .query("workRunUpdates")
        .withIndex("by_run", (q) => q.eq("runId", run._id))
        .collect();
      for (const update of updates) {
        await ctx.db.delete(update._id);
      }

      const artifacts = await ctx.db
        .query("workArtifacts")
        .withIndex("by_run", (q) => q.eq("runId", run._id))
        .collect();
      for (const artifact of artifacts) {
        await ctx.db.delete(artifact._id);
      }

      await ctx.db.delete(run._id);
    }

    await ctx.db.delete(args.directiveId);
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "directive.deleted",
      resourceType: "directive",
      resourceId: String(args.directiveId),
      summary: `Deleted task: ${directive.title}.`,
    });
  },
});

export const getActiveDirective = query({
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("directives")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending_spec"),
          q.eq(q.field("status"), "in_progress")
        )
      )
      .order("desc")
      .first();
  },
});

export const getDirectiveById = query({
  args: { directiveId: v.id("directives"), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (isAuthorizedWorkerToken(args.workerToken)) {
      return await ctx.db.get(args.directiveId);
    }
    const { workspaceId } = await requireCurrentUser(ctx);
    return ensureDocWorkspace(await ctx.db.get(args.directiveId), workspaceId, "Task");
  },
});

export const getTasksByDirective = query({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    ensureDocWorkspace(await ctx.db.get(args.directiveId), workspaceId, "Task");
    return await ctx.db
      .query("tasks")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();
  },
});

export const getRecentDirectives = query({
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("directives")
      .withIndex("by_workspace_archived", (q) => q.eq("workspaceId", workspaceId).eq("archivedAt", undefined))
      .order("desc")
      .take(20);
  },
});
