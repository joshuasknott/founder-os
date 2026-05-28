import { mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

export const createDirective = mutation({
  args: {
    title: v.string(),
    objective: v.string(),
  },
  handler: async (ctx, args) => {
    const directiveId = await ctx.db.insert("directives", {
      title: args.title,
      objective: args.objective,
      status: "pending_spec",
    });

    await ctx.scheduler.runAfter(0, internal.telemetry.logEvent, {
      traceId: directiveId,
      actor: "system: Orchestrator",
      eventType: "STATE_TRANSITION" as const,
      rawPayload: {
        directive: args.title,
        transition: "created → pending_spec",
      },
    });

    await ctx.scheduler.runAfter(0, api.orchestrator.initializePlaybook, {
      directiveId,
      directiveTitle: args.title,
      directiveObjective: args.objective,
    });

    return directiveId;
  },
});

export const getActiveDirective = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("directives")
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
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.directiveId);
  },
});

export const getTasksByDirective = query({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();
  },
});

export const getRecentDirectives = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("directives")
      .order("desc")
      .take(20);
  },
});
