import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  normalizePlainWorkerMessage,
  type TaskClassification,
} from "./taskRuntime";
import { itemKind, workflowKind, workflowStatus } from "./itemValidators";
import { actorFromIdentity, ensureDocWorkspace, requireCurrentUser, requireWorkspaceAccess } from "./authz";
import { recordAuditEvent } from "./audit";
import {
  buildWorkflowExecutionPlan,
  buildWorkflowObjective,
  workflowFromTemplate,
} from "./workflowRuntime";

const cadence = v.union(
  v.literal("once"),
  v.literal("daily"),
  v.literal("weekdays"),
  v.literal("weekly"),
);

const workflowInput = v.object({
  key: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("number"),
    v.literal("date"),
    v.literal("select"),
    v.literal("boolean"),
  ),
  required: v.boolean(),
  defaultValue: v.optional(v.any()),
  options: v.optional(v.array(v.string())),
});

const workflowStep = v.object({
  key: v.string(),
  title: v.string(),
  kind: v.string(),
  config: v.optional(v.any()),
  outputItemKind: v.optional(itemKind),
});

const workflowOutput = v.object({
  key: v.string(),
  label: v.string(),
  kind: itemKind,
  description: v.optional(v.string()),
});

const approvalRule = v.object({
  actionKind: v.union(
    v.literal("publish_preview"),
    v.literal("send_email"),
    v.literal("create_calendar_event"),
    v.literal("post_externally"),
    v.literal("spend_money"),
    v.literal("delete_data"),
    v.literal("change_live_asset"),
    v.literal("generic"),
  ),
  policy: v.union(v.literal("always"), v.literal("when_external"), v.literal("over_threshold")),
  threshold: v.optional(v.number()),
  description: v.optional(v.string()),
});

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function autonomyForClassification(classification: TaskClassification): 1 | 2 | 3 {
  if (classification.workerKind === "builder") return 3;
  if (classification.requiresReview) return 2;
  return 1;
}

async function chooseAssignedAgent(
  ctx: MutationCtx,
  classification: TaskClassification,
  workspaceId: Id<"workspaces">,
  preferredName?: string,
): Promise<Doc<"agents"> | null> {
  const departments = await ctx.db
    .query("departments")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const agents = (
    await Promise.all(
      departments.map((department) =>
        ctx.db
          .query("agents")
          .withIndex("by_department", (q) => q.eq("departmentId", department._id))
          .collect(),
      ),
    )
  ).flat();
  if (agents.length === 0) return null;
  if (preferredName) {
    const preferred = agents.find((agent) => agent.name === preferredName && agent.isActive);
    if (preferred) return preferred;
  }

  const preferredRouting: Record<TaskClassification["workerKind"], Array<Doc<"agents">["routingRequest"]>> = {
    builder: ["coding", "reasoning"],
    document: ["long-context", "reasoning", "triage"],
    design: ["creative", "reasoning"],
    communications: ["triage", "creative", "reasoning"],
    generic: ["triage", "reasoning"],
  };

  return (
    agents.find((agent) =>
      preferredRouting[classification.workerKind].includes(agent.routingRequest),
    ) ??
    agents.find((agent) => agent.isActive) ??
    agents[0]
  );
}

type WorkflowActor = {
  actorId: string;
  actorName: string;
  actorType: "user" | "worker" | "system";
};

export async function createWorkflowRun(
  ctx: MutationCtx,
  workflow: Doc<"workflows">,
  inputValues: Record<string, unknown>,
  trigger: "manual" | "schedule",
  actor: WorkflowActor,
  scheduleItemId?: Id<"scheduleItems">,
  scheduledFor?: number,
) {
  if (!workflow.workspaceId) throw new Error("Workflow workspace is missing.");
  const now = Date.now();
  const plan = buildWorkflowExecutionPlan({
    workflow,
    inputs: inputValues,
    trigger,
  });
  if (plan.steps.length === 0) throw new Error("Workflow must include at least one step.");

  const directiveId = await ctx.db.insert("directives", {
    workspaceId: workflow.workspaceId,
    title: plan.title,
    objective: plan.objective,
    status: "pending_spec",
  });

  const taskIds = new Map<string, Id<"tasks">>();
  const runIds: Id<"workRuns">[] = [];
  for (const step of plan.steps) {
    const config = metadataObject(workflow.steps.find((candidate) => candidate.key === step.key)?.config);
    const assignedAgent = await chooseAssignedAgent(
      ctx,
      step.classification,
      workflow.workspaceId,
      typeof config.assignedAgentName === "string" ? config.assignedAgentName : undefined,
    );
    const dependencies = step.dependencyKeys
      .map((key) => taskIds.get(key))
      .filter((taskId): taskId is Id<"tasks"> => Boolean(taskId));
    if (dependencies.length !== step.dependencyKeys.length) {
      throw new Error(`Workflow step "${step.key}" has an invalid dependency.`);
    }
    const taskId = await ctx.db.insert("tasks", {
      workspaceId: workflow.workspaceId,
      directiveId,
      workflowId: workflow._id,
      workflowStepKey: step.key,
      title: step.title,
      description: step.description,
      ...(assignedAgent ? { assignedAgentId: assignedAgent._id } : {}),
      status: "queued",
      autonomyLevel: autonomyForClassification(step.classification),
      dependencies,
      classification: step.classification,
      workerKind: step.classification.workerKind,
      localRouting: step.localRouting,
      retryCount: 0,
      updatedAt: now,
    });
    taskIds.set(step.key, taskId);

    const runId = await ctx.db.insert("workRuns", {
      workspaceId: workflow.workspaceId,
      directiveId,
      taskId,
      scheduleItemId,
      workflowId: workflow._id,
      workflowStepKey: step.key,
      scheduledFor,
      trigger,
      kind: step.classification.runKind,
      workerKind: step.classification.workerKind,
      classification: step.classification,
      localRouting: step.localRouting,
      status: "queued",
      title: step.title,
      summary: `Part of ${workflow.title}.`,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    });
    runIds.push(runId);

    await ctx.db.insert("workRunUpdates", {
      runId,
      message: normalizePlainWorkerMessage(`Queued: ${step.title}`),
      tone: "info",
      createdAt: now,
    });
  }

  const gatedRunId = runIds[0];
  const gatedTaskId = plan.steps[0] ? taskIds.get(plan.steps[0].key) : undefined;
  for (const rule of plan.approvalGates) {
    if (!gatedRunId) continue;
    await ctx.db.insert("approvalQueue", {
      workspaceId: workflow.workspaceId,
      type: "shadow_approval",
      directiveId,
      taskId: gatedTaskId,
      runId: gatedRunId,
      actionKind: rule.actionKind,
      actionTitle: `${workflow.title}: approval rule`,
      actionDescription: rule.description ?? "This workflow requires approval before this action.",
      status: "pending",
      createdAt: now,
      auditHistory: [
        {
          event: "requested",
          at: now,
          actor: actor.actorName,
          actionKind: rule.actionKind,
          message: "Workflow approval rule.",
        },
      ],
      autonomyLevel: 2,
    });
  }
  if (plan.approvalGates.length > 0 && gatedRunId) {
    await ctx.db.patch(gatedRunId, { status: "waiting_for_approval", updatedAt: now });
    if (gatedTaskId) await ctx.db.patch(gatedTaskId, { status: "shadow_pending", updatedAt: now });
    await ctx.db.patch(directiveId, { status: "awaiting_approval" });
  }

  await ctx.db.patch(workflow._id, {
    metadata: {
      ...metadataObject(workflow.metadata),
      lastRunAt: now,
      runCount: Number(metadataObject(workflow.metadata).runCount ?? 0) + 1,
    },
    updatedAt: now,
  });

  await recordAuditEvent(ctx, {
    ...actor,
    workspaceId: workflow.workspaceId,
    action: "workflow.run_queued",
    resourceType: "workflow",
    resourceId: String(workflow._id),
    summary: `Queued workflow: ${workflow.title}.`,
    metadata: { runIds, trigger, scheduleItemId },
  });

  return runIds[0];
}

export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const departments = await ctx.db
      .query("departments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const departmentIds = new Set(departments.map((department) => department._id));
    const workflows = await ctx.db
      .query("workflows")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const addedPlaybookIds = new Set(
      workflows
        .filter((workflow) => workflow.status !== "archived" && workflow.sourcePlaybookId)
        .map((workflow) => workflow.sourcePlaybookId),
    );
    return (await ctx.db.query("playbooks").collect())
      .filter((playbook) => departmentIds.has(playbook.departmentId) && playbook.isStarter && playbook.templateKey)
      .map((playbook) => ({
        key: playbook.templateKey!,
        title: playbook.name,
        description: playbook.description,
        isAdded: addedPlaybookIds.has(playbook._id),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  },
});

export const createFromTemplate = mutation({
  args: {
    templateKey: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const departments = await ctx.db
      .query("departments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", current.workspaceId))
      .collect();
    const departmentIds = new Set(departments.map((department) => department._id));
    const template = (await ctx.db
      .query("playbooks")
      .withIndex("by_template_key", (q) => q.eq("templateKey", args.templateKey))
      .collect())
      .find((playbook) => departmentIds.has(playbook.departmentId) && playbook.isStarter);
    if (!template) throw new Error("Starter workflow not found.");

    const now = Date.now();
    const definition = workflowFromTemplate(template, args.title);
    const workflowId = await ctx.db.insert("workflows", {
      workspaceId: current.workspaceId,
      sourcePlaybookId: template._id,
      ownerId: current.user._id,
      title: definition.title,
      description: definition.description,
      kind: definition.kind as Doc<"workflows">["kind"],
      status: "active",
      inputs: definition.inputs,
      steps: definition.steps,
      outputs: definition.outputs,
      approvalRules: definition.approvalRules,
      metadata: definition.metadata,
      createdAt: now,
      updatedAt: now,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "workflow.created_from_template",
      resourceType: "workflow",
      resourceId: String(workflowId),
      summary: `Added workflow: ${definition.title}.`,
      metadata: { templateKey: args.templateKey, sourcePlaybookId: template._id },
    });
    return workflowId;
  },
});

export const list = query({
  args: {
    status: v.optional(workflowStatus),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const status = args.status;
    const workflows = status
      ? await ctx.db
          .query("workflows")
          .withIndex("by_status", (q) => q.eq("workspaceId", workspaceId).eq("status", status))
          .collect()
      : await ctx.db
          .query("workflows")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
          .collect();
    const visible = args.includeArchived
      ? workflows
      : workflows.filter((workflow) => workflow.status !== "archived");

    return await Promise.all(
      visible
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (workflow) => {
          const schedules = await ctx.db
            .query("scheduleItems")
            .withIndex("by_workflow", (q) => q.eq("workflowId", workflow._id))
            .collect();
          const runs = await ctx.db
            .query("workRuns")
            .withIndex("by_workflow", (q) => q.eq("workflowId", workflow._id))
            .order("desc")
            .take(5);
          return {
            ...workflow,
            isPinned: Boolean(metadataObject(workflow.metadata).isPinned),
            schedules: schedules.filter(
              (schedule) => schedule.workspaceId === workspaceId && schedule.status !== "deleted",
            ),
            recentRuns: runs.filter((run) => run.workspaceId === workspaceId),
          };
        }),
    );
  },
});

export const save = mutation({
  args: {
    workflowId: v.optional(v.id("workflows")),
    title: v.string(),
    description: v.optional(v.string()),
    kind: workflowKind,
    status: workflowStatus,
    inputs: v.optional(v.array(workflowInput)),
    steps: v.array(workflowStep),
    outputs: v.optional(v.array(workflowOutput)),
    approvalRules: v.optional(v.array(approvalRule)),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const now = Date.now();
    const patch = {
      workspaceId: current.workspaceId,
      ownerId: current.user._id,
      title: args.title,
      description: args.description,
      kind: args.kind,
      status: args.status,
      inputs: args.inputs,
      steps: args.steps,
      outputs: args.outputs,
      approvalRules: args.approvalRules,
      metadata: args.metadata,
      updatedAt: now,
    };

    if (args.workflowId) {
      const existing = ensureDocWorkspace(await ctx.db.get(args.workflowId), current.workspaceId, "Workflow");
      await ctx.db.patch(args.workflowId, {
        ...patch,
        metadata: {
          ...metadataObject(existing.metadata),
          ...metadataObject(args.metadata),
        },
      });
      await recordAuditEvent(ctx, {
        ...actorFromIdentity(current.identity, current.user),
        workspaceId: current.workspaceId,
        action: "workflow.updated",
        resourceType: "workflow",
        resourceId: String(args.workflowId),
        summary: `Updated workflow: ${args.title}.`,
        metadata: { kind: args.kind, status: args.status },
      });
      return args.workflowId;
    }

    const workflowId = await ctx.db.insert("workflows", {
      ...patch,
      createdAt: now,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "workflow.created",
      resourceType: "workflow",
      resourceId: String(workflowId),
      summary: `Created workflow: ${args.title}.`,
      metadata: { kind: args.kind, status: args.status },
    });
    return workflowId;
  },
});

export const setPinned = mutation({
  args: {
    workflowId: v.id("workflows"),
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.workflowId);
    const current = await requireWorkspaceAccess(ctx, existing?.workspaceId, ["Owner", "Contributor"]);
    const workflow = ensureDocWorkspace(existing, current.workspaceId, "Workflow");
    await ctx.db.patch(args.workflowId, {
      metadata: {
        ...metadataObject(workflow.metadata),
        isPinned: args.isPinned,
      },
      updatedAt: Date.now(),
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: args.isPinned ? "workflow.pinned" : "workflow.unpinned",
      resourceType: "workflow",
      resourceId: String(args.workflowId),
      summary: `${args.isPinned ? "Pinned" : "Unpinned"} workflow: ${workflow.title}.`,
    });
  },
});

export const remove = mutation({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.workflowId);
    const current = await requireWorkspaceAccess(ctx, existing?.workspaceId, ["Owner", "Contributor"]);
    const workflow = ensureDocWorkspace(existing, current.workspaceId, "Workflow");
    await ctx.db.patch(args.workflowId, {
      status: "archived",
      updatedAt: Date.now(),
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "workflow.archived",
      resourceType: "workflow",
      resourceId: String(args.workflowId),
      summary: `Archived workflow: ${workflow.title}.`,
    });
  },
});

export const restore = mutation({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.workflowId);
    const current = await requireWorkspaceAccess(ctx, existing?.workspaceId, ["Owner", "Contributor"]);
    const workflow = ensureDocWorkspace(existing, current.workspaceId, "Workflow");
    await ctx.db.patch(args.workflowId, {
      status: "active",
      updatedAt: Date.now(),
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "workflow.restored",
      resourceType: "workflow",
      resourceId: String(args.workflowId),
      summary: `Restored workflow: ${workflow.title}.`,
    });
    return args.workflowId;
  },
});

export const run = mutation({
  args: {
    workflowId: v.id("workflows"),
    inputs: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.workflowId);
    const current = await requireWorkspaceAccess(ctx, existing?.workspaceId, ["Owner", "Contributor"]);
    const workflow = ensureDocWorkspace(existing, current.workspaceId, "Workflow");
    if (workflow.status === "archived") throw new Error("Workflow is archived.");
    return await createWorkflowRun(
      ctx,
      workflow,
      metadataObject(args.inputs),
      "manual",
      actorFromIdentity(current.identity, current.user),
    );
  },
});

export const schedule = mutation({
  args: {
    workflowId: v.id("workflows"),
    startAt: v.number(),
    cadence,
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingWorkflow = await ctx.db.get(args.workflowId);
    const current = await requireWorkspaceAccess(ctx, existingWorkflow?.workspaceId, ["Owner", "Contributor"]);
    const workflow = ensureDocWorkspace(existingWorkflow, current.workspaceId, "Workflow");
    const internalArea = await ctx.db
      .query("departments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", current.workspaceId))
      .first();
    const now = Date.now();
    const prompt = buildWorkflowObjective(workflow, {});

    const existing = await ctx.db
      .query("scheduleItems")
      .withIndex("by_workflow", (q) => q.eq("workflowId", args.workflowId))
      .collect();
    const active = existing.find((item) => item.workspaceId === current.workspaceId && item.status !== "deleted");
    if (active) {
      await ctx.db.patch(active._id, {
        workspaceId: current.workspaceId,
        status: "scheduled",
        startAt: args.startAt,
        nextRunAt: args.startAt,
        cadence: args.cadence,
        timezone: args.timezone,
        prompt,
        updatedAt: now,
      });
      await recordAuditEvent(ctx, {
        ...actorFromIdentity(current.identity, current.user),
        workspaceId: current.workspaceId,
        action: "workflow.schedule_updated",
        resourceType: "schedule",
        resourceId: String(active._id),
        summary: `Updated workflow schedule: ${workflow.title}.`,
        metadata: { workflowId: workflow._id, cadence: args.cadence, startAt: args.startAt },
      });
      return active._id;
    }

    const scheduleId = await ctx.db.insert("scheduleItems", {
      workspaceId: current.workspaceId,
      departmentId: internalArea?._id,
      workflowId: workflow._id,
      title: workflow.title,
      kind: "automation",
      status: "scheduled",
      startAt: args.startAt,
      prompt,
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
      action: "workflow.scheduled",
      resourceType: "schedule",
      resourceId: String(scheduleId),
      summary: `Scheduled workflow: ${workflow.title}.`,
      metadata: { workflowId: workflow._id, cadence: args.cadence, startAt: args.startAt },
    });
    return scheduleId;
  },
});

export const exportWorkflow = query({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const workflow = ensureDocWorkspace(await ctx.db.get(args.workflowId), workspaceId, "Workflow");
    const schedules = (
      await ctx.db
        .query("scheduleItems")
        .withIndex("by_workflow", (q) => q.eq("workflowId", workflow._id))
        .collect()
    ).filter((schedule) => schedule.workspaceId === workspaceId);
    const runs = (
      await ctx.db
        .query("workRuns")
        .withIndex("by_workflow", (q) => q.eq("workflowId", workflow._id))
        .collect()
    ).filter((run) => run.workspaceId === workspaceId);

    return {
      exportedAt: Date.now(),
      workflow,
      schedules,
      runs,
    };
  },
});
