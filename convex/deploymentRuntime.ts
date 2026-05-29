export type DeploymentHistoryEvent =
  | "preview_created"
  | "preview_failed"
  | "published_live"
  | "publish_failed";

export type DeploymentHistoryEntry = {
  event: DeploymentHistoryEvent;
  target: "preview" | "production";
  status: "ready" | "failed" | "live";
  previewUrl?: string;
  liveUrl?: string;
  deploymentId?: string;
  provider?: string;
  safeMessage: string;
  approvalRequiredForLive: boolean;
  createdAt: number;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, maxLength = 300) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function urlValue(value: unknown) {
  const url = stringValue(value, 500);
  if (!url || !/^https?:\/\//i.test(url)) return undefined;
  return url;
}

function deploymentMetadataFrom(resultMetadata?: unknown) {
  const metadata = record(resultMetadata);
  return record(metadata.deployment ?? resultMetadata);
}

function deploymentSafeMessage(event: DeploymentHistoryEvent) {
  const messages: Record<DeploymentHistoryEvent, string> = {
    preview_created: "Preview created for review.",
    preview_failed: "Preview link could not be created.",
    published_live: "Approved site update published.",
    publish_failed: "Approved publishing step could not finish.",
  };

  return messages[event];
}

export function deploymentHistoryEntryFromMetadata(
  resultMetadata?: unknown,
  now = Date.now(),
): DeploymentHistoryEntry | null {
  const deployment = deploymentMetadataFrom(resultMetadata);
  const previewUrl = urlValue(deployment.previewUrl);
  const liveUrl = urlValue(deployment.liveUrl);
  const target = deployment.target === "production" ? "production" : "preview";
  const status = stringValue(deployment.status, 40);
  const provider = stringValue(deployment.provider, 80);
  const safeError = stringValue(deployment.safeError, 220);
  const failed = status === "failed" || Boolean(safeError);

  if (provider === "local" && !liveUrl && !stringValue(deployment.deploymentId) && !failed) {
    return null;
  }

  if (!previewUrl && !liveUrl && !stringValue(deployment.deploymentId) && !failed) {
    return null;
  }

  const event: DeploymentHistoryEvent =
    target === "production"
      ? failed
        ? "publish_failed"
        : "published_live"
      : failed
        ? "preview_failed"
        : "preview_created";

  return {
    event,
    target,
    status: failed ? "failed" : target === "production" ? "live" : "ready",
    previewUrl,
    liveUrl,
    deploymentId: stringValue(deployment.deploymentId),
    provider,
    safeMessage: safeError ?? stringValue(deployment.safeMessage, 220) ?? deploymentSafeMessage(event),
    approvalRequiredForLive: deployment.publishRequiresApproval !== false,
    createdAt: typeof deployment.createdAt === "number" ? deployment.createdAt : now,
  };
}

function historyKey(entry: DeploymentHistoryEntry) {
  return [
    entry.event,
    entry.target,
    entry.deploymentId ?? "",
    entry.previewUrl ?? "",
    entry.liveUrl ?? "",
    entry.createdAt,
  ].join("|");
}

export function appendDeploymentHistory(
  itemMetadata?: unknown,
  resultMetadata?: unknown,
  now = Date.now(),
) {
  const base = record(itemMetadata);
  const existing = Array.isArray(base.deploymentHistory)
    ? (base.deploymentHistory as DeploymentHistoryEntry[])
    : [];
  const next = deploymentHistoryEntryFromMetadata(resultMetadata, now);

  if (!next) return base;

  const seen = new Set<string>();
  const history = [...existing, next]
    .filter((entry) => {
      const key = historyKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-20);

  return {
    ...base,
    deploymentHistory: history,
  };
}
