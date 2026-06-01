import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { actorFromIdentity, requireCurrentUser, requireWorkspaceAccess } from "./authz";
import { recordAuditEvent } from "./audit";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);
    return user;
  },
});

export const invite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("Owner"), v.literal("Contributor"), v.literal("Viewer")),
  },
  handler: async (ctx, { workspaceId, email, role }) => {
    const current = await requireWorkspaceAccess(ctx, workspaceId, ["Owner"]);
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workspace_email", (q) => q.eq("workspaceId", workspaceId).eq("email", normalizedEmail))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { role });
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      externalId: `invited_${Date.now()}`,
      workspaceId,
      name: normalizedEmail.split("@")[0],
      email: normalizedEmail,
      role,
      status: "offline",
      joinedAt: Date.now(),
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId,
      action: "user.invited",
      resourceType: "user",
      resourceId: String(userId),
      summary: `Invited ${normalizedEmail}.`,
      metadata: { role },
    });
    return userId;
  },
});

export const remove = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("User not found.");
    const current = await requireWorkspaceAccess(ctx, target.workspaceId, ["Owner"]);
    if (target._id === current.user._id) throw new Error("You cannot remove yourself.");
    await ctx.db.delete(userId);
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: target.workspaceId,
      action: "user.removed",
      resourceType: "user",
      resourceId: String(userId),
      summary: `Removed ${target.email}.`,
    });
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const current = await requireCurrentUser(ctx);
    await ctx.db.delete(current.user._id);
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "user.deleted_account",
      resourceType: "user",
      resourceId: String(current.user._id),
      summary: "Account deleted.",
    });
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    await ctx.db.patch(current.user._id, {
      name: args.name.trim() || current.user.name,
      avatarUrl: args.avatarUrl,
      status: "online",
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "user.profile_updated",
      resourceType: "user",
      resourceId: String(current.user._id),
      summary: "Profile updated.",
    });
    return current.user._id;
  },
});
