import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { connectorCredentialStorage } from "./connectorRuntime";
import { actorFromIdentity, requireCurrentUser, requireWorkspaceAccess } from "./authz";
import { recordAuditEvent } from "./audit";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
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
    const current = await requireWorkspaceAccess(ctx, workspaceId, ["Owner"]);
    const now = Date.now();
    const envelope = await connectorCredentialStorage.seal({
      workspaceId: String(workspaceId),
      connectorId: "legacy_api_key",
      secret: value,
      now,
    });

    const keyId = await ctx.db.insert("api_keys", {
      workspaceId,
      name,
      value: envelope.sealedReference,
      createdAt: now,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId,
      action: "integration.api_key_added",
      resourceType: "api_key",
      resourceId: String(keyId),
      summary: `Added ${name}.`,
    });
    return keyId;
  },
});

export const remove = mutation({
  args: { keyId: v.id("api_keys") },
  handler: async (ctx, { keyId }) => {
    const key = await ctx.db.get(keyId);
    if (!key) throw new Error("Key not found.");
    const current = await requireWorkspaceAccess(ctx, key.workspaceId, ["Owner"]);
    await ctx.db.delete(keyId);
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: key.workspaceId,
      action: "integration.api_key_removed",
      resourceType: "api_key",
      resourceId: String(keyId),
      summary: `Removed ${key.name}.`,
    });
  },
});
