import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    if (!workspaces[0]) return [];
    return ctx.db
      .query("api_keys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaces[0]._id))
      .collect();
  },
});

export const add = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    value: v.string(),
  },
  handler: async (ctx, { workspaceId, name, value }) => {
    await ctx.db.insert("api_keys", { workspaceId, name, value });
  },
});

export const remove = mutation({
  args: { keyId: v.id("api_keys") },
  handler: async (ctx, { keyId }) => {
    await ctx.db.delete(keyId);
  },
});
