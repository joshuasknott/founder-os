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

export const approve = mutation({
  args: { approvalId: v.id("approvalQueue") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.approvalId, {
      status: "approved",
      principalSignature: `approved:${Date.now()}`,
    });
  },
});

export const deny = mutation({
  args: { approvalId: v.id("approvalQueue") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.approvalId, {
      status: "denied",
      principalSignature: `denied:${Date.now()}`,
    });
  },
});
