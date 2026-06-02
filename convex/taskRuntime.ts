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

export type FounderVisibleWorkStatus =
  | "queued"
  | "working"
  | "needs review"
  | "needs approval"
  | "done"
  | "failed";

export type LocalRunnerCapability =
  | "coding"
  | "debugging"
  | "document"
  | "design"
  | "communication"
  | "schedule"
  | "data"
  | "generic"
  | "business_reasoning"
  | "product_marketing_docs"
  | "planning";

export type LocalRunnerSensitivity =
  | "public"
  | "low"
  | "internal"
  | "confidential"
  | "restricted";

export type LocalRunnerOutputContract =
  | "plain_text"
  | "structured_json"
  | "library_item"
  | "code_changes"
  | "public_draft";

export type LocalRunRouting = {
  capability: LocalRunnerCapability;
  sensitivity: LocalRunnerSensitivity;
  outputContract: LocalRunnerOutputContract;
  approvalNeeds: SensitiveActionKind[];
};

export type RunLike = {
  kind: WorkRunKind;
  status: WorkRunStatus;
  attemptCount?: number;
  maxAttempts?: number;
  leaseId?: string;
  leaseExpiresAt?: number;
  nextRetryAt?: number;
  retryDelayMs?: number;
  updatedAt?: number;
  summary?: string;
  previewUrl?: string;
  title: string;
  classification?: Partial<TaskClassification>;
  localRouting?: LocalRunRouting;
};

export const sensitiveActionKinds = [
  "send_email",
  "create_calendar_event",
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
export const DEFAULT_RETRY_DELAY_MS = 10 * 1000;
export const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

const SENSITIVITY_RANK: Record<LocalRunnerSensitivity, number> = {
  public: 0,
  low: 1,
  internal: 2,
  confidential: 3,
  restricted: 4,
};

export function founderVisibleStatusForRun(status: WorkRunStatus): FounderVisibleWorkStatus {
  if (status === "queued") return "queued";
  if (status === "working") return "working";
  if (status === "needs_review") return "needs review";
  if (status === "waiting_for_approval") return "needs approval";
  if (status === "completed") return "done";
  return "failed";
}

export function inferLocalSensitivity(
  text?: string,
  fallback: LocalRunnerSensitivity = "internal",
): LocalRunnerSensitivity {
  const normalized = String(text ?? "").toLowerCase();
  if (!normalized.trim()) return fallback;

  if (
    /\b(api[_ -]?key|secret|password|passwd|bearer|private key|refresh token|access token)\b/.test(normalized) ||
    /\b(sk|pk|rk|ghp|github_pat|ya29)[-_a-z0-9]{8,}\b/.test(normalized) ||
    /-----begin [a-z ]+private key-----/.test(normalized)
  ) {
    return "restricted";
  }

  if (
    /\b(bank|payroll|salary|tax|legal|contract|nda|cap table|investor update|runway|revenue|invoice|customer list|health)\b/.test(normalized) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(normalized) ||
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(normalized)
  ) {
    return "confidential";
  }

  if (/\b(redacted|public draft|public copy|blog post|press release|social post|landing page copy|marketing copy)\b/.test(normalized)) {
    return "low";
  }

  if (/\b(public information|published page|public website)\b/.test(normalized)) {
    return "public";
  }

  return fallback;
}

function approvalNeedsForText(text: string): SensitiveActionKind[] {
  const normalized = text.toLowerCase();
  const needs = new Set<SensitiveActionKind>();

  if (/\b(send|reply|email|contact|outreach|follow up with|follow-up with)\b/.test(normalized)) {
    needs.add("send_email");
  }
  if (/\b(calendar|invite|book a meeting|schedule a meeting|create an event)\b/.test(normalized)) {
    needs.add("create_calendar_event");
  }
  if (/\b(publish|deploy|go live|make live|publicly available)\b/.test(normalized)) {
    needs.add("publish_preview");
  }
  if (/\b(post to|post on|tweet|linkedin|social channel)\b/.test(normalized)) {
    needs.add("post_externally");
  }
  if (/\b(pay|purchase|buy|spend|subscribe|upgrade plan)\b/.test(normalized)) {
    needs.add("spend_money");
  }
  if (/\b(delete|remove permanently|wipe|destroy)\b/.test(normalized)) {
    needs.add("delete_data");
  }
  if (/\b(change live|update production|edit the live|replace live)\b/.test(normalized)) {
    needs.add("change_live_asset");
  }

  return [...needs];
}

function defaultCapabilityForRun(kind: WorkRunKind, classification?: Partial<TaskClassification>): LocalRunnerCapability {
  if (kind === "code_preview") return "coding";
  if (kind === "document") return classification?.category === "document" ? "document" : "product_marketing_docs";
  if (kind === "design") return "design";
  if (kind === "email") return "communication";
  if (kind === "schedule") return "schedule";
  if (kind === "data_update") return "data";
  return "generic";
}

function defaultOutputContractForRun(
  kind: WorkRunKind,
  text: string,
): LocalRunnerOutputContract {
  if (kind === "code_preview") return "code_changes";
  if (/\b(public draft|blog post|press release|social post|marketing copy)\b/i.test(text)) {
    return "public_draft";
  }
  return "library_item";
}

export function localRoutingForRun(args: {
  kind: WorkRunKind;
  title?: string;
  objective?: string;
  classification?: Partial<TaskClassification>;
}): LocalRunRouting {
  const text = `${args.title ?? ""}\n${args.objective ?? ""}`;
  return {
    capability: defaultCapabilityForRun(args.kind, args.classification),
    sensitivity: inferLocalSensitivity(text),
    outputContract: defaultOutputContractForRun(args.kind, text),
    approvalNeeds: approvalNeedsForText(text),
  };
}

export function runnerCanHandleRouting(
  runner: {
    capabilities: LocalRunnerCapability[];
    outputContracts?: LocalRunnerOutputContract[];
    maxSensitivity?: LocalRunnerSensitivity;
    approvalCapabilities?: SensitiveActionKind[];
  },
  routing: LocalRunRouting,
) {
  if (!runner.capabilities.includes(routing.capability)) return false;

  const maxSensitivity = runner.maxSensitivity ?? "restricted";
  if (SENSITIVITY_RANK[routing.sensitivity] > SENSITIVITY_RANK[maxSensitivity]) return false;

  if (runner.outputContracts && !runner.outputContracts.includes(routing.outputContract)) return false;

  const approvalCapabilities = runner.approvalCapabilities ?? [...sensitiveActionKinds];
  return routing.approvalNeeds.every((need) => approvalCapabilities.includes(need));
}

function retryDelayForAttempt(attempts: number) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    DEFAULT_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1),
  );
}

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
      "tool",
      "booking",
      "booking tool",
      "booking form",
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
    signals: [
      "email",
      "emails",
      "gmail",
      "gmails",
      "inbox",
      "mail",
      "outreach",
      "reply",
      "follow-up email",
      "follow up email",
    ],
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
      "availability",
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
    create_calendar_event: "Create calendar event",
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
    create_calendar_event: "This will add an event to an external calendar and may invite other people.",
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
  return decision === "approved" ? ("queued" as const) : ("blocked" as const);
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
    "No email was sent, no calendar event was created, no post was published, no money was spent, no data was deleted, and no live asset was changed.",
  ].join("\n");

  return { summary, content };
}

export function canLeaseRun(run: RunLike, kinds: WorkRunKind[], now: number) {
  if (!kinds.includes(run.kind)) return false;
  if (run.status === "queued") {
    if (typeof run.nextRetryAt === "number" && run.nextRetryAt > now) return false;
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
    nextRetryAt: undefined,
    retryDelayMs: undefined,
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
  if (!args.leaseId) {
    return typeof run.leaseId !== "string";
  }
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
  const retryDelayMs = willRetry ? retryDelayForAttempt(attempts) : undefined;
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
      nextRetryAt: willRetry ? args.now + retryDelayMs! : undefined,
      retryDelayMs,
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

export function buildRefinementRunModel(args: {
  title: string;
  objective: string;
  refinement: string;
  classification: TaskClassification;
}) {
  const cleanTitle = args.title.trim() || "Product build";
  const cleanRefinement = normalizePlainWorkerMessage(
    args.refinement,
    "Use the founder's latest changes.",
  );
  const updatedObjective = [
    args.objective.trim(),
    "",
    `Founder requested changes: ${cleanRefinement}`,
  ].join("\n");

  return {
    title: `${cleanTitle} revision`,
    taskTitle: `Revise ${cleanTitle}`,
    description: cleanRefinement,
    updatedObjective,
    runKind: args.classification.runKind,
    workerKind: args.classification.workerKind,
    outputItemKind: args.classification.outputItemKind,
    outputDocumentKind: args.classification.outputDocumentKind,
    message: "I added those changes and will prepare a new review version.",
  };
}
