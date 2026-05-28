import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// =========================================================================
// APPROVALS — Currently unused (fully autonomous mode)
// Kept for potential future re-activation of tiered autonomy.
// =========================================================================

export const getPendingApprovals = query({
  handler: async (ctx) => {
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
