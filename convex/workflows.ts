import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  classifyTaskObjective,
  normalizePlainWorkerMessage,
  type TaskClassification,
} from "./taskRuntime";
import { itemKind, workflowKind, workflowStatus } from "./itemValidators";

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
): Promise<Doc<"agents"> | null> {
  const agents = await ctx.db.query("agents").collect();
  if (agents.length === 0) return null;

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

function renderTemplate(value: string, inputs: Record<string, unknown>) {
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const input = inputs[key];
    if (input === undefined || input === null) return "";
    return String(input);
  });
}

function workflowPrompt(workflow: Doc<"workflows">, inputValues: Record<string, unknown>) {
  const inputLines = (workflow.inputs ?? [])
    .map((input) => {
      const value = inputValues[input.key] ?? input.defaultValue;
      return value === undefined || value === "" ? null : `${input.label}: ${String(value)}`;
    })
    .filter(Boolean);
  const stepLines = workflow.steps.map((step, index) => {
    const config = metadataObject(step.config);
    const prompt = typeof config.prompt === "string" ? renderTemplate(config.prompt, inputValues) : undefined;
    return `${index + 1}. ${step.title}${prompt ? ` - ${prompt}` : ""}`;
  });
  const outputLines = (workflow.outputs ?? []).map((output) => `- ${output.label}: ${output.description ?? output.kind}`);
  const approvalLines = (workflow.approvalRules ?? []).map((rule) => `- ${rule.actionKind}: ${rule.description ?? rule.policy}`);

  return [
    workflow.description ?? `Run the ${workflow.title} workflow.`,
    inputLines.length ? `Inputs:\n${inputLines.join("\n")}` : null,
    stepLines.length ? `Steps:\n${stepLines.join("\n")}` : null,
    outputLines.length ? `Expected outputs:\n${outputLines.join("\n")}` : null,
    approvalLines.length ? `Approval rules:\n${approvalLines.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function createWorkflowRun(
  ctx: MutationCtx,
  workflow: Doc<"workflows">,
  inputValues: Record<string, unknown>,
  trigger: "manual" | "schedule",
  scheduleItemId?: Id<"scheduleItems">,
) {
  const now = Date.now();
  const objective = workflowPrompt(workflow, inputValues);
  const title = trigger === "schedule" ? `Scheduled: ${workflow.title}` : workflow.title;
  const classification = classifyTaskObjective({ title, objective });
  const assignedAgent = await chooseAssignedAgent(ctx, classification);

  const directiveId = await ctx.db.insert("directives", {
    title,
    objective,
    status: "pending_spec",
  });

  const taskId = await ctx.db.insert("tasks", {
    directiveId,
    title,
    description: objective,
    ...(assignedAgent ? { assignedAgentId: assignedAgent._id } : {}),
    status: "queued",
    autonomyLevel: autonomyForClassification(classification),
    dependencies: [],
    classification,
    workerKind: classification.workerKind,
    retryCount: 0,
    updatedAt: now,
  });

  const runId = await ctx.db.insert("workRuns", {
    directiveId,
    taskId,
    scheduleItemId,
    workflowId: workflow._id,
    trigger,
    kind: classification.runKind,
    workerKind: classification.workerKind,
    classification,
    status: "queued",
    title,
    summary: `Started from workflow: ${workflow.title}.`,
    attemptCount: 0,
    maxAttempts: 3,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("workRunUpdates", {
    runId,
    message: normalizePlainWorkerMessage(`Queued workflow: ${workflow.title}`),
    tone: "info",
    createdAt: now,
  });

  for (const rule of workflow.approvalRules ?? []) {
    if (rule.policy !== "always") continue;
    await ctx.db.insert("approvalQueue", {
      type: "shadow_approval",
      directiveId,
      taskId,
      runId,
      actionKind: rule.actionKind,
      actionTitle: `${workflow.title}: approval rule`,
      actionDescription: rule.description ?? "This workflow requires approval before this action.",
      status: "pending",
      createdAt: now,
      auditHistory: [
        {
          event: "requested",
          at: now,
          actor: "FounderOS",
          actionKind: rule.actionKind,
          message: "Workflow approval rule.",
        },
      ],
      autonomyLevel: 2,
    });
  }

  await ctx.db.patch(workflow._id, {
    metadata: {
      ...metadataObject(workflow.metadata),
      lastRunAt: now,
      runCount: Number(metadataObject(workflow.metadata).runCount ?? 0) + 1,
    },
    updatedAt: now,
  });

  return runId;
}

export const list = query({
  args: {
    status: v.optional(workflowStatus),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const workflows = (await ctx.db.query("workflows").collect()).filter(
      (workflow) => !args.status || workflow.status === args.status,
    );
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
            schedules: schedules.filter((schedule) => schedule.status !== "deleted"),
            recentRuns: runs,
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
    const workspace = await ctx.db.query("workspaces").first();
    const now = Date.now();
    const patch = {
      workspaceId: workspace?._id,
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
      const existing = await ctx.db.get(args.workflowId);
      if (!existing) throw new Error("Workflow not found.");
      await ctx.db.patch(args.workflowId, {
        ...patch,
        metadata: {
          ...metadataObject(existing.metadata),
          ...metadataObject(args.metadata),
        },
      });
      return args.workflowId;
    }

    return await ctx.db.insert("workflows", {
      ...patch,
      createdAt: now,
    });
  },
});

export const setPinned = mutation({
  args: {
    workflowId: v.id("workflows"),
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) throw new Error("Workflow not found.");
    await ctx.db.patch(args.workflowId, {
      metadata: {
        ...metadataObject(workflow.metadata),
        isPinned: args.isPinned,
      },
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) throw new Error("Workflow not found.");
    await ctx.db.patch(args.workflowId, {
      status: "archived",
      updatedAt: Date.now(),
    });
  },
});

export const run = mutation({
  args: {
    workflowId: v.id("workflows"),
    inputs: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) throw new Error("Workflow not found.");
    if (workflow.status === "archived") throw new Error("Workflow is archived.");
    return await createWorkflowRun(ctx, workflow, metadataObject(args.inputs), "manual");
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
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) throw new Error("Workflow not found.");
    const workspace = await ctx.db.query("workspaces").first();
    const internalArea = await ctx.db.query("departments").first();
    const now = Date.now();
    const prompt = workflowPrompt(workflow, {});

    const existing = await ctx.db
      .query("scheduleItems")
      .withIndex("by_workflow", (q) => q.eq("workflowId", args.workflowId))
      .collect();
    const active = existing.find((item) => item.status !== "deleted");
    if (active) {
      await ctx.db.patch(active._id, {
        status: "scheduled",
        startAt: args.startAt,
        nextRunAt: args.startAt,
        cadence: args.cadence,
        timezone: args.timezone,
        prompt,
        updatedAt: now,
      });
      return active._id;
    }

    return await ctx.db.insert("scheduleItems", {
      workspaceId: workspace?._id,
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
  },
});
