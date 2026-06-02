import {
  classifyTaskObjective,
  founderVisibleStatusForRun,
  localRoutingForRun,
  type FounderVisibleWorkStatus,
  type OutputItemKind,
  type SensitiveActionKind,
  type WorkRunStatus,
} from "./taskRuntime";

export type WorkflowInput = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  required: boolean;
  defaultValue?: unknown;
  options?: string[];
};

export type WorkflowStep = {
  key: string;
  title: string;
  kind: string;
  config?: unknown;
  outputItemKind?: OutputItemKind;
};

export type WorkflowOutput = {
  key: string;
  label: string;
  kind: OutputItemKind;
  description?: string;
};

export type WorkflowApprovalRule = {
  actionKind: SensitiveActionKind;
  policy: "always" | "when_external" | "over_threshold";
  threshold?: number;
  description?: string;
};

export type WorkflowDefinition = {
  title: string;
  description?: string;
  inputs?: WorkflowInput[];
  steps: WorkflowStep[];
  outputs?: WorkflowOutput[];
  approvalRules?: WorkflowApprovalRule[];
  metadata?: unknown;
};

export type WorkflowTemplate = {
  name: string;
  description: string;
  templateKey?: string;
  workflowKind?: string;
  inputs?: WorkflowInput[];
  outputs?: WorkflowOutput[];
  approvalRules?: WorkflowApprovalRule[];
  metadata?: unknown;
  taskMatrix: Array<{
    key?: string;
    title: string;
    descriptionTemplate: string;
    assignedAgentId: string;
    autonomyLevel: number;
    dependencies: string[];
    kind?: string;
    outputItemKind?: OutputItemKind;
  }>;
};

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function renderWorkflowTemplate(value: string, inputs: Record<string, unknown>) {
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const input = inputs[key];
    return input === undefined || input === null ? "" : String(input);
  });
}

export function workflowFromTemplate(template: WorkflowTemplate, title?: string) {
  return {
    title: title?.trim() || template.name,
    description: template.description,
    kind: template.workflowKind ?? "process",
    inputs: template.inputs ?? [],
    steps: template.taskMatrix.map((task, index) => ({
      key: task.key ?? `step_${index + 1}`,
      title: task.title,
      kind: task.kind ?? "prompt",
      config: {
        prompt: task.descriptionTemplate,
        assignedAgentName: task.assignedAgentId,
        autonomyLevel: task.autonomyLevel,
        dependencies: task.dependencies,
      },
      outputItemKind: task.outputItemKind,
    })),
    outputs: template.outputs ?? [],
    approvalRules: template.approvalRules ?? [],
    metadata: {
      ...metadataObject(template.metadata),
      templateKey: template.templateKey,
      source: "starter_template",
    },
  };
}

export function buildWorkflowObjective(
  workflow: WorkflowDefinition,
  inputValues: Record<string, unknown>,
) {
  const inputs = Object.fromEntries(
    (workflow.inputs ?? []).map((input) => [
      input.key,
      inputValues[input.key] ?? input.defaultValue,
    ]),
  );
  const inputLines = (workflow.inputs ?? [])
    .map((input) => {
      const value = inputs[input.key];
      return value === undefined || value === "" ? null : `${input.label}: ${String(value)}`;
    })
    .filter(Boolean);
  const stepLines = workflow.steps.map((step, index) => {
    const config = metadataObject(step.config);
    const prompt = typeof config.prompt === "string"
      ? renderWorkflowTemplate(config.prompt, inputs)
      : undefined;
    return `${index + 1}. ${step.title}${prompt ? ` - ${prompt}` : ""}`;
  });
  const outputLines = (workflow.outputs ?? [])
    .map((output) => `- ${output.label}: ${output.description ?? output.kind}`);
  const approvalLines = (workflow.approvalRules ?? [])
    .map((rule) => `- ${rule.actionKind}: ${rule.description ?? rule.policy}`);

  return [
    workflow.description ?? `Run ${workflow.title}.`,
    inputLines.length ? `Inputs:\n${inputLines.join("\n")}` : null,
    stepLines.length ? `Steps:\n${stepLines.join("\n")}` : null,
    outputLines.length ? `Expected outputs:\n${outputLines.join("\n")}` : null,
    approvalLines.length ? `Approval rules:\n${approvalLines.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildWorkflowExecutionPlan(args: {
  workflow: WorkflowDefinition;
  inputs?: Record<string, unknown>;
  trigger: "manual" | "schedule";
}) {
  const inputs = Object.fromEntries(
    (args.workflow.inputs ?? []).map((input) => [
      input.key,
      args.inputs?.[input.key] ?? input.defaultValue,
    ]),
  );
  const objective = buildWorkflowObjective(args.workflow, inputs);
  const workflowTitle = args.workflow.title;
  const title = args.trigger === "schedule" ? `Scheduled: ${workflowTitle}` : workflowTitle;

  return {
    title,
    objective,
    steps: args.workflow.steps.map((step, index) => {
      const config = metadataObject(step.config);
      const description = typeof config.prompt === "string"
        ? renderWorkflowTemplate(config.prompt, inputs)
        : step.title;
      const dependencyKeys = Array.isArray(config.dependencies)
        ? config.dependencies.map(String)
        : index > 0
          ? [args.workflow.steps[index - 1].key]
          : [];
      const stepTitle = args.trigger === "schedule" ? `Scheduled: ${step.title}` : step.title;
      const classification = classifyTaskObjective({
        title: stepTitle,
        objective: description,
      });

      return {
        key: step.key,
        title: stepTitle,
        description,
        dependencyKeys,
        classification,
        localRouting: localRoutingForRun({
          kind: classification.runKind,
          title: stepTitle,
          objective: description,
          classification,
        }),
        outputItemKind: step.outputItemKind,
      };
    }),
    approvalGates: (args.workflow.approvalRules ?? []).filter((rule) => rule.policy === "always"),
  };
}

export function taskDependenciesAreComplete(
  task: { dependencies?: string[] } | null | undefined,
  tasksById: Map<string, { status: string }>,
) {
  return (task?.dependencies ?? []).every(
    (dependencyId) => tasksById.get(String(dependencyId))?.status === "completed",
  );
}

export function projectFounderVisibleWorkflowStatus(
  runs: Array<{ status: WorkRunStatus; outputItemId?: unknown }>,
) {
  const counts = {
    total: runs.length,
    completed: runs.filter((run) => run.status === "completed").length,
    savedOutputs: runs.filter((run) => run.outputItemId).length,
  };
  const statusPriority: WorkRunStatus[] = [
    "waiting_for_approval",
    "needs_review",
    "failed",
    "stopped",
    "working",
    "queued",
    "completed",
  ];
  const status = statusPriority.find((candidate) =>
    runs.some((run) => run.status === candidate),
  ) ?? "queued";

  return {
    status: founderVisibleStatusForRun(status) as FounderVisibleWorkStatus,
    progress: counts,
    progressLabel: `${counts.completed} of ${counts.total} steps done`,
  };
}
