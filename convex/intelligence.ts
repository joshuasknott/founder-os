import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser, requireWorkspaceAccess } from "./authz";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getNodes = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("knowledge_nodes")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

export const getHistory = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return (await ctx.db
      .query("event_ledger")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect())
      .sort((a, b) => b.timestamp - a.timestamp);
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
    await requireWorkspaceAccess(ctx, args.workspaceId, ["Owner", "Contributor"]);
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
    const node = await ctx.db.get(nodeId);
    if (!node) throw new Error("Node not found.");
    await requireWorkspaceAccess(ctx, node.workspaceId, ["Owner", "Contributor"]);
    await ctx.db.delete(nodeId);
  },
});
