"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  CalendarClock,
  Clock3,
  Edit3,
  Loader2,
  Pin,
  PlayCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

type WorkflowKind =
  | "automation"
  | "playbook"
  | "checklist"
  | "process"
  | "research"
  | "task_pipeline"
  | "integration";
type WorkflowStatus = "draft" | "active" | "paused" | "archived";
type ItemKind =
  | "created_output"
  | "upload"
  | "website"
  | "deck"
  | "doc"
  | "email"
  | "contact"
  | "company"
  | "decision"
  | "research"
  | "automation"
  | "tool"
  | "task_output"
  | "document"
  | "file"
  | "internal_tool"
  | "presentation"
  | "conversation"
  | "record"
  | "brief"
  | "plan";
type ApprovalAction =
  | "publish_preview"
  | "send_email"
  | "create_calendar_event"
  | "post_externally"
  | "spend_money"
  | "delete_data"
  | "change_live_asset"
  | "generic";

type WorkflowInput = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean";
  required: boolean;
  defaultValue?: unknown;
  options?: string[];
};

type WorkflowStep = {
  key: string;
  title: string;
  kind: string;
  config?: { prompt?: string };
  outputItemKind?: ItemKind;
};

type WorkflowOutput = {
  key: string;
  label: string;
  kind: ItemKind;
  description?: string;
};

type WorkflowApprovalRule = {
  actionKind: ApprovalAction;
  policy: "always" | "when_external" | "over_threshold";
  threshold?: number;
  description?: string;
};

type WorkflowRow = Doc<"workflows"> & {
  isPinned: boolean;
  schedules: Doc<"scheduleItems">[];
  recentRuns: Doc<"workRuns">[];
};

const emptyWorkflow = {
  title: "",
  description: "",
  kind: "process" as WorkflowKind,
  status: "draft" as WorkflowStatus,
  inputsText: "brief:Brief:text:required",
  stepsText: "draft:Draft the output:prompt:Use {{brief}} to prepare a clear business-ready draft.",
  outputsText: "draft:Draft:doc:Prepared workflow output",
  approvalsText: "send_email:always:Approve before external email is sent.",
  scheduleTime: "09:00",
  scheduleCadence: "weekly" as "daily" | "weekdays" | "weekly",
};

function formatTime(value?: number) {
  if (!value) return "Not run yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function startAtFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 9, minutes || 0, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date.getTime();
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseInputs(value: string): WorkflowInput[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, label, type = "text", required, options] = line.split(":");
      return {
        key: key.trim(),
        label: (label ?? key).trim(),
        type: (["text", "number", "date", "select", "boolean"].includes(type) ? type : "text") as WorkflowInput["type"],
        required: required?.trim() === "required",
        options: options ? options.split(",").map((option) => option.trim()).filter(Boolean) : undefined,
      };
    });
}

function parseSteps(value: string): WorkflowStep[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [key, title, kind = "prompt", ...promptParts] = line.split(":");
      return {
        key: (key || `step_${index + 1}`).trim(),
        title: (title || key || `Step ${index + 1}`).trim(),
        kind: kind.trim(),
        config: { prompt: promptParts.join(":").trim() },
        outputItemKind: "task_output" as ItemKind,
      };
    });
}

function parseOutputs(value: string): WorkflowOutput[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, label, kind = "doc", ...description] = line.split(":");
      return {
        key: key.trim(),
        label: (label ?? key).trim(),
        kind: kind.trim() as ItemKind,
        description: description.join(":").trim() || undefined,
      };
    });
}

function parseApprovals(value: string): WorkflowApprovalRule[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [actionKind = "generic", policy = "always", ...description] = line.split(":");
      return {
        actionKind: actionKind.trim() as ApprovalAction,
        policy: (["always", "when_external", "over_threshold"].includes(policy) ? policy : "always") as WorkflowApprovalRule["policy"],
        description: description.join(":").trim() || undefined,
      };
    });
}

function serializeInputs(inputs?: WorkflowInput[]) {
  return (inputs ?? [])
    .map((input) => `${input.key}:${input.label}:${input.type}:${input.required ? "required" : "optional"}${input.options?.length ? `:${input.options.join(",")}` : ""}`)
    .join("\n");
}

function serializeSteps(steps?: WorkflowStep[]) {
  return (steps ?? [])
    .map((step) => `${step.key}:${step.title}:${step.kind}:${typeof step.config?.prompt === "string" ? step.config.prompt : ""}`)
    .join("\n");
}

function serializeOutputs(outputs?: WorkflowOutput[]) {
  return (outputs ?? [])
    .map((output) => `${output.key}:${output.label}:${output.kind}:${output.description ?? ""}`)
    .join("\n");
}

function serializeApprovals(rules?: WorkflowApprovalRule[]) {
  return (rules ?? [])
    .map((rule) => `${rule.actionKind}:${rule.policy}:${rule.description ?? ""}`)
    .join("\n");
}

export default function WorkflowsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkflowsPageContent />
    </Suspense>
  );
}

function WorkflowsPageContent() {
  const workflows = useQuery(api.workflows.list, {}) as WorkflowRow[] | undefined;
  const saveWorkflow = useMutation(api.workflows.save);
  const runWorkflow = useMutation(api.workflows.run);
  const scheduleWorkflow = useMutation(api.workflows.schedule);
  const setPinned = useMutation(api.workflows.setPinned);
  const archiveWorkflow = useMutation(api.workflows.remove);

  const [selectedId, setSelectedId] = useState<Id<"workflows"> | "new">("new");
  const [form, setForm] = useState(emptyWorkflow);
  const [runInputs, setRunInputs] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(
    () => workflows?.find((workflow) => workflow._id === selectedId) ?? null,
    [selectedId, workflows],
  );

  const pinned = workflows?.filter((workflow) => workflow.isPinned) ?? [];
  const visibleWorkflows = workflows ?? [];

  const selectWorkflow = (workflow: WorkflowRow) => {
    setSelectedId(workflow._id);
    setForm({
      title: workflow.title,
      description: workflow.description ?? "",
      kind: workflow.kind as WorkflowKind,
      status: workflow.status as WorkflowStatus,
      inputsText: serializeInputs(workflow.inputs as WorkflowInput[] | undefined),
      stepsText: serializeSteps(workflow.steps as WorkflowStep[] | undefined),
      outputsText: serializeOutputs(workflow.outputs as WorkflowOutput[] | undefined),
      approvalsText: serializeApprovals(workflow.approvalRules as WorkflowApprovalRule[] | undefined),
      scheduleTime: "09:00",
      scheduleCadence: "weekly",
    });
    const defaults: Record<string, string> = {};
    for (const input of (workflow.inputs ?? []) as WorkflowInput[]) {
      defaults[input.key] = input.defaultValue ? String(input.defaultValue) : "";
    }
    setRunInputs(defaults);
    setNotice(null);
  };

  const newWorkflow = () => {
    setSelectedId("new");
    setForm(emptyWorkflow);
    setRunInputs({});
    setNotice(null);
  };

  const save = async () => {
    if (!form.title.trim() || !form.stepsText.trim()) return;
    const metadata = selected ? metadataObject(selected.metadata) : {};
    const workflowId = await saveWorkflow({
      workflowId: selectedId === "new" ? undefined : selectedId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      kind: form.kind,
      status: form.status,
      inputs: parseInputs(form.inputsText),
      steps: parseSteps(form.stepsText),
      outputs: parseOutputs(form.outputsText),
      approvalRules: parseApprovals(form.approvalsText),
      metadata,
    });
    setSelectedId(workflowId);
    setNotice("Workflow saved.");
  };

  const run = async (workflow: WorkflowRow) => {
    const runId = await runWorkflow({ workflowId: workflow._id, inputs: runInputs });
    setNotice("Workflow run queued.");
    return runId;
  };

  const schedule = async (workflow: WorkflowRow) => {
    await scheduleWorkflow({
      workflowId: workflow._id,
      startAt: startAtFromTime(form.scheduleTime),
      cadence: form.scheduleCadence,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setNotice("Workflow schedule saved.");
  };

  if (!workflows) return <PageLoader />;

  return (
    <div className="min-h-full px-4 py-6 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[360px_1fr]">
        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Workflows</h1>
              <p className="mt-1 text-sm text-text-secondary">Reusable task patterns you choose to save.</p>
            </div>
            <button
              type="button"
              onClick={newWorkflow}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-black text-white"
              aria-label="New workflow"
            >
              <Plus size={16} />
            </button>
          </header>

          {pinned.length > 0 && (
            <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Pin size={15} />
                <h2 className="text-sm font-semibold text-text-primary">Pinned</h2>
              </div>
              <div className="space-y-2">
                {pinned.map((workflow) => (
                  <button
                    key={workflow._id}
                    type="button"
                    onClick={() => selectWorkflow(workflow)}
                    className="w-full rounded-lg border border-black/[0.06] px-3 py-2 text-left hover:bg-surface"
                  >
                    <p className="truncate text-sm font-semibold text-text-primary">{workflow.title}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{workflow.description ?? workflow.kind}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-black/[0.05] px-4 py-3">
              <h2 className="text-sm font-semibold text-text-primary">Saved Workflows</h2>
              <span className="text-xs text-text-muted">{visibleWorkflows.length}</span>
            </div>
            {visibleWorkflows.length === 0 ? (
              <div className="p-8 text-center">
                <Clock3 size={18} className="mx-auto text-text-muted" />
                <p className="mt-3 text-sm font-semibold text-text-primary">No workflows yet</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">Create one only when a pattern is worth reusing.</p>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.05]">
                {visibleWorkflows.map((workflow) => (
                  <button
                    key={workflow._id}
                    type="button"
                    onClick={() => selectWorkflow(workflow)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface/70 ${
                      workflow._id === selectedId ? "bg-surface" : ""
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white">
                      <Edit3 size={15} className="text-text-muted" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-text-primary">{workflow.title}</p>
                        {workflow.isPinned && <Pin size={12} className="shrink-0 text-text-muted" />}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-muted">{workflow.description ?? workflow.kind}</p>
                      <p className="mt-1 text-[11px] text-text-muted">
                        {workflow.steps.length} steps - {workflow.status}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{selected ? selected.title : "New workflow"}</h2>
                <p className="mt-1 text-xs text-text-muted">A pinned workflow stays visible here until you unpin it.</p>
              </div>
              <div className="flex items-center gap-2">
                {selected && (
                  <>
                    <button
                      type="button"
                      onClick={() => void setPinned({ workflowId: selected._id, isPinned: !selected.isPinned })}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] text-text-muted hover:bg-surface hover:text-text-primary"
                      aria-label={selected.isPinned ? "Unpin workflow" : "Pin workflow"}
                    >
                      <Pin size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void archiveWorkflow({ workflowId: selected._id }).then(() => {
                          newWorkflow();
                          setNotice("Workflow archived.");
                        });
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] text-text-muted hover:bg-red-50 hover:text-red-600"
                      aria-label="Archive workflow"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!form.title.trim() || !form.stepsText.trim()}
                  className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Save size={15} />
                  Save
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_160px_140px]">
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Workflow title"
                className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
              />
              <select
                value={form.kind}
                onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as WorkflowKind }))}
                className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                aria-label="Workflow kind"
              >
                <option value="process">Process</option>
                <option value="checklist">Checklist</option>
                <option value="research">Research</option>
                <option value="task_pipeline">Task pipeline</option>
                <option value="automation">Automation</option>
                <option value="playbook">Playbook</option>
                <option value="integration">Integration</option>
              </select>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as WorkflowStatus }))}
                className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                aria-label="Workflow status"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>

            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Description"
              className="mt-3 min-h-20 w-full resize-y rounded-lg border border-black/[0.07] bg-surface px-3 py-2 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white"
            />

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <WorkflowTextArea
                label="Inputs"
                value={form.inputsText}
                onChange={(value) => setForm((current) => ({ ...current, inputsText: value }))}
                placeholder="brief:Brief:text:required"
              />
              <WorkflowTextArea
                label="Steps"
                value={form.stepsText}
                onChange={(value) => setForm((current) => ({ ...current, stepsText: value }))}
                placeholder="draft:Draft output:prompt:Use {{brief}}"
              />
              <WorkflowTextArea
                label="Outputs"
                value={form.outputsText}
                onChange={(value) => setForm((current) => ({ ...current, outputsText: value }))}
                placeholder="draft:Draft:doc:Prepared output"
              />
              <WorkflowTextArea
                label="Approval Rules"
                value={form.approvalsText}
                onChange={(value) => setForm((current) => ({ ...current, approvalsText: value }))}
                placeholder="send_email:always:Approve before sending"
              />
            </div>
          </div>

          {selected && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <PlayCircle size={16} />
                  <h2 className="text-sm font-semibold text-text-primary">Run Workflow</h2>
                </div>
                <div className="space-y-2">
                  {((selected.inputs ?? []) as WorkflowInput[]).map((input) => (
                    <input
                      key={input.key}
                      value={runInputs[input.key] ?? ""}
                      onChange={(event) =>
                        setRunInputs((current) => ({ ...current, [input.key]: event.target.value }))
                      }
                      placeholder={input.label}
                      className="h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void run(selected)}
                  disabled={selected.status === "paused"}
                  className="mt-3 flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <PlayCircle size={15} />
                  Run
                </button>
                {selected.recentRuns.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {selected.recentRuns.map((runItem) => (
                      <Link
                        key={runItem._id}
                        href={`/?task=${runItem.directiveId}`}
                        className="block rounded-lg border border-black/[0.06] px-3 py-2 text-xs hover:bg-surface"
                      >
                        <span className="font-semibold text-text-primary">{runItem.title}</span>
                        <span className="ml-2 text-text-muted">{runItem.status} - {formatTime(runItem.updatedAt)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <CalendarClock size={16} />
                  <h2 className="text-sm font-semibold text-text-primary">Schedule</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={form.scheduleCadence}
                    onChange={(event) => setForm((current) => ({ ...current, scheduleCadence: event.target.value as "daily" | "weekdays" | "weekly" }))}
                    className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                    aria-label="Schedule cadence"
                  >
                    <option value="daily">Every day</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  <input
                    type="time"
                    value={form.scheduleTime}
                    onChange={(event) => setForm((current) => ({ ...current, scheduleTime: event.target.value }))}
                    className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                    aria-label="Schedule time"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void schedule(selected)}
                  disabled={selected.status === "paused"}
                  className="mt-3 flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <CalendarClock size={15} />
                  Save schedule
                </button>
                {selected.schedules.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {selected.schedules.map((scheduleItem) => (
                      <div key={scheduleItem._id} className="rounded-lg border border-black/[0.06] px-3 py-2 text-xs">
                        <p className="font-semibold text-text-primary">{scheduleItem.status}</p>
                        <p className="mt-0.5 text-text-muted">Next run: {formatTime(scheduleItem.nextRunAt ?? scheduleItem.startAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {notice && <p className="text-xs font-medium text-text-secondary">{notice}</p>}
        </section>
      </div>
    </div>
  );
}

function WorkflowTextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-text-secondary">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 min-h-28 w-full resize-y rounded-lg border border-black/[0.07] bg-surface px-3 py-2 text-xs leading-5 outline-none focus:border-black/20 focus:bg-white"
      />
    </label>
  );
}

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 size={18} className="animate-spin text-text-muted" />
    </div>
  );
}
