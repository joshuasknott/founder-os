import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { actorFromIdentity, isAuthorizedWorkerToken, requireCurrentUser, requireWorkspaceAccess, workerActor } from "./authz";
import { recordAuditEvent } from "./audit";
import {
  appendApprovalAudit,
  approvalDecisionPatch,
  approvalDecisionRunPatch,
  approvalDecisionTaskStatus,
  approvalRequestRunPatch,
  approvedActionFallbackResult,
  labelForSensitiveActionKind,
  type ApprovalAuditEvent,
  type SensitiveActionKind,
} from "./taskRuntime";

const sensitiveActionKind = v.union(
  v.literal("publish_preview"),
  v.literal("send_email"),
  v.literal("create_calendar_event"),
  v.literal("post_externally"),
  v.literal("spend_money"),
  v.literal("delete_data"),
  v.literal("change_live_asset"),
  v.literal("generic"),
);

export const getPendingApprovals = query({
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const directives = await ctx.db
      .query("directives")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const directiveIds = new Set(directives.map((directive) => directive._id));
    return (await ctx.db
      .query("approvalQueue")
      .filter((q) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "shadow_pending")),
      )
      .collect()).filter((approval) => directiveIds.has(approval.directiveId));
  },
});

export const createForRun = mutation({
  args: {
    directiveId: v.id("directives"),
    runId: v.id("workRuns"),
    actionKind: sensitiveActionKind,
    actionTitle: v.string(),
    actionDescription: v.optional(v.string()),
    actionPayload: v.optional(v.any()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (run.directiveId !== args.directiveId) {
      throw new Error("Approval request does not match this work item.");
    }
    const directive = await ctx.db.get(args.directiveId);
    const workspaceId = run.workspaceId ?? directive?.workspaceId;
    if (!workspaceId) throw new Error("Workspace not found.");
    const workerAuthorized = isAuthorizedWorkerToken(args.workerToken);
    const current = workerAuthorized ? null : await requireWorkspaceAccess(ctx, workspaceId, ["Owner", "Contributor"]);
    const actor = current ? actorFromIdentity(current.identity, current.user) : workerActor("worker");

    const now = Date.now();
    const existing = await ctx.db
      .query("approvalQueue")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .filter((q) =>
        q.and(
          q.eq(q.field("runId"), args.runId),
          q.eq(q.field("actionKind"), args.actionKind),
          q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "shadow_pending")),
        ),
      )
      .first();
    if (existing) return existing._id;

    await ctx.db.patch(args.runId, approvalRequestRunPatch(now));
    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: "shadow_pending",
        updatedAt: now,
      });
    }
    await ctx.db.patch(args.directiveId, { status: "awaiting_approval" });

    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: `Waiting for approval: ${args.actionTitle}`,
      tone: "blocked",
      createdAt: now,
    });

    const approvalId = await ctx.db.insert("approvalQueue", {
      type: "integration_gate",
      directiveId: args.directiveId,
      runId: args.runId,
      actionKind: args.actionKind,
      actionTitle: args.actionTitle,
      actionDescription: args.actionDescription,
      actionPayload: args.actionPayload,
      status: "pending",
      autonomyLevel: 3,
      createdAt: now,
      auditHistory: [
        {
          event: "requested",
          at: now,
          actor: "FounderOS",
          actionKind: args.actionKind,
          message: args.actionTitle,
        },
      ],
    });
    await recordAuditEvent(ctx, {
      ...actor,
      workspaceId,
      action: "approval.requested",
      resourceType: "approval",
      resourceId: String(approvalId),
      summary: `Approval requested: ${args.actionTitle}.`,
      metadata: { runId: args.runId, actionKind: args.actionKind },
    });
    return approvalId;
  },
});

export const getApprovedActionForRun = query({
  args: { runId: v.id("workRuns"), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (!isAuthorizedWorkerToken(args.workerToken)) {
      const directive = await ctx.db.get(run.directiveId);
      const workspaceId = run.workspaceId ?? directive?.workspaceId;
      if (!workspaceId) throw new Error("Workspace not found.");
      await requireWorkspaceAccess(ctx, workspaceId);
    }
    const approvals = await ctx.db
      .query("approvalQueue")
      .filter((q) =>
        q.and(
          q.eq(q.field("runId"), args.runId),
          q.eq(q.field("status"), "approved"),
        ),
      )
      .collect();

    const openApproval = approvals
      .filter((approval) => approval.handledAt === undefined)
      .sort((a, b) => (a.decidedAt ?? a._creationTime) - (b.decidedAt ?? b._creationTime))[0];

    if (!openApproval) return null;

    return {
      approvalId: openApproval._id,
      actionKind: openApproval.actionKind,
      actionTitle: openApproval.actionTitle,
      actionDescription: openApproval.actionDescription,
      actionPayload: openApproval.actionPayload,
    };
  },
});

export const markApprovedActionHandled = mutation({
  args: { approvalId: v.id("approvalQueue"), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval request not found.");
    if (approval.handledAt) return args.approvalId;
    const directive = await ctx.db.get(approval.directiveId);
    const workspaceId = directive?.workspaceId;
    if (!workspaceId) throw new Error("Workspace not found.");
    if (!isAuthorizedWorkerToken(args.workerToken)) {
      await requireWorkspaceAccess(ctx, workspaceId, ["Owner", "Contributor"]);
    }

    const now = Date.now();
    const actionKind = approval.actionKind as SensitiveActionKind | undefined;
    await ctx.db.patch(args.approvalId, {
      handledAt: now,
      auditHistory: appendApprovalAudit(
        approval.auditHistory as ApprovalAuditEvent[] | undefined,
        {
          event: "handled",
          at: now,
          actor: "FounderOS",
          actionKind,
          message: `Resumed: ${approval.actionTitle ?? labelForSensitiveActionKind(actionKind)}`,
        },
      ),
    });
    await recordAuditEvent(ctx, {
      ...workerActor("worker"),
      workspaceId,
      action: "approval.handled",
      resourceType: "approval",
      resourceId: String(args.approvalId),
      summary: `Handled approval: ${approval.actionTitle ?? "Approval"}.`,
    });

    return args.approvalId;
  },
});

export const approve = mutation({
  args: { approvalId: v.id("approvalQueue") },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval request not found.");
    const directive = await ctx.db.get(approval.directiveId);
    if (!directive?.workspaceId) throw new Error("Workspace not found.");
    const current = await requireWorkspaceAccess(ctx, directive.workspaceId, ["Owner"]);
    if (approval.status === "approved") return args.approvalId;
    if (approval.status === "denied") throw new Error("This approval was already declined.");

    const now = Date.now();
    const actionKind = approval.actionKind as SensitiveActionKind | undefined;
    await ctx.db.patch(args.approvalId, approvalDecisionPatch({
      decision: "approved",
      now,
      actionKind,
      auditHistory: approval.auditHistory as ApprovalAuditEvent[] | undefined,
    }));

    if (approval.runId) {
      const run = await ctx.db.get(approval.runId);
      await ctx.db.patch(approval.runId, approvalDecisionRunPatch("approved", now));
      if (run?.taskId) {
        await ctx.db.patch(run.taskId, {
          status: approvalDecisionTaskStatus("approved"),
          updatedAt: now,
        });
      }
      await ctx.db.patch(approval.directiveId, {
        status: "in_progress",
      });
      await ctx.db.insert("workRunUpdates", {
        runId: approval.runId,
        message: `Approved: ${approval.actionTitle ?? "Continue this step"}`,
        tone: "progress",
        createdAt: now,
      });
    }

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: directive.workspaceId,
      action: "approval.approved",
      resourceType: "approval",
      resourceId: String(args.approvalId),
      summary: `Approved: ${approval.actionTitle ?? "Approval"}.`,
      metadata: { actionKind },
    });

    return args.approvalId;
  },
});

export const resumeApprovedActionWithoutConnector = mutation({
  args: {
    approvalId: v.id("approvalQueue"),
    runId: v.id("workRuns"),
    leaseId: v.optional(v.string()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval request not found.");
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found.");
    if (approval.status !== "approved") throw new Error("This action has not been approved.");
    if (approval.runId !== args.runId) throw new Error("Approval does not belong to this run.");
    if (run.leaseId !== args.leaseId) throw new Error("This work is already being handled.");
    const workspaceId = run.workspaceId ?? (await ctx.db.get(run.directiveId))?.workspaceId;
    if (!workspaceId) throw new Error("Workspace not found.");
    if (!isAuthorizedWorkerToken(args.workerToken)) {
      await requireWorkspaceAccess(ctx, workspaceId, ["Owner", "Contributor"]);
    }

    const now = Date.now();
    const result = approvedActionFallbackResult({
      actionKind: approval.actionKind,
      actionTitle: approval.actionTitle,
      actionDescription: approval.actionDescription,
    });

    await ctx.db.patch(args.runId, {
      status: "needs_review",
      leaseId: undefined,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      summary: result.summary,
      updatedAt: now,
    });
    if (run.taskId) {
      await ctx.db.patch(run.taskId, {
        status: "shadow_pending",
        updatedAt: now,
      });
    }
    await ctx.db.patch(args.approvalId, {
      handledAt: approval.handledAt ?? now,
      auditHistory: appendApprovalAudit(
        approval.auditHistory as ApprovalAuditEvent[] | undefined,
        {
          event: "handled",
          at: now,
          actor: "FounderOS",
          actionKind: approval.actionKind as SensitiveActionKind | undefined,
          message: "No live connection was available, so no external action was performed.",
        },
      ),
    });
    await ctx.db.insert("workRunUpdates", {
      runId: args.runId,
      message: result.summary,
      tone: "review",
      createdAt: now,
    });
    await recordAuditEvent(ctx, {
      ...workerActor("worker"),
      workspaceId,
      action: "approval.resumed_without_connector",
      resourceType: "approval",
      resourceId: String(args.approvalId),
      summary: "Approved action returned to review without external connector action.",
    });

    return args.runId;
  },
});

export const deny = mutation({
  args: { approvalId: v.id("approvalQueue") },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval request not found.");
    const directive = await ctx.db.get(approval.directiveId);
    if (!directive?.workspaceId) throw new Error("Workspace not found.");
    const current = await requireWorkspaceAccess(ctx, directive.workspaceId, ["Owner"]);
    if (approval.status === "denied") return args.approvalId;
    if (approval.status === "approved") throw new Error("This approval was already approved.");

    const now = Date.now();
    const actionKind = approval.actionKind as SensitiveActionKind | undefined;
    await ctx.db.patch(args.approvalId, approvalDecisionPatch({
      decision: "denied",
      now,
      actionKind,
      auditHistory: approval.auditHistory as ApprovalAuditEvent[] | undefined,
    }));

    if (approval.runId) {
      const run = await ctx.db.get(approval.runId);
      await ctx.db.patch(approval.runId, approvalDecisionRunPatch("denied", now));
      if (run?.taskId) {
        await ctx.db.patch(run.taskId, {
          status: approvalDecisionTaskStatus("denied"),
          updatedAt: now,
        });
      }
      await ctx.db.patch(approval.directiveId, {
        status: "blocked",
      });
      await ctx.db.insert("workRunUpdates", {
        runId: approval.runId,
        message: `Declined: ${approval.actionTitle ?? "Requested step"}`,
        tone: "blocked",
        createdAt: now,
      });
    }

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: directive.workspaceId,
      action: "approval.denied",
      resourceType: "approval",
      resourceId: String(args.approvalId),
      summary: `Declined: ${approval.actionTitle ?? "Approval"}.`,
      metadata: { actionKind },
    });

    return args.approvalId;
  },
});
