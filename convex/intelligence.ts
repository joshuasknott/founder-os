import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getNodes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("knowledge_nodes").collect();
  },
});

export const getHistory = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("event_ledger")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const createNode = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("Folder"), v.literal("File"), v.literal("Blueprint")),
    title: v.string(),
    parentId: v.optional(v.id("knowledge_nodes")),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("knowledge_nodes", {
      workspaceId: args.workspaceId,
      type: args.type,
      title: args.title,
      parentId: args.parentId,
      content: args.content,
    });
  },
});

export const deleteNode = mutation({
  args: {
    nodeId: v.id("knowledge_nodes"),
  },
  handler: async (ctx, { nodeId }) => {
    await ctx.db.delete(nodeId);
  },
});
