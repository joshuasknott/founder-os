import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  appendItemVersion,
  createItemWithVersion,
  reviewStatusForLibraryOutput,
  selectReusableTraceItem,
} from "./itemModel";
import { appendDeploymentHistory } from "./deploymentRuntime";
import {
  buildRunOutputModel,
  canLeaseRun,
  failRunState,
  finishRunPatch,
  inferLocalSensitivity,
  leaseIsValid,
  leaseRunPatch,
  localRoutingForRun,
  normalizePlainWorkerMessage,
  type FounderVisibleWorkStatus,
  type TaskClassification,
  type WorkRunKind,
} from "./taskRuntime";
import { projectFounderVisibleWorkflowStatus, taskDependenciesAreComplete } from "./workflowRuntime";
import { selectDocumentContextCandidates } from "./documentContextRuntime";
import { actorFromIdentity, ensureDocWorkspace, requireCurrentUser, requireWorkerToken, workerActor } from "./authz";
import { recordAuditEvent } from "./audit";
import { buildMemoryContext } from "./memory";
import { inferMemorySensitivity } from "./memoryModel";

const workRunKind = v.union(
  v.literal("code_preview"),
  v.literal("document"),
  v.literal("design"),
  v.literal("email"),
  v.literal("schedule"),
  v.literal("data_update"),
  v.literal("generic"),
);

const workerKind = v.union(
  v.literal("builder"),
  v.literal("document"),
  v.literal("design"),
  v.literal("communications"),
  v.literal("generic"),
);

const taskCategory = v.union(
  v.literal("build"),
  v.literal("document"),
  v.literal("design"),
  v.literal("communication"),
  v.literal("schedule"),
  v.literal("data"),
  v.literal("generic"),
);

const outputItemKind = v.union(
  v.literal("created_output"),
  v.literal("upload"),
  v.literal("website"),
  v.literal("deck"),
  v.literal("doc"),
  v.literal("email"),
  v.literal("contact"),
  v.literal("company"),
  v.literal("decision"),
  v.literal("research"),
  v.literal("automation"),
  v.literal("tool"),
  v.literal("task_output"),
  v.literal("document"),
  v.literal("file"),
  v.literal("internal_tool"),
  v.literal("presentation"),
  v.literal("conversation"),
  v.literal("record"),
  v.literal("brief"),
  v.literal("plan"),
);

const outputDocumentKind = v.union(
  v.literal("document"),
  v.literal("file"),
  v.literal("website"),
  v.literal("internal_tool"),
  v.literal("tool"),
  v.literal("presentation"),
  v.literal("automation"),
  v.literal("task_output"),
  v.literal("conversation"),
  v.literal("record"),
  v.literal("brief"),
  v.literal("plan"),
);

const taskClassification = v.object({
  category: taskCategory,
  runKind: workRunKind,
  workerKind,
  outputItemKind,
  outputDocumentKind,
  requiresReview: v.boolean(),
  confidence: v.number(),
  signals: v.array(v.string()),
});

type WorkPageStatus = FounderVisibleWorkStatus;

function labelForWorkPage(status: WorkPageStatus) {
  const labels: Record<WorkPageStatus, string> = {
    queued: "Working",
    working: "Working",
    "needs review": "Ready to review",
    "needs approval": "Needs approval",
    done: "Done",
    failed: "Could not finish",
  };

  return labels[status];
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function addResultCardsToChat(
  ctx: MutationCtx,
  run: {
    _id: Id<"workRuns">;
    workspaceId?: Id<"workspaces">;
    directiveId: Id<"directives">;
    resultCardMessageId?: Id<"chatMessages">;
    navigationCardMessageId?: Id<"chatMessages">;
  },
  output: {
    itemId: Id<"items">;
    documentId: Id<"documents">;
    title: string;
    summary: string;
  },
) {
  const directive = await ctx.db.get(run.directiveId);
  if (!directive?.sessionId) return {};

  const messages = await ctx.db
    .query("chatMessages")
    .withIndex("by_session", (q) => q.eq("sessionId", directive.sessionId!))
    .collect();
  const hasResultCard =
    Boolean(run.resultCardMessageId) ||
    messages.some((message) => message.card?.runId === run._id && message.card.type === "task_result");
  const hasNavigationCard =
    Boolean(run.navigationCardMessageId) ||
    messages.some((message) => message.card?.runId === run._id && message.card.type === "item_navigation");

  const patch: {
    resultCardMessageId?: Id<"chatMessages">;
    navigationCardMessageId?: Id<"chatMessages">;
  } = {};

  if (!hasResultCard) {
    patch.resultCardMessageId = await ctx.db.insert("chatMessages", {
      sessionId: directive.sessionId,
      role: "assistant",
      agentName: "FounderOS",
      content: output.summary,
      card: {
        type: "task_result",
        title: "Result ready",
        summary: output.summary,
        runId: run._id,
        directiveId: run.directiveId,
      },
    });
  }

  if (!hasNavigationCard) {
    patch.navigationCardMessageId = await ctx.db.insert("chatMessages", {
      sessionId: directive.sessionId,
      role: "assistant",
      agentName: "FounderOS",
      content: `Saved to Library: ${output.title}`,
      card: {
        type: "item_navigation",
        title: output.title,
        summary: "Open the saved Library item.",
        href: `/library/${output.itemId}`,
        label: "Open Library item",
        itemId: output.itemId,
        documentId: output.documentId,
        runId: run._id,
        directiveId: run.directiveId,
      },
    });
  }

  if (patch.resultCardMessageId || patch.navigationCardMessageId) {
    await ctx.db.patch(directive.sessionId, { lastMessageAt: Date.now() });
  }

  return patch;
}

export async function saveRunOutputToLibrary(
  ctx: MutationCtx,
  run: {
    _id: Id<"workRuns">;
    workspaceId?: Id<"workspaces">;
    directiveId: Id<"directives">;
    kind: WorkRunKind;
    title: string;
    summary?: string;
    previewUrl?: string;
    taskId?: Id<"tasks">;
    classification?: TaskClassification;
    outputItemId?: Id<"items">;
    outputDocumentId?: Id<"documents">;
    resultCardMessageId?: Id<"chatMessages">;
    navigationCardMessageId?: Id<"chatMessages">;
  },
  result?: {
    summary?: string;
    content?: string;
    previewUrl?: string;
    metadata?: unknown;
  },
) {
  const output = buildRunOutputModel(run, result);
  const existingArtifacts = await ctx.db
    .query("workArtifacts")
    .withIndex("by_run", (q) => q.eq("runId", run._id))
    .collect();
  const existingArtifact = existingArtifacts.find(
    (artifact) => artifact.libraryItemId || artifact.libraryDocumentId,
  );

  const task = run.taskId ? await ctx.db.get(run.taskId) : null;
  const assignedAgent = task?.assignedAgentId ? await ctx.db.get(task.assignedAgentId) : null;
  const department = assignedAgent
    ? await ctx.db.get(assignedAgent.departmentId)
    : run.workspaceId
      ? await ctx.db
          .query("departments")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", run.workspaceId))
          .first()
      : null;
  if (!department) return null;

  const now = Date.now();
  let itemId = run.outputItemId ?? existingArtifact?.libraryItemId;
  let documentId = run.outputDocumentId ?? existingArtifact?.libraryDocumentId;
  let itemVersionId: Id<"itemVersions">;
  let documentVersionId: Id<"documentVersions">;
  let createdNewLibraryItem = false;

  if (!itemId) {
    const earlierItems = await ctx.db
      .query("items")
      .withIndex("by_trace", (q) => q.eq("traceId", run.directiveId))
      .collect();
    const earlierItem = selectReusableTraceItem(earlierItems);
    if (earlierItem) {
      itemId = earlierItem._id;
      documentId = earlierItem.legacyDocumentId;
    }
  }

  const existingItem = itemId ? await ctx.db.get(itemId) : null;
  const canUpdateExistingItem =
    existingItem && existingItem.status !== "archived" && existingItem.status !== "deprecated";
  const itemMetadata = appendDeploymentHistory(
    canUpdateExistingItem ? existingItem.metadata : { classification: run.classification },
    result?.metadata,
    now,
  );
  const latestDeploymentHistory = Array.isArray(itemMetadata.deploymentHistory)
    ? itemMetadata.deploymentHistory.at(-1)
    : undefined;
  const reviewStatus = reviewStatusForLibraryOutput(result?.metadata);
  const needsReview = reviewStatus === "under_review";

  if (itemId && canUpdateExistingItem) {
    itemVersionId = await appendItemVersion(ctx, {
      itemId,
      title: output.title,
      summary: output.summary,
      content: output.content,
      format: "markdown",
      sourceUrl: output.previewUrl,
      createdBy: "FounderOS",
      metadata: {
        directiveId: run.directiveId,
        taskId: run.taskId,
        runId: run._id,
        deployment: latestDeploymentHistory,
      },
    });
    await ctx.db.patch(itemId, {
      metadata: itemMetadata,
      ...(needsReview ? { status: "under_review" as const } : {}),
      ...(output.previewUrl ? { sourceUrl: output.previewUrl } : {}),
      updatedAt: now,
    });
  } else {
    const created = await createItemWithVersion(ctx, {
      workspaceId: department.workspaceId,
      departmentId: department._id,
      title: output.title,
      kind: output.itemKind,
      status: reviewStatus,
      source: "agent",
      author: "FounderOS",
      summary: output.summary,
      content: output.content,
      format: "markdown",
      traceId: run.directiveId,
      taskId: run.taskId,
      runId: run._id,
      sourceUrl: output.previewUrl,
      metadata: itemMetadata,
      createdAt: now,
    });
    itemId = created.itemId;
    itemVersionId = created.versionId;
    documentId = undefined;
    createdNewLibraryItem = true;
  }

  const existingDocument = documentId ? await ctx.db.get(documentId) : null;
  if (documentId && existingDocument && !existingDocument.isArchived) {
    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", documentId!))
      .collect();
    const versionNumber = versions.length + 1;
    documentVersionId = await ctx.db.insert("documentVersions", {
      documentId,
      itemVersionId,
      content: output.content,
      versionNumber,
      createdAt: now,
      createdBy: "FounderOS",
      summary: output.summary,
    });
    await ctx.db.patch(documentId, {
      currentVersionId: documentVersionId,
      title: output.title,
      summary: output.summary,
      ...(needsReview ? { status: "under_review" as const } : {}),
      versionCount: versionNumber,
      updatedAt: now,
    });
  } else {
    documentId = await ctx.db.insert("documents", {
      workspaceId: department.workspaceId,
      itemId,
      title: output.title,
      departmentTag: department._id,
      author: "FounderOS",
      traceId: run.directiveId,
      kind: output.documentKind,
      summary: output.summary,
      status: reviewStatus,
      isArchived: false,
      versionCount: 1,
      createdAt: now,
      updatedAt: now,
    });

    documentVersionId = await ctx.db.insert("documentVersions", {
      documentId,
      itemVersionId,
      content: output.content,
      versionNumber: 1,
      createdAt: now,
      createdBy: "FounderOS",
      summary: output.summary,
    });

    await ctx.db.patch(documentId, { currentVersionId: documentVersionId });
    await ctx.db.patch(itemId, { legacyDocumentId: documentId });
  }

  await ctx.db.patch(itemVersionId, { legacyDocumentVersionId: documentVersionId });
  await ctx.scheduler.runAfter(0, internal.memory.extractFromItem, { itemId, versionId: itemVersionId });

  const artifactPatch = {
    title: output.title,
    kind: output.artifactKind,
    summary: output.summary,
    url: output.previewUrl,
    libraryItemId: itemId,
    libraryDocumentId: documentId,
    metadata: result?.metadata,
  };
  const artifactId = existingArtifact
    ? existingArtifact._id
    : await ctx.db.insert("workArtifacts", {
        runId: run._id,
        directiveId: run.directiveId,
        ...artifactPatch,
        createdAt: now,
      });

  if (existingArtifact) {
    await ctx.db.patch(existingArtifact._id, artifactPatch);
  }

  const chatPatch = await addResultCardsToChat(ctx, run, {
    itemId,
    documentId,
    summary: output.summary,
    title: output.title,
  });

  await ctx.db.patch(run._id, {
    outputItemId: itemId,
    outputDocumentId: documentId,
    ...chatPatch,
    updatedAt: now,
  });

  if (run.taskId) {
    await ctx.db.patch(run.taskId, {
      outputItemId: itemId,
      outputDocumentId: documentId,
      updatedAt: now,
    });
  }

  await ctx.db.insert("workRunUpdates", {
    runId: run._id,
    message: createdNewLibraryItem ? "Saved to Library." : "Updated in Library.",
    tone: "complete",
    createdAt: now,
  });

  return { itemId, documentId, artifactId, itemVersionId, documentVersionId };
}

export const create = mutation({
  args: {
    directiveId: v.id("directives"),
    taskId: v.optional(v.id("tasks")),
    kind: workRunKind,
    workerKind: v.optional(workerKind),
    classification: v.optional(taskClassification),
    title: v.string(),
    summary: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const directive = await ctx.db.get(args.directiveId);
    if (!directive) throw new Error("Task not found.");
    ensureDocWorkspace(directive, current.workspaceId, "Task");
    if (args.taskId) {
      ensureDocWorkspace(await ctx.db.get(args.taskId), current.workspaceId, "Task step");
    }

    const now = Date.now();
    const localRouting = localRoutingForRun({
      kind: args.kind,
      title: args.title,
      objective: directive.objective,
      classification: args.classification,
    });
    const runId = await ctx.db.insert("workRuns", {
      workspaceId: current.workspaceId,
      directiveId: args.directiveId,
      taskId: args.taskId,
      kind: args.kind,
      workerKind: args.workerKind,
      classification: args.classification,
      localRouting,
      useMemory: directive.useMemory,
      status: "queued",
      title: args.title,
      summary: args.summary,
      internalNotes: args.internalNotes,
      previewUrl: args.previewUrl,
      attemptCount: 0,
      maxAttempts: args.maxAttempts ?? 3,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("workRunUpdates", {
      runId,
      message: normalizePlainWorkerMessage(`Queued: ${args.title}`),
      tone: "info",
      createdAt: now,
    });

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "work_run.created",
      resourceType: "workRun",
      resourceId: String(runId),
      summary: `Queued work: ${args.title}.`,
      metadata: { directiveId: args.directiveId, taskId: args.taskId, kind: args.kind },
    });

    return runId;
  },
});

export const listQueuedCodePreview = query({
  args: { limit: v.optional(v.number()), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(args.limit ?? 10);

    return queued.filter((run) => run.kind === "code_preview");
  },
});

export const listQueuedDocuments = query({
  args: { limit: v.optional(v.number()), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(args.limit ?? 10);

    return queued.filter((run) => run.kind === "document");
  },
});

export const getDocumentContext = query({
  args: {
    runId: v.id("workRuns"),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run || run.kind !== "document" || !run.workspaceId) return [];
    const directive = await ctx.db.get(run.directiveId);
    const queryText = `${run.title}\n${directive?.objective ?? ""}`;
    const requestSensitivity = inferLocalSensitivity(queryText);
    const items = await ctx.db
      .query("items")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", run.workspaceId))
      .collect();
    const candidates = await Promise.all(items.map(async (item) => {
      const version = item.currentVersionId ? await ctx.db.get(item.currentVersionId) : null;
      return {
        id: String(item._id),
        title: item.title,
        summary: item.summary,
        content: version?.content ?? "",
        status: item.status,
        metadata: item.metadata,
      };
    }));

    const libraryContext = selectDocumentContextCandidates({
      queryText,
      requestSensitivity,
      candidates,
    });
    const remembered = await buildMemoryContext(ctx, {
      workspaceId: run.workspaceId,
      queryText,
      purpose: "document",
      requestSensitivity: inferMemorySensitivity(queryText),
      useMemory: run.useMemory,
      limit: 4,
    });
    return [
      ...libraryContext,
      ...remembered.entries.map((entry) => ({
        id: String(entry._id),
        title: entry.label,
        summary: "Remembered detail",
        excerpt: entry.value,
        sensitivity: entry.sensitivity,
      })),
    ].slice(0, 6);
  },
});

export const getTaskMemoryContext = query({
  args: {
    runId: v.id("workRuns"),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run?.workspaceId) return { enabled: false, text: "", entries: [] };
    const directive = await ctx.db.get(run.directiveId);
    const queryText = `${run.title}\n${directive?.objective ?? ""}`;
    return await buildMemoryContext(ctx, {
      workspaceId: run.workspaceId,
      queryText,
      purpose: run.kind === "code_preview" ? "builder" : "workflow",
      requestSensitivity: inferMemorySensitivity(queryText),
      useMemory: run.useMemory,
      limit: 6,
    });
  },
});

export const listQueuedDesigns = query({
  args: { limit: v.optional(v.number()), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(args.limit ?? 10);

    return queued.filter((run) => run.kind === "design");
  },
});

export const listQueuedCommunications = query({
  args: { limit: v.optional(v.number()), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(args.limit ?? 10);

    return queued.filter((run) => run.kind === "email" || run.kind === "schedule");
  },
});

export const listQueuedGeneric = query({
  args: { limit: v.optional(v.number()), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(args.limit ?? 10);

    return queued.filter((run) => run.kind === "generic" || run.kind === "data_update");
  },
});

export const leaseNext = mutation({
  args: {
    kinds: v.array(workRunKind),
    workerId: v.string(),
    leaseMs: v.optional(v.number()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const now = Date.now();
    const acceptedKinds = args.kinds as WorkRunKind[];
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
      if (!acceptedKinds.includes(run.kind)) continue;
      const attempts = run.attemptCount ?? 0;
      const maxAttempts = run.maxAttempts ?? 3;
      const leaseExpired = typeof run.leaseExpiresAt === "number" && run.leaseExpiresAt <= now;
      if (!leaseExpired || attempts < maxAttempts) continue;

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

    let candidate: Doc<"workRuns"> | undefined;
    for (const run of [...queued, ...working]) {
      if (!canLeaseRun(run, acceptedKinds, now)) continue;
      if (run.taskId) {
        const task = await ctx.db.get(run.taskId);
        const directiveTasks = await ctx.db
          .query("tasks")
          .withIndex("by_directive", (q) => q.eq("directiveId", run.directiveId))
          .collect();
        const tasksById = new Map(directiveTasks.map((candidateTask) => [String(candidateTask._id), candidateTask]));
        if (!taskDependenciesAreComplete(task, tasksById)) continue;
      }
      candidate = run;
      break;
    }
    if (!candidate) return null;

    const leaseId = `${args.workerId}:${now}:${Math.random().toString(36).slice(2)}`;
    const directive = await ctx.db.get(candidate.directiveId);
    const localRouting = candidate.localRouting ?? localRoutingForRun({
      kind: candidate.kind,
      title: candidate.title,
      objective: directive?.objective,
      classification: candidate.classification,
    });
    const patch = leaseRunPatch(candidate, {
      now,
      leaseId,
      leaseOwner: args.workerId,
      leaseMs: args.leaseMs,
    });

    await ctx.db.patch(candidate._id, { ...patch, localRouting });
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

    await recordAuditEvent(ctx, {
      ...workerActor(args.workerId),
      workspaceId: candidate.workspaceId,
      action: "work_run.leased",
      resourceType: "workRun",
      resourceId: String(candidate._id),
      summary: `Worker started: ${candidate.title}.`,
      metadata: { leaseId, attemptCount: patch.attemptCount },
    });

    return { ...candidate, ...patch, localRouting };
  },
});

export const appendUpdate = mutation({
  args: {
    runId: v.id("workRuns"),
    message: v.string(),
    tone: v.union(
      v.literal("info"),
      v.literal("progress"),
      v.literal("review"),
      v.literal("blocked"),
      v.literal("complete"),
      v.literal("error")
    ),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(args.message),
      tone: args.tone,
      createdAt: Date.now(),
    });
  },
});

export const markWorking = mutation({
  args: { runId: v.id("workRuns"), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (run.status === "completed" || run.status === "failed" || run.status === "stopped") {
      return args.runId;
    }

    const now = Date.now();
    await ctx.db.patch(args.runId, { status: "working", updatedAt: now });
    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: "in_progress",
        startedAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(`Started: ${run.title}`),
      tone: "progress",
      createdAt: now,
    });

    await recordAuditEvent(ctx, {
      ...workerActor(run.leaseOwner),
      workspaceId: run.workspaceId,
      action: "work_run.working",
      resourceType: "workRun",
      resourceId: String(args.runId),
      summary: `Working on: ${run.title}.`,
    });

    return args.runId;
  },
});

export const markNeedsReview = mutation({
  args: {
    runId: v.id("workRuns"),
    leaseId: v.optional(v.string()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (!leaseIsValid(run, { leaseId: args.leaseId, now: Date.now() })) {
      throw new Error("This work is already being handled.");
    }

    const now = Date.now();
    await ctx.db.patch(args.runId, finishRunPatch("needs_review", now));
    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: "blocked",
        updatedAt: now,
      });
    }
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(`Ready for your review: ${run.title}`),
      tone: "review",
      createdAt: now,
    });

    return args.runId;
  },
});

export const markNeedsReviewWithResult = mutation({
  args: {
    runId: v.id("workRuns"),
    leaseId: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    message: v.optional(v.string()),
    metadata: v.optional(v.any()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (!leaseIsValid(run, { leaseId: args.leaseId, now: Date.now() })) {
      throw new Error("This work is already being handled.");
    }

    const now = Date.now();
    await ctx.db.patch(args.runId, {
      ...finishRunPatch("needs_review", now),
      summary: args.summary,
      previewUrl: args.previewUrl,
      internalNotes: args.internalNotes,
    });
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(args.message ?? `Ready for your review: ${run.title}`),
      tone: "review",
      createdAt: now,
    });

    const output = await saveRunOutputToLibrary(ctx, run, {
      summary: args.summary,
      content: args.content,
      previewUrl: args.previewUrl,
      metadata: {
        ...metadataObject(args.metadata),
        needsReview: true,
      },
    });
    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: "blocked",
        outputItemId: output?.itemId,
        outputDocumentId: output?.documentId,
        updatedAt: now,
      });
    }

    await recordAuditEvent(ctx, {
      ...workerActor(run.leaseOwner),
      workspaceId: run.workspaceId,
      action: "work_run.result_ready",
      resourceType: "workRun",
      resourceId: String(args.runId),
      summary: args.summary ?? `Ready for review: ${run.title}.`,
      metadata: { outputItemId: output?.itemId, outputDocumentId: output?.documentId },
    });

    return args.runId;
  },
});

export const markWaitingForApproval = mutation({
  args: {
    runId: v.id("workRuns"),
    leaseId: v.optional(v.string()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (!leaseIsValid(run, { leaseId: args.leaseId, now: Date.now() })) {
      throw new Error("This work is already being handled.");
    }

    const now = Date.now();
    await ctx.db.patch(args.runId, finishRunPatch("waiting_for_approval", now));
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(`Awaiting your approval to continue: ${run.title}`),
      tone: "blocked",
      createdAt: now,
    });

    await recordAuditEvent(ctx, {
      ...workerActor(run.leaseOwner),
      workspaceId: run.workspaceId,
      action: "work_run.waiting_for_approval",
      resourceType: "workRun",
      resourceId: String(args.runId),
      summary: `Waiting for approval: ${run.title}.`,
    });

    return args.runId;
  },
});

export const markCompleted = mutation({
  args: {
    runId: v.id("workRuns"),
    leaseId: v.optional(v.string()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (run.status === "completed") return args.runId;
    if (!leaseIsValid(run, { leaseId: args.leaseId, now: Date.now() })) {
      throw new Error("This work is already being handled.");
    }

    const now = Date.now();
    await ctx.db.patch(args.runId, finishRunPatch("completed", now));
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(`Done: ${run.title}`),
      tone: "complete",
      createdAt: now,
    });

    const output = await saveRunOutputToLibrary(ctx, run);
    await ctx.scheduler.runAfter(0, internal.memory.extractFromCompletedWork, {
      runId: args.runId,
      itemId: output?.itemId,
    });
    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: "completed",
        outputItemId: output?.itemId,
        outputDocumentId: output?.documentId,
        completedAt: now,
        updatedAt: now,
      });
    }

    const directive = await ctx.db.get(run.directiveId);
    if (directive && directive.status !== "completed") {
      const allTasks = await ctx.db
        .query("tasks")
        .withIndex("by_directive", (q) => q.eq("directiveId", run.directiveId))
        .collect();
      const allDone = allTasks.every(t => t.status === "completed" || t.status === "failed");
      if (allDone) {
        await ctx.db.patch(run.directiveId, { status: "completed" });
      }
    }

    await recordAuditEvent(ctx, {
      ...workerActor(run.leaseOwner),
      workspaceId: run.workspaceId,
      action: "work_run.completed",
      resourceType: "workRun",
      resourceId: String(args.runId),
      summary: `Done: ${run.title}.`,
      metadata: { outputItemId: output?.itemId, outputDocumentId: output?.documentId },
    });

    return args.runId;
  },
});

export const completeWithResult = mutation({
  args: {
    runId: v.id("workRuns"),
    leaseId: v.optional(v.string()),
    summary: v.string(),
    content: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    metadata: v.optional(v.any()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (run.status === "completed") return args.runId;
    if (!leaseIsValid(run, { leaseId: args.leaseId, now: Date.now() })) {
      throw new Error("This work is already being handled.");
    }

    const now = Date.now();
    await ctx.db.patch(args.runId, {
      ...finishRunPatch("completed", now),
      summary: args.summary,
      previewUrl: args.previewUrl ?? run.previewUrl,
      internalNotes: args.internalNotes,
    });

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(`Done: ${run.title}`),
      tone: "complete",
      createdAt: now,
    });

    const output = await saveRunOutputToLibrary(ctx, run, {
      summary: args.summary,
      content: args.content,
      previewUrl: args.previewUrl,
      metadata: args.metadata,
    });
    await ctx.scheduler.runAfter(0, internal.memory.extractFromCompletedWork, {
      runId: args.runId,
      itemId: output?.itemId,
    });
    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: "completed",
        outputItemId: output?.itemId,
        outputDocumentId: output?.documentId,
        completedAt: now,
        updatedAt: now,
      });
    }

    const directive = await ctx.db.get(run.directiveId);
    if (directive && directive.status !== "completed") {
      const allTasks = await ctx.db
        .query("tasks")
        .withIndex("by_directive", (q) => q.eq("directiveId", run.directiveId))
        .collect();
      const allDone = allTasks.every(t => t.status === "completed" || t.status === "failed");
      if (allDone) {
        await ctx.db.patch(run.directiveId, { status: "completed" });
      }
    }

    await recordAuditEvent(ctx, {
      ...workerActor(run.leaseOwner),
      workspaceId: run.workspaceId,
      action: "work_run.completed",
      resourceType: "workRun",
      resourceId: String(args.runId),
      summary: args.summary,
      metadata: { outputItemId: output?.itemId, outputDocumentId: output?.documentId },
    });

    return args.runId;
  },
});

export const markFailed = mutation({
  args: {
    runId: v.id("workRuns"),
    message: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    internalError: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
    leaseId: v.optional(v.string()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (run.status === "completed" || run.status === "stopped") return args.runId;
    if (!leaseIsValid(run, { leaseId: args.leaseId, now: Date.now() })) {
      throw new Error("This work is already being handled.");
    }

    const now = Date.now();
    const failure = failRunState(run, {
      now,
      retryable: args.retryable,
      failureReason: args.failureReason ?? args.message ?? `Could not finish: ${run.title}`,
      internalError: args.internalError,
    });

    await ctx.db.patch(args.runId, failure.patch);
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
      const directive = await ctx.db.get(run.directiveId);
      if (directive && directive.status !== "completed" && directive.status !== "blocked") {
        const allTasks = await ctx.db
          .query("tasks")
          .withIndex("by_directive", (q) => q.eq("directiveId", run.directiveId))
          .collect();
        const allTerminal = allTasks.every(t => t.status === "completed" || t.status === "failed");
        if (allTerminal) {
          await ctx.db.patch(run.directiveId, { status: "blocked" });
        }
      }
    }

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: failure.updateMessage,
      tone: failure.updateTone,
      createdAt: now,
    });

    await recordAuditEvent(ctx, {
      ...workerActor(run.leaseOwner),
      workspaceId: run.workspaceId,
      action: "work_run.failed",
      resourceType: "workRun",
      resourceId: String(args.runId),
      summary: failure.patch.failureReason,
      metadata: { retryScheduled: failure.retryScheduled },
    });

    return args.runId;
  },
});

export const stop = mutation({
  args: { runId: v.id("workRuns") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    ensureDocWorkspace(run, current.workspaceId, "Work run");
    if (run.status === "completed" || run.status === "stopped" || run.status === "failed") {
      return args.runId;
    }

    const now = Date.now();
    await ctx.db.patch(args.runId, {
      status: "stopped",
      leaseId: undefined,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: "blocked",
        updatedAt: now,
      });
    }
    const directive = await ctx.db.get(run.directiveId);
    if (directive && (directive.status === "in_progress" || directive.status === "pending_spec")) {
      await ctx.db.patch(run.directiveId, { status: "blocked" });
    }
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: normalizePlainWorkerMessage(`Stopped: ${run.title}`),
      tone: "info",
      createdAt: now,
    });

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "work_run.stopped",
      resourceType: "workRun",
      resourceId: String(args.runId),
      summary: `Stopped: ${run.title}.`,
    });

    return args.runId;
  },
});

export const listByDirective = query({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    ensureDocWorkspace(await ctx.db.get(args.directiveId), workspaceId, "Task");
    return await ctx.db
      .query("workRuns")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .order("desc")
      .collect();
  },
});

export const listUpdates = query({
  args: { runId: v.id("workRuns") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    ensureDocWorkspace(await ctx.db.get(args.runId), workspaceId, "Work run");
    return await ctx.db
      .query("workRunUpdates")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .order("desc")
      .collect();
  },
});

export const listArtifacts = query({
  args: { runId: v.id("workRuns") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    ensureDocWorkspace(await ctx.db.get(args.runId), workspaceId, "Work run");
    return await ctx.db
      .query("workArtifacts")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const getRunsAndUpdates = query({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    ensureDocWorkspace(await ctx.db.get(args.directiveId), workspaceId, "Task");
    const runs = await ctx.db
      .query("workRuns")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .order("desc")
      .collect();

    return await Promise.all(
      runs.map(async (run) => {
        const updates = await ctx.db
          .query("workRunUpdates")
          .withIndex("by_run", (q) => q.eq("runId", run._id))
          .order("asc")
          .collect();
        const artifacts = await ctx.db
          .query("workArtifacts")
          .withIndex("by_run", (q) => q.eq("runId", run._id))
          .collect();
        return { ...run, updates, artifacts };
      })
    );
  },
});

export const getWorkPage = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const runs = await ctx.db
      .query("workRuns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(240);

    const pendingApprovals = [
      ...(await ctx.db
      .query("approvalQueue")
        .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspaceId).eq("status", "pending"))
        .collect()),
      ...(await ctx.db
        .query("approvalQueue")
        .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspaceId).eq("status", "shadow_pending"))
        .collect()),
    ];

    const groupedRuns = new Map<string, Doc<"workRuns">[]>();
    for (const run of runs) {
      const key = String(run.directiveId);
      groupedRuns.set(key, [...(groupedRuns.get(key) ?? []), run]);
    }

    async function toWorkItem(directiveRuns: Doc<"workRuns">[]) {
      const orderedRuns = [...directiveRuns].sort((a, b) => b.updatedAt - a.updatedAt);
      const projection = projectFounderVisibleWorkflowStatus(orderedRuns);
      const statusOrder = ["waiting_for_approval", "needs_review", "failed", "stopped", "working", "queued", "completed"];
      const run = statusOrder
        .map((status) => orderedRuns.find((candidate) => candidate.status === status))
        .find(Boolean) ?? orderedRuns[0];
      const directive = await ctx.db.get(run.directiveId);
      const workflow = run.workflowId ? await ctx.db.get(run.workflowId) : null;
      const latestUpdate = await ctx.db
        .query("workRunUpdates")
        .withIndex("by_run", (q) => q.eq("runId", run._id))
        .order("desc")
        .first();
      const outputs = await Promise.all(
        orderedRuns.map(async (candidate) => {
          const artifact = await ctx.db
            .query("workArtifacts")
            .withIndex("by_run", (q) => q.eq("runId", candidate._id))
            .first();
          const itemId = candidate.outputItemId ?? artifact?.libraryItemId;
          if (!itemId) return null;
          const item = await ctx.db.get(itemId);
          return {
            id: itemId,
            title: item?.title ?? artifact?.title ?? candidate.title,
            href: `/library/${itemId}`,
          };
        }),
      );
      const savedOutputs = [...new Map(
        outputs.filter((output): output is NonNullable<typeof output> => Boolean(output))
          .map((output) => [String(output.id), output]),
      ).values()];
      const approval = pendingApprovals.find((candidate) =>
        candidate.runId && orderedRuns.some((candidateRun) => candidateRun._id === candidate.runId),
      );
      const libraryItemId = savedOutputs[0]?.id;

      return {
        id: run._id,
        taskId: run.directiveId,
        sessionId: directive?.sessionId,
        workflowId: run.workflowId,
        title: workflow?.title ?? directive?.title ?? run.title,
        kind: run.kind,
        objective: directive?.objective,
        summary: run.summary,
        latestUpdate: latestUpdate?.message ?? run.failureReason,
        status: projection.status,
        statusLabel: labelForWorkPage(projection.status),
        progressLabel: projection.progressLabel,
        completedSteps: projection.progress.completed,
        totalSteps: projection.progress.total,
        previewUrl: orderedRuns.find((candidate) => candidate.previewUrl)?.previewUrl,
        libraryItemId,
        libraryHref: libraryItemId ? `/library/${libraryItemId}` : undefined,
        savedOutputs,
        createdAt: Math.min(...orderedRuns.map((candidate) => candidate.createdAt)),
        updatedAt: Math.max(...orderedRuns.map((candidate) => candidate.updatedAt)),
        approval: approval
          ? {
              id: approval._id,
              actionKind: approval.actionKind,
              title: approval.actionTitle,
              description: approval.actionDescription,
            }
          : null,
      };
    }

    const items = await Promise.all([...groupedRuns.values()].map(toWorkItem));
    const sorted = items.sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      active: sorted.filter((item) => ["queued", "working", "failed"].includes(item.status)).slice(0, 40),
      readyForReview: sorted.filter((item) => item.status === "needs review").slice(0, 40),
      pendingApprovals: sorted.filter((item) => item.status === "needs approval").slice(0, 40),
      completed: sorted.filter((item) => item.status === "done").slice(0, 40),
    };
  },
});
