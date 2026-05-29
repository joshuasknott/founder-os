import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const invite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("Owner"), v.literal("Contributor"), v.literal("Viewer")),
  },
  handler: async (ctx, { workspaceId, email, role }) => {
    return await ctx.db.insert("users", {
      externalId: `invited_${Date.now()}`,
      workspaceId,
      name: email.split("@")[0], // Placeholder name until they accept the invite
      email,
      role,
      status: "offline",
      joinedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    await ctx.db.delete(userId);
  },
});
