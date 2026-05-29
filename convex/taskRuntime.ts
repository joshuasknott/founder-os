export type WorkRunKind =
  | "code_preview"
  | "document"
  | "design"
  | "email"
  | "schedule"
  | "data_update"
  | "generic";

export type WorkerKind =
  | "builder"
  | "document"
  | "design"
  | "communications"
  | "generic";

export type TaskCategory =
  | "build"
  | "document"
  | "design"
  | "communication"
  | "schedule"
  | "data"
  | "generic";

export type OutputItemKind =
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

export type OutputDocumentKind =
  | "document"
  | "file"
  | "website"
  | "internal_tool"
  | "tool"
  | "presentation"
  | "automation"
  | "task_output"
  | "conversation"
  | "record"
  | "brief"
  | "plan";

export type ScheduleCadence = "once" | "daily" | "weekdays" | "weekly";

export type TaskClassification = {
  category: TaskCategory;
  runKind: WorkRunKind;
  workerKind: WorkerKind;
  outputItemKind: OutputItemKind;
  outputDocumentKind: OutputDocumentKind;
  requiresReview: boolean;
  confidence: number;
  signals: string[];
};

export type WorkRunStatus =
  | "queued"
  | "working"
  | "needs_review"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "stopped";

export type RunLike = {
  kind: WorkRunKind;
  status: WorkRunStatus;
  attemptCount?: number;
  maxAttempts?: number;
  leaseId?: string;
  leaseExpiresAt?: number;
  updatedAt?: number;
  summary?: string;
  previewUrl?: string;
  title: string;
  classification?: Partial<TaskClassification>;
};

export const sensitiveActionKinds = [
  "send_email",
  "publish_preview",
  "post_externally",
  "spend_money",
  "delete_data",
  "change_live_asset",
  "generic",
] as const;

export type SensitiveActionKind = (typeof sensitiveActionKinds)[number];
export type ApprovalDecision = "approved" | "denied";
export type ApprovalAuditEventKind = "requested" | "approved" | "denied" | "handled";

export type ApprovalAuditEvent = {
  event: ApprovalAuditEventKind;
  at: number;
  actor: string;
  actionKind?: SensitiveActionKind;
  message?: string;
};

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_LEASE_MS = 10 * 60 * 1000;

export function nextScheduledRunAt(args: {
  cadence: ScheduleCadence;
  currentRunAt: number;
  now: number;
}) {
  if (args.cadence === "once") return undefined;

  const next = new Date(args.currentRunAt);
  do {
    next.setDate(next.getDate() + (args.cadence === "weekly" ? 7 : 1));
  } while (
    next.getTime() <= args.now ||
    (args.cadence === "weekdays" && (next.getDay() === 0 || next.getDay() === 6))
  );

  return next.getTime();
}

export function scheduleIsDue(args: {
  status: string;
  nextRunAt?: number;
  now: number;
}) {
  return args.status === "scheduled" && typeof args.nextRunAt === "number" && args.nextRunAt <= args.now;
}

const classifierRules: Array<{
  category: TaskCategory;
  runKind: WorkRunKind;
  workerKind: WorkerKind;
  outputItemKind: OutputItemKind;
  outputDocumentKind: OutputDocumentKind;
  requiresReview: boolean;
  signals: string[];
}> = [
  {
    category: "build",
    runKind: "code_preview",
    workerKind: "builder",
    outputItemKind: "website",
    outputDocumentKind: "website",
    requiresReview: true,
    signals: [
      "build",
      "create a page",
      "create page",
      "landing page",
      "website",
      "web app",
      "app",
      "internal tool",
      "preview",
      "code",
      "fix",
      "bug",
    ],
  },
  {
    category: "design",
    runKind: "design",
    workerKind: "design",
    outputItemKind: "upload",
    outputDocumentKind: "file",
    requiresReview: true,
    signals: [
      "design",
      "graphic",
      "social post",
      "social posts",
      "brand asset",
      "visual",
      "image",
      "presentation",
      "slide",
      "deck",
    ],
  },
  {
    category: "communication",
    runKind: "email",
    workerKind: "communications",
    outputItemKind: "email",
    outputDocumentKind: "document",
    requiresReview: true,
    signals: ["email", "outreach", "reply", "follow-up email", "follow up email"],
  },
  {
    category: "schedule",
    runKind: "schedule",
    workerKind: "communications",
    outputItemKind: "plan",
    outputDocumentKind: "plan",
    requiresReview: true,
    signals: [
      "schedule",
      "reminder",
      "calendar",
      "meeting time",
      "meeting times",
      "follow-up",
      "follow up",
    ],
  },
  {
    category: "data",
    runKind: "data_update",
    workerKind: "generic",
    outputItemKind: "record",
    outputDocumentKind: "record",
    requiresReview: false,
    signals: [
      "record",
      "data",
      "database",
      "crm",
      "pipeline",
      "metrics",
      "dashboard",
      "update item",
      "library item",
    ],
  },
  {
    category: "document",
    runKind: "document",
    workerKind: "document",
    outputItemKind: "doc",
    outputDocumentKind: "document",
    requiresReview: false,
    signals: [
      "brief",
      "plan",
      "checklist",
      "proposal",
      "meeting notes",
      "launch plan",
      "draft",
      "write",
      "summarize",
      "summary",
      "spec",
      "strategy",
      "roadmap",
    ],
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function ruleScore(text: string, signals: string[]) {
  return signals.filter((signal) => text.includes(signal)).length;
}

function outputKindsForMatchedRule(
  text: string,
  selected: {
    category: TaskCategory;
    outputItemKind: OutputItemKind;
    outputDocumentKind: OutputDocumentKind;
  },
) {
  if (selected.category !== "build") {
    return {
      outputItemKind: selected.outputItemKind,
      outputDocumentKind: selected.outputDocumentKind,
    };
  }

  if (/\binternal tool\b|\binternal app\b|\badmin tool\b/.test(text)) {
    return {
      outputItemKind: "internal_tool" as const,
      outputDocumentKind: "internal_tool" as const,
    };
  }

  if (/\btool\b|\bdashboard\b|\bcalculator\b|\bcrm\b|\badmin\b|\bweb app\b/.test(text)) {
    return {
      outputItemKind: "tool" as const,
      outputDocumentKind: "tool" as const,
    };
  }

  return {
    outputItemKind: selected.outputItemKind,
    outputDocumentKind: selected.outputDocumentKind,
  };
}

export function classifyTaskObjective(args: {
  title?: string;
  objective: string;
}): TaskClassification {
  const text = normalize(`${args.title ?? ""} ${args.objective}`);
  const scored = classifierRules
    .map((rule, index) => ({
      rule,
      index,
      matched: rule.signals.filter((signal) => text.includes(signal)),
    }))
    .filter((entry) => entry.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || a.index - b.index);

  const selected = scored[0]?.rule ?? {
    category: "generic" as const,
    runKind: "generic" as const,
    workerKind: "generic" as const,
    outputItemKind: "task_output" as const,
    outputDocumentKind: "task_output" as const,
    requiresReview: false,
    signals: [],
  };
  const matched = scored[0]?.matched ?? [];
  const outputKinds = outputKindsForMatchedRule(text, selected);

  return {
    category: selected.category,
    runKind: selected.runKind,
    workerKind: selected.workerKind,
    outputItemKind: outputKinds.outputItemKind,
    outputDocumentKind: outputKinds.outputDocumentKind,
    requiresReview: selected.requiresReview,
    confidence:
      matched.length === 0
        ? 0.35
        : Number(Math.min(0.95, 0.55 + ruleScore(text, selected.signals) * 0.15).toFixed(2)),
    signals: matched,
  };
}

export function normalizePlainWorkerMessage(message?: string, fallback = "I am working on this.") {
  const cleaned = (message ?? "")
    .replace(/\bwork\s*runs?\b|\bworkRuns\b/gi, "work")
    .replace(/\bdirectives?\b/gi, "tasks")
    .replace(/\bconnectors?\b/gi, "connections")
    .replace(/\btool calls?\b|\btool invocations?\b/gi, "steps")
    .replace(/\bcommands?\b/gi, "steps")
    .replace(/\bterminal\b|\bstdout\b|\bstderr\b|\bstack trace\b/gi, "workspace")
    .replace(/\bAPI\b|\bSDK\b|\bCLI\b/gi, "connection")
    .replace(/\bCodex\b/gi, "FounderOS")
    .replace(/\bcommit\b|\bbranch\b/gi, "version")
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/`+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

export function isSensitiveActionKind(value?: string): value is SensitiveActionKind {
  return sensitiveActionKinds.includes(value as SensitiveActionKind);
}

export function labelForSensitiveActionKind(kind?: string) {
  const labels: Record<SensitiveActionKind, string> = {
    send_email: "Send email",
    publish_preview: "Publish preview",
    post_externally: "Post externally",
    spend_money: "Spend money",
    delete_data: "Delete data",
    change_live_asset: "Change live asset",
    generic: "Sensitive action",
  };

  return isSensitiveActionKind(kind) ? labels[kind] : labels.generic;
}

export function approvalRiskCopy(kind?: string) {
  const copy: Record<SensitiveActionKind, string> = {
    send_email: "This will contact someone outside your workspace.",
    publish_preview: "This will make a preview or draft visible outside your private workspace.",
    post_externally: "This will publish content to an external channel.",
    spend_money: "This may create a charge or commit budget.",
    delete_data: "This can remove business data.",
    change_live_asset: "This will change something already live.",
    generic: "This is a sensitive step that needs your decision first.",
  };

  return isSensitiveActionKind(kind) ? copy[kind] : copy.generic;
}

export function appendApprovalAudit(
  history: ApprovalAuditEvent[] | undefined,
  event: ApprovalAuditEvent,
) {
  return [...(history ?? []), event];
}

export function approvalRequestRunPatch(now: number) {
  return {
    status: "waiting_for_approval" as const,
    leaseId: undefined,
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
    updatedAt: now,
  };
}

export function approvalDecisionRunPatch(decision: ApprovalDecision, now: number) {
  return {
    status: decision === "approved" ? ("queued" as const) : ("needs_review" as const),
    leaseId: undefined,
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
    updatedAt: now,
  };
}

export function approvalDecisionTaskStatus(decision: ApprovalDecision) {
  return decision === "approved" ? ("queued" as const) : ("shadow_pending" as const);
}

export function approvalDecisionPatch(args: {
  decision: ApprovalDecision;
  now: number;
  actor?: string;
  actionKind?: SensitiveActionKind;
  auditHistory?: ApprovalAuditEvent[];
}) {
  const event = args.decision === "approved" ? "approved" : "denied";

  return {
    status: args.decision,
    principalSignature: `${args.decision}:${args.now}`,
    decidedAt: args.now,
    auditHistory: appendApprovalAudit(args.auditHistory, {
      event,
      at: args.now,
      actor: args.actor ?? "Founder",
      actionKind: args.actionKind,
    }),
  };
}

export function approvedActionFallbackResult(args: {
  actionKind?: string;
  actionTitle?: string;
  actionDescription?: string;
}) {
  const label = labelForSensitiveActionKind(args.actionKind);
  const summary = `${label} was approved, but no live connection is installed for that action yet. Nothing external was performed.`;
  const content = [
    `# ${args.actionTitle ?? label}`,
    "",
    "## Approval",
    args.actionDescription ?? approvalRiskCopy(args.actionKind),
    "",
    "## Result",
    "FounderOS resumed the approved step and kept it in review because there is no live connection available for this action yet.",
    "",
    "No email was sent, no post was published, no money was spent, no data was deleted, and no live asset was changed.",
  ].join("\n");

  return { summary, content };
}

export function canLeaseRun(run: RunLike, kinds: WorkRunKind[], now: number) {
  if (!kinds.includes(run.kind)) return false;
  if (run.status === "queued") {
    return (run.attemptCount ?? 0) < (run.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  }
  if (run.status !== "working") return false;
  if (typeof run.leaseExpiresAt !== "number") return false;
  return run.leaseExpiresAt <= now && (run.attemptCount ?? 0) < (run.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
}

export function leaseRunPatch(
  run: RunLike,
  args: {
    now: number;
    leaseId: string;
    leaseOwner: string;
    leaseMs?: number;
  },
) {
  return {
    status: "working" as const,
    attemptCount: (run.attemptCount ?? 0) + 1,
    maxAttempts: run.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    leaseId: args.leaseId,
    leaseOwner: args.leaseOwner,
    leaseExpiresAt: args.now + (args.leaseMs ?? DEFAULT_LEASE_MS),
    startedAt: args.now,
    updatedAt: args.now,
  };
}

export function leaseIsValid(
  run: RunLike,
  args: {
    leaseId?: string;
    now: number;
  },
) {
  if (!args.leaseId) return true;
  return run.leaseId === args.leaseId && typeof run.leaseExpiresAt === "number" && run.leaseExpiresAt > args.now;
}

export function finishRunPatch(
  status: Extract<WorkRunStatus, "needs_review" | "completed" | "waiting_for_approval">,
  now: number,
) {
  return {
    status,
    leaseId: undefined,
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
    completedAt: status === "completed" ? now : undefined,
    updatedAt: now,
  };
}

export function failRunState(
  run: RunLike,
  args: {
    now: number;
    retryable?: boolean;
    failureReason?: string;
    internalError?: string;
  },
) {
  const attempts = run.attemptCount ?? 0;
  const maxAttempts = run.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const willRetry = args.retryable !== false && attempts < maxAttempts;
  const failureReason = normalizePlainWorkerMessage(
    args.failureReason,
    "FounderOS could not finish this step yet.",
  );

  return {
    retryScheduled: willRetry,
    updateTone: willRetry ? ("progress" as const) : ("error" as const),
    updateMessage: willRetry
      ? "I hit a temporary issue and will try again."
      : failureReason,
    patch: {
      status: willRetry ? ("queued" as const) : ("failed" as const),
      failureReason,
      lastError: args.internalError,
      leaseId: undefined,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      failedAt: willRetry ? undefined : args.now,
      updatedAt: args.now,
    },
  };
}

export function artifactKindForRun(kind: WorkRunKind) {
  if (kind === "code_preview") return "preview";
  if (kind === "data_update") return "record";
  return kind;
}

export function documentKindForRun(
  kind: WorkRunKind,
  hasPreview: boolean,
  classification?: Partial<TaskClassification>,
): OutputDocumentKind {
  if (classification?.outputDocumentKind) return classification.outputDocumentKind;
  if (kind === "code_preview" && hasPreview) return "website";
  if (kind === "document" || kind === "email") return "document";
  if (kind === "design") return "file";
  if (kind === "schedule") return "plan";
  if (kind === "data_update") return "record";
  return "task_output";
}

export function buildRunOutputModel(
  run: {
    kind: WorkRunKind;
    title: string;
    summary?: string;
    previewUrl?: string;
    classification?: Partial<TaskClassification>;
  },
  result?: {
    summary?: string;
    content?: string;
    previewUrl?: string;
  },
) {
  const summary = normalizePlainWorkerMessage(
    result?.summary ?? run.summary,
    "Saved from a FounderOS task.",
  );
  const previewUrl = result?.previewUrl ?? run.previewUrl;
  const documentKind = documentKindForRun(run.kind, Boolean(previewUrl), run.classification);
  const itemKind = run.classification?.outputItemKind ?? (
    documentKind === "website"
      ? "website"
      : documentKind === "file"
        ? "upload"
        : documentKind === "plan"
          ? "plan"
          : documentKind === "record"
            ? "record"
            : documentKind === "task_output"
              ? "task_output"
              : "doc"
  );
  const content = result?.content ?? [
    `# ${run.title}`,
    "",
    summary,
    ...(previewUrl ? ["", `Preview: ${previewUrl}`] : []),
  ].join("\n");

  return {
    title: run.title,
    summary,
    previewUrl,
    content,
    documentKind,
    itemKind,
    artifactKind: artifactKindForRun(run.kind),
  };
}
