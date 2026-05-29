import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getPendingApprovals = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("approvalQueue")
      .filter((q) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "shadow_pending")),
      )
      .collect();
  },
});

export const createForRun = mutation({
  args: {
    directiveId: v.id("directives"),
    runId: v.id("workRuns"),
    actionKind: v.union(
      v.literal("publish_preview"),
      v.literal("send_email"),
      v.literal("post_externally"),
      v.literal("spend_money"),
      v.literal("delete_data"),
      v.literal("change_live_asset"),
      v.literal("generic")
    ),
    actionTitle: v.string(),
    actionDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");

    const now = Date.now();
    await ctx.db.patch(args.runId, {
      status: "waiting_for_approval",
      updatedAt: now,
    });

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: `Waiting for approval: ${args.actionTitle}`,
      tone: "blocked",
      createdAt: now,
    });

    return await ctx.db.insert("approvalQueue", {
      type: "integration_gate",
      directiveId: args.directiveId,
      runId: args.runId,
      actionKind: args.actionKind,
      actionTitle: args.actionTitle,
      actionDescription: args.actionDescription,
      status: "pending",
      autonomyLevel: 3,
    });
  },
});

export const approve = mutation({
  args: { approvalId: v.id("approvalQueue") },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval request not found.");

    await ctx.db.patch(args.approvalId, {
      status: "approved",
      principalSignature: `approved:${Date.now()}`,
    });

    if (approval.runId) {
      const now = Date.now();
      await ctx.db.patch(approval.runId, {
        status: "working",
        updatedAt: now,
      });
      await ctx.db.insert("workRunUpdates", {
        runId: approval.runId,
        message: `Approved: ${approval.actionTitle ?? "Continue this step"}`,
        tone: "progress",
        createdAt: now,
      });
    }
  },
});

export const deny = mutation({
  args: { approvalId: v.id("approvalQueue") },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval request not found.");

    await ctx.db.patch(args.approvalId, {
      status: "denied",
      principalSignature: `denied:${Date.now()}`,
    });

    if (approval.runId) {
      const now = Date.now();
      await ctx.db.patch(approval.runId, {
        status: "needs_review",
        updatedAt: now,
      });
      await ctx.db.insert("workRunUpdates", {
        runId: approval.runId,
        message: `Declined: ${approval.actionTitle ?? "Requested step"}`,
        tone: "blocked",
        createdAt: now,
      });
    }
  },
});
