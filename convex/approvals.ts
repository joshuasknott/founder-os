import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";

// =========================================================================
// QUERIES
// =========================================================================

export const getPendingApprovals = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized: Principal identity required");

    return await ctx.db
      .query("approvalQueue")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "shadow_pending")
        )
      )
      .collect();
  },
});

// =========================================================================
// MUTATIONS
// =========================================================================

export const resolveApproval = mutation({
  args: {
    approvalId: v.id("approvalQueue"),
    decision: v.union(v.literal("approved"), v.literal("denied")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized: Principal identity required");

    // 1. Update the approval record
    await ctx.db.patch(args.approvalId, { status: args.decision });

    // 2. Fetch the approval to get the type and linked IDs
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval not found");

    // 3. Route based on decision
    if (args.decision === "approved") {
      if (approval.type === "spec_gate") {
        // Since we removed draftImplementationSpec logic in engine, 
        // passing it to initializePlaybook execution process
        await ctx.scheduler.runAfter(
          0,
          internal.engine.dispatchDirective,
          { directiveId: approval.directiveId }
        );
      }

      if ((approval.type === "integration_gate" || approval.type === "shadow_approval") && approval.taskId) {
        // Task unblocked → reset to queued so the Smart Burst can pick it up immediately
        await ctx.db.patch(approval.taskId, { status: "queued" });
        await ctx.scheduler.runAfter(
          0,
          internal.engine.executeTask,
          { taskId: approval.taskId }
        );
      }
    } else {
      // Denied → block the directive
      await ctx.db.patch(approval.directiveId, { status: "blocked" });

      if (approval.taskId) {
        await ctx.db.patch(approval.taskId, { status: "blocked" });
      }
    }

    // 4. Log the decision via sanitized telemetry writer
    await ctx.scheduler.runAfter(0, internal.telemetry.logEvent, {
      traceId: approval.directiveId,
      actor: "principal: Founder",
      eventType: "STATE_TRANSITION" as const,
      rawPayload: {
        approvalId: args.approvalId,
        type: approval.type,
        decision: args.decision,
      },
    });
  },
});
