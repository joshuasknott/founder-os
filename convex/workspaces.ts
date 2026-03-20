import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("workspaces").collect();
  },
});

export const updateBillingLimits = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    dailySpendLimit: v.number(),
    alertThreshold: v.number(),
  },
  handler: async (ctx, { workspaceId, dailySpendLimit, alertThreshold }) => {
    await ctx.db.patch(workspaceId, { dailySpendLimit, alertThreshold });
  },
});
