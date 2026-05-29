import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

function documentKindForRun(
  kind: string,
  hasPreview: boolean,
): "document" | "file" | "website" | "plan" | "task_output" {
  if (kind === "code_preview" && hasPreview) return "website";
  if (kind === "document" || kind === "email") return "document";
  if (kind === "design") return "file";
  if (kind === "schedule") return "plan";
  return "task_output";
}

function artifactKindForRun(kind: string) {
  if (kind === "code_preview") return "preview";
  if (kind === "data_update") return "record";
  return kind;
}

async function saveRunOutputToLibrary(
  ctx: MutationCtx,
  run: {
    _id: Id<"workRuns">;
    directiveId: Id<"directives">;
    kind: string;
    title: string;
    summary?: string;
    previewUrl?: string;
  },
  result?: {
    summary?: string;
    content?: string;
    previewUrl?: string;
  },
) {
  const existingArtifacts = await ctx.db
    .query("workArtifacts")
    .withIndex("by_run", (q) => q.eq("runId", run._id))
    .collect();

  if (existingArtifacts.some((artifact: { libraryDocumentId?: unknown }) => artifact.libraryDocumentId)) {
    return null;
  }

  const department = await ctx.db.query("departments").first();
  if (!department) return null;

  const summary = result?.summary ?? run.summary ?? "Saved from a FounderOS task.";
  const previewUrl = result?.previewUrl ?? run.previewUrl;
  const now = Date.now();
  const content = result?.content ?? [
    `# ${run.title}`,
    "",
    summary,
    ...(previewUrl ? ["", `Preview: ${previewUrl}`] : []),
  ].join("\n");

  const docId = await ctx.db.insert("documents", {
    workspaceId: department.workspaceId,
    title: run.title,
    departmentTag: department._id,
    author: "FounderOS",
    traceId: run.directiveId,
    kind: documentKindForRun(run.kind, Boolean(previewUrl)),
    summary,
    status: "draft",
    isArchived: false,
    versionCount: 1,
    createdAt: now,
    updatedAt: now,
  });

  const versionId = await ctx.db.insert("documentVersions", {
    documentId: docId,
    content,
    versionNumber: 1,
    createdAt: now,
    createdBy: "FounderOS",
    summary,
  });

  await ctx.db.patch(docId, { currentVersionId: versionId });

  await ctx.db.insert("workArtifacts", {
    runId: run._id,
    directiveId: run.directiveId,
    title: run.title,
    kind: artifactKindForRun(run.kind),
    summary,
    url: previewUrl,
    libraryDocumentId: docId,
    createdAt: now,
  });

  await ctx.db.insert("workRunUpdates", {
    runId: run._id,
    message: "Saved to Library.",
    tone: "complete",
    createdAt: now,
  });

  return docId;
}

export const create = mutation({
  args: {
    directiveId: v.id("directives"),
    taskId: v.optional(v.id("tasks")),
    kind: v.union(
      v.literal("code_preview"),
      v.literal("document"),
      v.literal("design"),
      v.literal("email"),
      v.literal("schedule"),
      v.literal("data_update"),
      v.literal("generic")
    ),
    title: v.string(),
    summary: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const directive = await ctx.db.get(args.directiveId);
    if (!directive) throw new Error("Task not found.");

    const now = Date.now();
    const runId = await ctx.db.insert("workRuns", {
      directiveId: args.directiveId,
      taskId: args.taskId,
      kind: args.kind,
      status: "queued",
      title: args.title,
      summary: args.summary,
      internalNotes: args.internalNotes,
      previewUrl: args.previewUrl,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("workRunUpdates", {
      runId,
      message: `Queued: ${args.title}`,
      tone: "info",
      createdAt: now,
    });

    return runId;
  },
});

export const listQueuedCodePreview = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(args.limit ?? 10);

    return queued.filter((run) => run.kind === "code_preview");
  },
});

export const listQueuedDocuments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(args.limit ?? 10);

    return queued.filter((run) => run.kind === "document");
  },
});

export const listQueuedDesigns = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(args.limit ?? 10);

    return queued.filter((run) => run.kind === "design");
  },
});

export const listQueuedCommunications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const queued = await ctx.db
      .query("workRuns")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(args.limit ?? 10);

    return queued.filter((run) => run.kind === "email" || run.kind === "schedule");
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
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: args.message,
      tone: args.tone,
      createdAt: Date.now(),
    });
  },
});

export const markWorking = mutation({
  args: { runId: v.id("workRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    const now = Date.now();
    await ctx.db.patch(args.runId, { status: "working", updatedAt: now });
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: `Started: ${run.title}`,
      tone: "progress",
      createdAt: now,
    });
  },
});

export const markNeedsReview = mutation({
  args: { runId: v.id("workRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    const now = Date.now();
    await ctx.db.patch(args.runId, { status: "needs_review", updatedAt: now });
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: `Ready for your review: ${run.title}`,
      tone: "review",
      createdAt: now,
    });
  },
});

export const markNeedsReviewWithResult = mutation({
  args: {
    runId: v.id("workRuns"),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    const now = Date.now();
    await ctx.db.patch(args.runId, {
      status: "needs_review",
      summary: args.summary,
      previewUrl: args.previewUrl,
      internalNotes: args.internalNotes,
      updatedAt: now,
    });
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: args.message ?? `Ready for your review: ${run.title}`,
      tone: "review",
      createdAt: now,
    });

    await saveRunOutputToLibrary(ctx, run, {
      summary: args.summary,
      content: args.content,
      previewUrl: args.previewUrl,
    });
  },
});

export const markWaitingForApproval = mutation({
  args: { runId: v.id("workRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    const now = Date.now();
    await ctx.db.patch(args.runId, { status: "waiting_for_approval", updatedAt: now });
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: `Awaiting your approval to continue: ${run.title}`,
      tone: "blocked",
      createdAt: now,
    });
  },
});

export const markCompleted = mutation({
  args: { runId: v.id("workRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    const now = Date.now();
    await ctx.db.patch(args.runId, { status: "completed", updatedAt: now });
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: `Done: ${run.title}`,
      tone: "complete",
      createdAt: now,
    });

    await saveRunOutputToLibrary(ctx, run);
  },
});

export const completeWithResult = mutation({
  args: {
    runId: v.id("workRuns"),
    summary: v.string(),
    content: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    const now = Date.now();
    await ctx.db.patch(args.runId, {
      status: "completed",
      summary: args.summary,
      internalNotes: args.internalNotes,
      updatedAt: now,
    });

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: `Done: ${run.title}`,
      tone: "complete",
      createdAt: now,
    });

    await saveRunOutputToLibrary(ctx, run, {
      summary: args.summary,
      content: args.content,
    });
  },
});

export const markFailed = mutation({
  args: {
    runId: v.id("workRuns"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    const now = Date.now();
    await ctx.db.patch(args.runId, { status: "failed", updatedAt: now });
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: args.message ?? `Could not finish: ${run.title}`,
      tone: "error",
      createdAt: now,
    });
  },
});

export const stop = mutation({
  args: { runId: v.id("workRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (run.status === "completed" || run.status === "stopped" || run.status === "failed") {
      return args.runId;
    }

    const now = Date.now();
    await ctx.db.patch(args.runId, { status: "stopped", updatedAt: now });
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: `Stopped: ${run.title}`,
      tone: "info",
      createdAt: now,
    });

    return args.runId;
  },
});

export const listByDirective = query({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
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
    return await ctx.db
      .query("workArtifacts")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const getRunsAndUpdates = query({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
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
        return { ...run, updates };
      })
    );
  },
});
