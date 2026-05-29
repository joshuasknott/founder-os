import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

function initialRunKind(objective: string): "code_preview" | "document" | "generic" {
  const normalized = objective.toLowerCase();
  const buildSignals = [
    "build",
    "create a page",
    "create page",
    "landing page",
    "website",
    "app",
    "internal tool",
    "preview",
    "code",
    "fix",
    "bug",
  ];

  if (buildSignals.some((signal) => normalized.includes(signal))) {
    return "code_preview";
  }

  const documentSignals = [
    "brief",
    "plan",
    "checklist",
    "proposal",
    "meeting notes",
    "launch plan",
    "draft",
    "write",
    "summarize",
  ];

  return documentSignals.some((signal) => normalized.includes(signal))
    ? "document"
    : "generic";
}

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

    const now = Date.now();
    const runId = await ctx.db.insert("workRuns", {
      directiveId,
      kind: initialRunKind(args.objective),
      status: "queued",
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("workRunUpdates", {
      runId,
      message: "I've added this to your workspace and I'm preparing the next step.",
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
        content: `I've added this to your workspace and I'm preparing the next step.`,
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

    return args.directiveId;
  },
});

export const stopDirective = mutation({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const directive = await ctx.db.get(args.directiveId);
    if (!directive) throw new Error("Task not found.");
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
        await ctx.db.patch(run._id, { status: "stopped", updatedAt: Date.now() });
      }
    }

    if (directive.sessionId) {
      await ctx.db.insert("chatMessages", {
        sessionId: directive.sessionId,
        role: "assistant",
        agentName: "FounderOS",
        content: `Stopped: ${directive.title}`,
      });
      await ctx.db.patch(directive.sessionId, { lastMessageAt: Date.now() });
    }

    return args.directiveId;
  },
});

export const deleteDirective = mutation({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const directive = await ctx.db.get(args.directiveId);
    if (!directive) throw new Error("Task not found.");

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
