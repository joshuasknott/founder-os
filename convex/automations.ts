import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { actorFromIdentity, ensureDocWorkspace, isAuthorizedWorkerToken, requireCurrentUser, requireWorkspaceAccess, workerActor } from "./authz";
import { recordAuditEvent } from "./audit";
import {
  nextScheduledRunAt,
  scheduleIsDue,
  type ScheduleCadence,
} from "./taskRuntime";
import { createWorkflowRun } from "./workflows";

const cadence = v.union(
  v.literal("once"),
  v.literal("daily"),
  v.literal("weekdays"),
  v.literal("weekly"),
);

async function createScheduleRun(
  ctx: MutationCtx,
  schedule: Doc<"scheduleItems">,
  trigger: "manual" | "schedule",
) {
  if (!schedule.prompt) throw new Error("Schedule prompt is missing.");
  if (schedule.status !== "scheduled") throw new Error("Schedule is paused.");
  if (!schedule.workspaceId) throw new Error("Schedule workspace is missing.");

  const now = Date.now();
  let workflow = schedule.workflowId ? await ctx.db.get(schedule.workflowId) : null;
  if (!workflow) {
    const workflowId = await ctx.db.insert("workflows", {
      workspaceId: schedule.workspaceId,
      title: schedule.title,
      description: schedule.prompt,
      kind: "automation",
      status: "active",
      inputs: [],
      steps: [
        {
          key: "run_request",
          title: schedule.title,
          kind: "prompt",
          config: { prompt: schedule.prompt },
          outputItemKind: "task_output",
        },
      ],
      outputs: [
        {
          key: "result",
          label: "Saved output",
          kind: "task_output",
          description: "The saved result from this scheduled workflow.",
        },
      ],
      approvalRules: [],
      metadata: { source: "legacy_schedule_migration" },
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(schedule._id, { workflowId, updatedAt: now });
    workflow = await ctx.db.get(workflowId);
  }
  if (!workflow) throw new Error("Schedule workflow is missing.");
  const runId = await createWorkflowRun(
    ctx,
    workflow,
    {},
    trigger === "schedule" ? "schedule" : "manual",
    workerActor(trigger === "manual" ? "founder" : "schedule-runner"),
    schedule._id,
    schedule.nextRunAt ?? schedule.startAt,
  );
  if (!runId) throw new Error("Schedule workflow has no steps.");

  const cadenceValue = (schedule.cadence ?? "once") as ScheduleCadence;
  const nextRunAt = nextScheduledRunAt({
    cadence: cadenceValue,
    currentRunAt: schedule.nextRunAt ?? schedule.startAt,
    now,
  });

  await ctx.db.patch(schedule._id, {
    status: nextRunAt ? "scheduled" : "done",
    lastRunAt: now,
    nextRunAt,
    runCount: (schedule.runCount ?? 0) + 1,
    updatedAt: now,
  });

  await recordAuditEvent(ctx, {
    ...workerActor(trigger === "manual" ? "user" : "schedule-runner"),
    workspaceId: schedule.workspaceId,
    action: "schedule.run_queued",
    resourceType: "schedule",
    resourceId: String(schedule._id),
    summary: `Queued scheduled workflow: ${schedule.title}.`,
    metadata: { runId, trigger },
  });

  return runId;
}

async function runDueSchedulesWithLimit(
  ctx: MutationCtx,
  limit: number,
) {
  const now = Date.now();
  const due = await ctx.db
    .query("scheduleItems")
    .withIndex("by_next_run", (q) => q.eq("status", "scheduled"))
    .take(limit);
  const runIds: Id<"workRuns">[] = [];

  for (const item of due) {
    if (!scheduleIsDue({ status: item.status, nextRunAt: item.nextRunAt, now })) continue;
    runIds.push(await createScheduleRun(ctx, item, "schedule"));
  }

  return runIds;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const items = await ctx.db
      .query("scheduleItems")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const schedules = items
      .filter((item) => item.kind === "automation" && item.status !== "deleted")
      .sort((a, b) => (a.nextRunAt ?? a.startAt) - (b.nextRunAt ?? b.startAt));

    return await Promise.all(
      schedules.map(async (item) => {
        const runs = await ctx.db
          .query("workRuns")
          .withIndex("by_schedule", (q) => q.eq("scheduleItemId", item._id))
          .order("desc")
          .take(5);
        const history = await Promise.all(
          runs.map(async (run) => {
            const latestUpdate = await ctx.db
              .query("workRunUpdates")
              .withIndex("by_run", (q) => q.eq("runId", run._id))
              .order("desc")
              .first();
            const artifact = await ctx.db
              .query("workArtifacts")
              .withIndex("by_run", (q) => q.eq("runId", run._id))
              .first();
            const libraryItemId = run.outputItemId ?? artifact?.libraryItemId;

            return {
              id: run._id,
              title: run.title,
              status: run.status,
              trigger: run.trigger,
              summary: run.summary,
              latestUpdate: latestUpdate?.message ?? run.failureReason,
              libraryItemId,
              libraryHref: libraryItemId ? `/library/${libraryItemId}` : undefined,
              createdAt: run.createdAt,
              updatedAt: run.updatedAt,
              completedAt: run.completedAt,
            };
          }),
        );

        return { ...item, history };
      }),
    );
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    prompt: v.string(),
    startAt: v.number(),
    cadence,
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const internalArea = await ctx.db
      .query("departments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", current.workspaceId))
      .first();
    const now = Date.now();

    const workflowId = await ctx.db.insert("workflows", {
      workspaceId: current.workspaceId,
      title: args.title,
      description: args.prompt,
      kind: "automation",
      status: "active",
      trigger: {
        type: "schedule",
        cadence: args.cadence,
        startAt: args.startAt,
        timezone: args.timezone,
      },
      inputs: [
        {
          key: "prompt",
          label: "Prompt",
          type: "text",
          required: true,
          defaultValue: args.prompt,
        },
      ],
      steps: [
        {
          key: "run_prompt",
          title: "Run prompt",
          kind: "prompt",
          config: { prompt: args.prompt },
          outputItemKind: "task_output",
        },
      ],
      outputs: [
        {
          key: "result",
          label: "Scheduled result",
          kind: "task_output",
          description: "The saved output from this scheduled workflow.",
        },
      ],
      approvalRules: [],
      metadata: { source: "schedules" },
      createdAt: now,
      updatedAt: now,
    });

    const scheduleId = await ctx.db.insert("scheduleItems", {
      workspaceId: current.workspaceId,
      departmentId: internalArea?._id,
      workflowId,
      title: args.title,
      kind: "automation",
      status: "scheduled",
      startAt: args.startAt,
      prompt: args.prompt,
      cadence: args.cadence,
      timezone: args.timezone,
      nextRunAt: args.startAt,
      runCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "schedule.created",
      resourceType: "schedule",
      resourceId: String(scheduleId),
      summary: `Created schedule: ${args.title}.`,
      metadata: { workflowId, cadence: args.cadence, startAt: args.startAt },
    });
    return scheduleId;
  },
});

export const remove = mutation({
  args: { automationId: v.id("scheduleItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.automationId);
    if (!item) throw new Error("Schedule not found.");
    const current = await requireWorkspaceAccess(ctx, item.workspaceId, ["Owner", "Contributor"]);
    const now = Date.now();

    await ctx.db.patch(args.automationId, {
      status: "deleted",
      deletedAt: now,
      updatedAt: now,
    });

    if (item.workflowId) {
      await ctx.db.patch(item.workflowId, {
        status: "archived",
        updatedAt: now,
      });
    }
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: item.workspaceId,
      action: "schedule.archived",
      resourceType: "schedule",
      resourceId: String(args.automationId),
      summary: `Archived schedule: ${item.title}.`,
    });
  },
});

export const restore = mutation({
  args: { automationId: v.id("scheduleItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.automationId);
    if (!item) throw new Error("Schedule not found.");
    const current = await requireWorkspaceAccess(ctx, item.workspaceId, ["Owner", "Contributor"]);
    const now = Date.now();

    await ctx.db.patch(args.automationId, {
      status: "scheduled",
      deletedAt: undefined,
      nextRunAt: item.nextRunAt && item.nextRunAt > now ? item.nextRunAt : item.startAt,
      updatedAt: now,
    });

    if (item.workflowId) {
      await ctx.db.patch(item.workflowId, {
        status: "active",
        updatedAt: now,
      });
    }

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: item.workspaceId,
      action: "schedule.restored",
      resourceType: "schedule",
      resourceId: String(args.automationId),
      summary: `Restored schedule: ${item.title}.`,
    });
    return args.automationId;
  },
});

export const pause = mutation({
  args: { automationId: v.id("scheduleItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.automationId);
    if (!item) throw new Error("Schedule not found.");
    const current = await requireWorkspaceAccess(ctx, item.workspaceId, ["Owner", "Contributor"]);
    const now = Date.now();
    await ctx.db.patch(args.automationId, {
      status: "paused",
      updatedAt: now,
    });
    if (item.workflowId) {
      await ctx.db.patch(item.workflowId, {
        status: "paused",
        updatedAt: now,
      });
    }
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: item.workspaceId,
      action: "schedule.paused",
      resourceType: "schedule",
      resourceId: String(args.automationId),
      summary: `Paused schedule: ${item.title}.`,
    });
  },
});

export const resume = mutation({
  args: { automationId: v.id("scheduleItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.automationId);
    if (!item) throw new Error("Schedule not found.");
    const current = await requireWorkspaceAccess(ctx, item.workspaceId, ["Owner", "Contributor"]);
    const now = Date.now();
    await ctx.db.patch(args.automationId, {
      status: "scheduled",
      nextRunAt: item.nextRunAt && item.nextRunAt > now ? item.nextRunAt : now,
      updatedAt: now,
    });
    if (item.workflowId) {
      await ctx.db.patch(item.workflowId, {
        status: "active",
        updatedAt: now,
      });
    }
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: item.workspaceId,
      action: "schedule.resumed",
      resourceType: "schedule",
      resourceId: String(args.automationId),
      summary: `Resumed schedule: ${item.title}.`,
    });
  },
});

export const runNow = mutation({
  args: { automationId: v.id("scheduleItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.automationId);
    if (!item) throw new Error("Schedule not found.");
    ensureDocWorkspace(item, (await requireCurrentUser(ctx)).workspaceId, "Schedule");
    return await createScheduleRun(ctx, item, "manual");
  },
});

export const runDueSchedules = mutation({
  args: { limit: v.optional(v.number()), workerToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!isAuthorizedWorkerToken(args.workerToken)) {
      throw new Error("Worker authorization required.");
    }
    return await runDueSchedulesWithLimit(ctx, args.limit ?? 20);
  },
});

export const runDueSchedulesFromCron = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await runDueSchedulesWithLimit(ctx, args.limit ?? 20);
  },
});

export const exportSchedule = query({
  args: { automationId: v.id("scheduleItems") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const item = ensureDocWorkspace(await ctx.db.get(args.automationId), workspaceId, "Schedule");
    const runs = await ctx.db
      .query("workRuns")
      .withIndex("by_schedule", (q) => q.eq("scheduleItemId", args.automationId))
      .collect();
    return {
      exportedAt: Date.now(),
      schedule: item,
      runs,
    };
  },
});
