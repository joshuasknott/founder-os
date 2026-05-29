import { mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

export const createDirective = mutation({
  args: {
    title: v.string(),
    objective: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, args) => {
    const directiveId = await ctx.db.insert("directives", {
      title: args.title,
      objective: args.objective,
      sessionId: args.sessionId,
      status: "pending_spec",
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
        content: `I created a task for this and will keep updates in this conversation.\n\nTask: ${args.title}`,
      });

      await ctx.db.patch(args.sessionId, { lastMessageAt: Date.now() });
    }

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

export const addClarification = mutation({
  args: {
    directiveId: v.id("directives"),
    content: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
  },
  handler: async (ctx, args) => {
    const directive = await ctx.db.get(args.directiveId);
    if (!directive) throw new Error("Task not found.");

    const sessionId = args.sessionId ?? directive.sessionId;
    const updatedObjective = `${directive.objective}\n\nFounder clarification: ${args.content}`;

    await ctx.db.patch(args.directiveId, {
      objective: updatedObjective,
      status: "pending_spec",
      ...(sessionId ? { sessionId } : {}),
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
        content: "Thanks. I added that answer to the task and will continue from here.",
      });

      await ctx.db.patch(sessionId, { lastMessageAt: Date.now() });
    }

    await ctx.scheduler.runAfter(0, api.orchestrator.initializePlaybook, {
      directiveId: args.directiveId,
      directiveTitle: directive.title,
      directiveObjective: updatedObjective,
    });

    return args.directiveId;
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
