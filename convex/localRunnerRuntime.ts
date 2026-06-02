import type {
  LocalRunnerCapability,
  LocalRunnerOutputContract,
  LocalRunnerSensitivity,
  SensitiveActionKind,
} from "./taskRuntime";

export const DEFAULT_LOCAL_RUNNER_HEARTBEAT_TTL_MS = 45 * 1000;

const DEFAULT_RUNNER_CAPABILITIES: LocalRunnerCapability[] = [
  "coding",
  "document",
  "design",
  "communication",
  "schedule",
  "data",
  "generic",
];

const DEFAULT_RUNNER_OUTPUT_CONTRACTS: LocalRunnerOutputContract[] = [
  "plain_text",
  "structured_json",
  "library_item",
  "code_changes",
  "public_draft",
];

export type LocalRunnerRecord = {
  status: "starting" | "online" | "offline";
  heartbeatExpiresAt: number;
};

export function localRunnerHeartbeatPatch(args: {
  now: number;
  heartbeatTtlMs?: number;
}) {
  const heartbeatTtlMs = Math.max(5_000, args.heartbeatTtlMs ?? DEFAULT_LOCAL_RUNNER_HEARTBEAT_TTL_MS);
  return {
    status: "online" as const,
    lastHeartbeatAt: args.now,
    heartbeatExpiresAt: args.now + heartbeatTtlMs,
    updatedAt: args.now,
  };
}

export function localRunnerIsAlive(runner: LocalRunnerRecord | null | undefined, now: number) {
  return Boolean(runner && runner.status === "online" && runner.heartbeatExpiresAt > now);
}

export function localRunnerOfflinePatch(now: number, message = "The local runner is offline.") {
  return {
    status: "offline" as const,
    currentRunId: undefined,
    lastSafeMessage: message,
    stoppedAt: now,
    updatedAt: now,
  };
}

export function normalizeRunnerCapabilities(capabilities?: string[]): LocalRunnerCapability[] {
  const allowed = new Set<LocalRunnerCapability>([
    "coding",
    "debugging",
    "document",
    "design",
    "communication",
    "schedule",
    "data",
    "generic",
    "business_reasoning",
    "product_marketing_docs",
    "planning",
  ]);

  const values = (capabilities ?? [])
    .map((value) => value.trim())
    .filter((value): value is LocalRunnerCapability => allowed.has(value as LocalRunnerCapability));

  return [...new Set(values.length > 0 ? values : DEFAULT_RUNNER_CAPABILITIES)];
}

export function normalizeRunnerOutputContracts(outputContracts?: string[]): LocalRunnerOutputContract[] {
  const allowed = new Set<LocalRunnerOutputContract>([
    "plain_text",
    "structured_json",
    "library_item",
    "code_changes",
    "public_draft",
  ]);

  const values = (outputContracts ?? [])
    .map((value) => value.trim())
    .filter((value): value is LocalRunnerOutputContract => allowed.has(value as LocalRunnerOutputContract));

  return [...new Set(values.length > 0 ? values : DEFAULT_RUNNER_OUTPUT_CONTRACTS)];
}

export function normalizeRunnerSensitivity(value?: string): LocalRunnerSensitivity {
  if (
    value === "public" ||
    value === "low" ||
    value === "internal" ||
    value === "confidential" ||
    value === "restricted"
  ) {
    return value;
  }
  return "restricted";
}

export function normalizeApprovalCapabilities(values?: string[]): SensitiveActionKind[] {
  const allowed = new Set<SensitiveActionKind>([
    "send_email",
    "create_calendar_event",
    "publish_preview",
    "post_externally",
    "spend_money",
    "delete_data",
    "change_live_asset",
    "generic",
  ]);
  const normalized = (values ?? [])
    .map((value) => value.trim())
    .filter((value): value is SensitiveActionKind => allowed.has(value as SensitiveActionKind));

  return [...new Set(normalized.length > 0 ? normalized : [...allowed])];
}
