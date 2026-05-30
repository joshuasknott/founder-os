import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { actorFromIdentity, ensureUserWorkspace, requireCurrentUser, requireOwnedWorkspace } from "./authz";
import { recordAuditEvent } from "./audit";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const workspace = await ctx.db.get(workspaceId);
    return workspace ? [workspace] : [];
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const { identity, user } = await ensureUserWorkspace(ctx);
    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      iconSlug: "building",
      createdAt: Date.now(),
    });
    await ctx.db.patch(user._id, { workspaceId, role: "Owner" });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(identity, user),
      workspaceId,
      action: "workspace.created",
      resourceType: "workspace",
      resourceId: String(workspaceId),
      summary: `Created workspace ${name}.`,
    });
    return workspaceId;
  },
});

export const updateDetails = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, { workspaceId, name }) => {
    const current = await requireOwnedWorkspace(ctx, workspaceId);
    const cleanName = name.trim();
    if (!cleanName) throw new Error("Workspace name is required.");
    await ctx.db.patch(workspaceId, { name: cleanName });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId,
      action: "workspace.updated",
      resourceType: "workspace",
      resourceId: String(workspaceId),
      summary: `Updated workspace: ${cleanName}.`,
    });
    return workspaceId;
  },
});

export const completeOnboarding = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    connectorIds: v.optional(v.array(v.string())),
    reviewExternalActions: v.boolean(),
  },
  handler: async (ctx, { workspaceId, name, connectorIds, reviewExternalActions }) => {
    const current = await requireOwnedWorkspace(ctx, workspaceId);
    const cleanName = name.trim();
    if (!cleanName) throw new Error("Business name is required.");
    await ctx.db.patch(workspaceId, {
      name: cleanName,
      onboardingConnectorIds: connectorIds ?? [],
      onboardingCompletedAt: Date.now(),
      reviewExternalActions,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId,
      action: "workspace.onboarding_completed",
      resourceType: "workspace",
      resourceId: String(workspaceId),
      summary: "Onboarding completed.",
      metadata: { connectorIds: connectorIds ?? [], reviewExternalActions },
    });
    return workspaceId;
  },
});

export const updateBillingLimits = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    dailySpendLimit: v.number(),
    alertThreshold: v.number(),
  },
  handler: async (ctx, { workspaceId, dailySpendLimit, alertThreshold }) => {
    const current = await requireOwnedWorkspace(ctx, workspaceId);
    await ctx.db.patch(workspaceId, { dailySpendLimit, alertThreshold });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId,
      action: "workspace.billing_limits_updated",
      resourceType: "workspace",
      resourceId: String(workspaceId),
      summary: "Billing guardrails updated.",
      metadata: { dailySpendLimit, alertThreshold },
    });
  },
});

export const exportData = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const [
      workspace,
      users,
      items,
      directives,
      scheduleItems,
      workflows,
      connectorActionLogs,
      auditEvents,
    ] = await Promise.all([
      ctx.db.get(workspaceId),
      ctx.db.query("users").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).collect(),
      ctx.db.query("items").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).collect(),
      ctx.db.query("directives").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).collect(),
      ctx.db.query("scheduleItems").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).collect(),
      ctx.db.query("workflows").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).collect(),
      ctx.db.query("connectorActionLogs").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).collect(),
      ctx.db.query("auditEvents").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).collect(),
    ]);

    return {
      exportedAt: Date.now(),
      workspace,
      users,
      items,
      directives,
      scheduleItems,
      workflows,
      connectorActionLogs,
      auditEvents,
    };
  },
});
