import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";

// =========================================================================
// SYSTEM HALT — The Kill Switch (Doc 7 §1)
//
// Emergency stop. Aborts all in-progress directives and tasks, then logs
// a SYSTEM_HALT event through the sanitized telemetry writer.
// =========================================================================

export const systemHalt = mutation({
  args: {
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Principal Binding — only authenticated founders can pull the kill switch
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized: Principal identity required");

    // 2. Abort all in-progress directives
    const activeDirectives = await ctx.db
      .query("directives")
      .filter((q) => q.eq(q.field("status"), "in_progress"))
      .collect();

    for (const directive of activeDirectives) {
      await ctx.db.patch(directive._id, { status: "aborted_by_principal" });
    }

    // 3. Abort all in-progress and queued tasks
    const activeTasks = await ctx.db
      .query("tasks")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "in_progress"),
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "shadow_pending")
        )
      )
      .collect();

    for (const task of activeTasks) {
      await ctx.db.patch(task._id, { status: "blocked" });
    }

    // 4. Log the SYSTEM_HALT event via sanitized telemetry
    //    We need a traceId — use the first aborted directive, or a placeholder
    const traceDirective = activeDirectives[0];
    if (traceDirective) {
      await ctx.scheduler.runAfter(0, internal.telemetry.logEvent, {
        traceId: traceDirective._id,
        actor: `principal: ${identity.name ?? identity.email ?? "Founder"}`,
        eventType: "SYSTEM_HALT" as const,
        rawPayload: {
          action: "system_halt",
          reason: args.reason ?? "Emergency stop triggered by Principal",
          directivesAborted: activeDirectives.length,
          tasksBlocked: activeTasks.length,
        },
      });
    }

    return {
      directivesAborted: activeDirectives.length,
      tasksBlocked: activeTasks.length,
      message: "SYSTEM HALT executed. All active work has been stopped.",
    };
  },
});
