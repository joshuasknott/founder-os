export const googleWorkspaceConnectorIds = [
  "gmail",
  "google_calendar",
  "google_drive",
  "google_docs",
  "google_sheets",
] as const;

const requiredConnectorIds = new Set<string>([...googleWorkspaceConnectorIds, "github"]);
const requiredWorkCapabilities = [
  "business_reasoning",
  "product_marketing_docs",
  "planning",
  "document",
  "coding",
] as const;
const requiredOutputContracts = ["library_item", "public_draft"] as const;

type Connection = {
  connectorId: string;
  status: string;
  credentialRef?: string;
  grantedScopes: string[];
  requiredScopes: string[];
  disabledAt?: number;
  lastHealthyAt?: number;
  lastSafeMessage?: string;
  settings?: unknown;
};

type SyncState = {
  connectorId: string;
  entityType: string;
  status: string;
  lastSuccessfulSyncAt?: number;
  lastSafeMessage?: string;
};

type SetupSession = {
  providerId: string;
  connectorIds: string[];
  status: string;
  completedAt?: number;
};

type LocalRunner = {
  status: string;
  heartbeatExpiresAt: number;
  opencodeReady?: boolean;
  capabilities: string[];
  outputContracts: string[];
};

type Workspace = {
  name: string;
  reviewExternalActions?: boolean;
  externalActionApprovalConfirmedAt?: number;
};

type Founder = {
  name: string;
};

export type ReadinessGate = {
  id: "founder_profile" | "google_workspace" | "github_repository" | "work_engine" | "external_action_approval";
  label: string;
  status: "ready" | "blocked";
  reason: string;
};

export type WorkspaceReadinessInput = {
  workspace: Workspace | null;
  founder: Founder | null;
  connections: Connection[];
  syncStates: SyncState[];
  setupSessions: SetupSession[];
  runners: LocalRunner[];
  now: number;
};

function hasRequiredScopes(connection: Connection) {
  return connection.requiredScopes.every((scope) => connection.grantedScopes.includes(scope));
}

function isHealthyConnection(connection: Connection | undefined) {
  return Boolean(
    connection &&
      connection.status === "connected" &&
      !connection.disabledAt &&
      connection.credentialRef &&
      typeof connection.lastHealthyAt === "number" &&
      hasRequiredScopes(connection),
  );
}

function hasCompletedSession(sessions: SetupSession[], providerId: string, connectorIds: readonly string[]) {
  return sessions.some(
    (session) =>
      session.providerId === providerId &&
      session.status === "completed" &&
      connectorIds.every((connectorId) => session.connectorIds.includes(connectorId)),
  );
}

function hasHealthySync(syncStates: SyncState[], connectorId: string) {
  return syncStates.some(
    (state) =>
      state.connectorId === connectorId &&
      state.entityType === "connection" &&
      state.status === "idle" &&
      typeof state.lastSuccessfulSyncAt === "number",
  );
}

function hasGitHubRepository(connection: Connection | undefined) {
  if (!connection?.settings || typeof connection.settings !== "object" || Array.isArray(connection.settings)) {
    return false;
  }
  const settings = connection.settings as Record<string, unknown>;
  return Boolean(
    typeof settings.installationId === "string" && settings.installationId.trim() &&
      typeof settings.repositoryName === "string" && settings.repositoryName.trim() &&
      ((typeof settings.repositoryOwner === "string" && settings.repositoryOwner.trim()) ||
        (typeof settings.organizationName === "string" && settings.organizationName.trim())),
  );
}

function optionalServiceStatus(connection: Connection) {
  if (connection.status === "connected" && !connection.disabledAt && typeof connection.lastHealthyAt === "number") {
    return "ready" as const;
  }
  if (connection.status === "disabled" || connection.disabledAt) return "off" as const;
  if (connection.status === "needs_attention") return "needs_attention" as const;
  return "not_connected" as const;
}

export function evaluateWorkspaceReadiness(input: WorkspaceReadinessInput) {
  const connections = new Map(input.connections.map((connection) => [connection.connectorId, connection]));
  const googleConnections = googleWorkspaceConnectorIds.map((connectorId) => connections.get(connectorId));
  const missingGoogleServices = googleWorkspaceConnectorIds.filter(
    (connectorId, index) => !isHealthyConnection(googleConnections[index]) || !hasHealthySync(input.syncStates, connectorId),
  );
  const github = connections.get("github");
  const liveRunners = input.runners.filter(
    (runner) => runner.status === "online" && runner.heartbeatExpiresAt > input.now && runner.opencodeReady === true,
  );
  const runnerCapabilities = new Set(liveRunners.flatMap((runner) => runner.capabilities));
  const runnerOutputs = new Set(liveRunners.flatMap((runner) => runner.outputContracts));
  const missingCapabilities = requiredWorkCapabilities.filter((capability) => !runnerCapabilities.has(capability));
  const missingOutputs = requiredOutputContracts.filter((contract) => !runnerOutputs.has(contract));

  const gates: ReadinessGate[] = [
    {
      id: "founder_profile",
      label: "Founder profile and business",
      status: input.founder?.name.trim() && input.workspace?.name.trim() ? "ready" : "blocked",
      reason: "Add your name and business name.",
    },
    {
      id: "google_workspace",
      label: "Google Workspace",
      status: missingGoogleServices.length === 0 && hasCompletedSession(input.setupSessions, "google_workspace", googleWorkspaceConnectorIds)
        ? "ready"
        : "blocked",
      reason: "Connect Google Workspace so Gmail, Calendar, Drive, Docs, and Sheets are all ready.",
    },
    {
      id: "github_repository",
      label: "GitHub App and repository",
      status: isHealthyConnection(github) && hasGitHubRepository(github) && hasHealthySync(input.syncStates, "github") &&
        hasCompletedSession(input.setupSessions, "github_app", ["github"])
        ? "ready"
        : "blocked",
      reason: "Finish the GitHub App installation and choose an accessible repository.",
    },
    {
      id: "work_engine",
      label: "FounderOS Work Engine",
      status: liveRunners.length > 0 && missingCapabilities.length === 0 && missingOutputs.length === 0 ? "ready" : "blocked",
      reason: "Start the FounderOS Work Engine with business, drafting, research, document, code, and review-output support.",
    },
    {
      id: "external_action_approval",
      label: "External-action approval",
      status: input.workspace?.reviewExternalActions === true || typeof input.workspace?.externalActionApprovalConfirmedAt === "number"
        ? "ready"
        : "blocked",
      reason: "Enable external-action approval or confirm your external-action policy.",
    },
  ];

  const firstBlocked = gates.find((gate) => gate.status === "blocked");
  const optionalServices = input.connections
    .filter((connection) => !requiredConnectorIds.has(connection.connectorId))
    .map((connection) => ({
      id: connection.connectorId,
      status: optionalServiceStatus(connection),
      message: connection.lastSafeMessage ?? "Not connected yet.",
    }));

  return {
    ready: !firstBlocked,
    gates,
    blockingReason: firstBlocked?.reason ?? null,
    optionalServices,
  };
}
