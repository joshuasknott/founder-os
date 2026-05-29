import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { connectorCredentialStorage } from "./connectorRuntime";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    if (!workspaces[0]) return [];
    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaces[0]._id))
      .collect();

    return keys.map((key) => ({
      _id: key._id,
      _creationTime: key._creationTime,
      workspaceId: key.workspaceId,
      name: key.name,
      createdAt: key.createdAt,
      hasCredential: Boolean(key.value),
    }));
  },
});

export const add = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    value: v.string(),
  },
  handler: async (ctx, { workspaceId, name, value }) => {
    const now = Date.now();
    const envelope = connectorCredentialStorage.seal({
      workspaceId: String(workspaceId),
      connectorId: "legacy_api_key",
      secret: value,
      now,
    });

    await ctx.db.insert("api_keys", {
      workspaceId,
      name,
      value: envelope.sealedReference,
      createdAt: now,
    });
  },
});

export const remove = mutation({
  args: { keyId: v.id("api_keys") },
  handler: async (ctx, { keyId }) => {
    await ctx.db.delete(keyId);
  },
});
