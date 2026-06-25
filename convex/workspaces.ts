import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { actorFromIdentity, ensureUserWorkspace, requireCurrentUser, requireOwnedWorkspace } from "./authz";
import { recordAuditEvent } from "./audit";
import { getWorkspaceReadiness } from "./readiness";

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
    reviewExternalActions: v.boolean(),
    externalActionApprovalConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (current.user.role !== "Owner") throw new Error("Only a workspace owner can complete setup.");
    const workspaceId = current.workspaceId;
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) throw new Error("Workspace not found.");
    if (!args.reviewExternalActions && !args.externalActionApprovalConfirmed) {
      throw new Error("Enable external-action approval or confirm your external-action policy.");
    }

    const now = Date.now();
    await ctx.db.patch(workspaceId, {
      reviewExternalActions: args.reviewExternalActions,
      externalActionApprovalConfirmedAt: args.reviewExternalActions
        ? workspace.externalActionApprovalConfirmedAt
        : now,
    });
    const readiness = await getWorkspaceReadiness(ctx, { workspaceId, founder: current.user });
    if (!readiness.ready) throw new Error(readiness.blockingReason ?? "Finish workspace setup before opening FounderOS.");

    await ctx.db.patch(workspaceId, {
      onboardingConnectorIds: ["gmail", "google_calendar", "google_drive", "google_docs", "google_sheets", "github"],
      onboardingCompletedAt: now,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId,
      action: "workspace.onboarding_completed",
      resourceType: "workspace",
      resourceId: String(workspaceId),
      summary: "Onboarding completed.",
      metadata: { reviewExternalActions: args.reviewExternalActions, readinessGates: readiness.gates },
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
