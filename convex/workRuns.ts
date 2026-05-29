import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
