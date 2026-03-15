import { mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";

export const createDirective = mutation({
  args: {
    title: v.string(),
    objective: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized: Principal identity required");

    // 1. Create the directive in "pending_spec" state
    const directiveId = await ctx.db.insert("directives", {
      title: args.title,
      objective: args.objective,
      status: "pending_spec",
    });

    // 2. Log the state transition via sanitized telemetry writer
    await ctx.scheduler.runAfter(0, internal.telemetry.logEvent, {
      traceId: directiveId,
      actor: "system: Orchestrator",
      eventType: "STATE_TRANSITION" as const,
      rawPayload: {
        directive: args.title,
        transition: "created → pending_spec",
      },
    });

    // 3. Trigger the Orchestrator to draft the implementation spec
    await ctx.scheduler.runAfter(0, api.orchestrator.initializePlaybook, {
      directiveId,
      directiveTitle: args.title,
      directiveObjective: args.objective,
    });

    return directiveId;
  },
});
