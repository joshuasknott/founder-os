export const connectorCapabilities = [
  "read_email",
  "draft_email",
  "send_email",
  "read_calendar",
  "check_availability",
  "create_calendar_event",
  "manage_calendar",
  "read_payments",
  "spend_money",
  "post_externally",
  "change_live_asset",
  "read_business_records",
  "write_business_records",
  "create_preview_deployment",
  "publish_preview",
] as const;

export type ConnectorCapability = (typeof connectorCapabilities)[number];

export type ConnectorAuthType = "oauth2" | "api_key" | "webhook" | "managed";
export type ConnectorConnectionStatus =
  | "not_connected"
  | "needs_attention"
  | "connected"
  | "disabled";
export type ConnectorApprovalPolicy = "never" | "per_sensitive_action" | "always";
export type ConnectorActionApproval = "never" | "always";

export type ConnectorActionType =
  | "read_email"
  | "draft_email"
  | "send_email"
  | "read_calendar"
  | "check_availability"
  | "create_calendar_event"
  | "schedule_meeting"
  | "read_payments"
  | "charge_payment"
  | "publish_post"
  | "update_live_asset"
  | "read_records"
  | "write_record"
  | "create_preview_deployment"
  | "publish_preview"
  | "publish_live_deployment";

export type ConnectorActionDefinition = {
  type: ConnectorActionType;
  safeLabel: string;
  requiredCapabilities: ConnectorCapability[];
  requiredScopes: string[];
  approval: ConnectorActionApproval;
  sensitiveActionKind?:
    | "send_email"
    | "create_calendar_event"
    | "post_externally"
    | "spend_money"
    | "delete_data"
    | "change_live_asset"
    | "publish_preview"
    | "generic";
  handlerKey: string;
};

export type ConnectorDefinition = {
  id: string;
  safeDisplayName: string;
  description: string;
  authType: ConnectorAuthType;
  capabilities: ConnectorCapability[];
  requiredScopes: string[];
  scopeLabels: string[];
  connectionStatus: ConnectorConnectionStatus;
  approvalPolicy: ConnectorApprovalPolicy;
  actions: ConnectorActionDefinition[];
};

export type ConnectorConnectionLike = {
  status?: ConnectorConnectionStatus | string;
  grantedScopes?: string[];
  credentialRef?: string;
  settings?: unknown;
  disabledAt?: number;
  lastSafeMessage?: string;
  connectedAt?: number;
  lastTestedAt?: number;
};

export type ConnectorStatusResult = {
  status: ConnectorConnectionStatus;
  safeMessage: string;
  healthy: boolean;
};

export type ConnectorActionEvaluation = {
  allowed: boolean;
  approvalRequired: boolean;
  reason:
    | "ready"
    | "not_connected"
    | "disabled"
    | "missing_permission"
    | "approval_required"
    | "unknown_connector"
    | "unknown_action";
  safeMessage: string;
  sensitiveActionKind?: ConnectorActionDefinition["sensitiveActionKind"];
};

export type ConnectorCredentialEnvelope = {
  storageProvider: "founderos_managed_vault";
  vaultKey: string;
  sealedReference: string;
  fingerprint: string;
  keyVersion: string;
  secretPreview: string;
  createdAt: number;
};

export type VercelConnectionSettings = {
  projectId?: string;
  projectName?: string;
  teamId?: string;
  productionDomain?: string;
  rootDirectory?: string;
  framework?: string;
  buildCommand?: string;
  installCommand?: string;
  outputDirectory?: string;
};

export type GoogleWorkspaceConnectionSettings = {
  accountEmail?: string;
  calendarName?: string;
  calendarId?: string;
};

type ConnectorActionHandlerResult = {
  status: "completed" | "needs_attention";
  safeSummary: string;
};

type ConnectorActionHandler = (args: {
  connectorId: string;
  actionType: ConnectorActionType;
  approved: boolean;
}) => Promise<ConnectorActionHandlerResult>;

const sensitiveCapabilities = new Set<ConnectorCapability>([
  "send_email",
  "create_calendar_event",
  "manage_calendar",
  "spend_money",
  "post_externally",
  "change_live_asset",
  "publish_preview",
]);

export const connectorRegistry: Record<string, ConnectorDefinition> = {
  email: {
    id: "email",
    safeDisplayName: "Email",
    description: "Read relevant messages and send approved emails.",
    authType: "oauth2",
    capabilities: ["read_email", "send_email"],
    requiredScopes: ["email.read", "email.send"],
    scopeLabels: ["Read relevant messages", "Send approved emails"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "read_email",
        safeLabel: "Read relevant messages",
        requiredCapabilities: ["read_email"],
        requiredScopes: ["email.read"],
        approval: "never",
        handlerKey: "email.read",
      },
      {
        type: "send_email",
        safeLabel: "Send approved emails",
        requiredCapabilities: ["send_email"],
        requiredScopes: ["email.send"],
        approval: "always",
        sensitiveActionKind: "send_email",
        handlerKey: "email.send",
      },
    ],
  },
  gmail: {
    id: "gmail",
    safeDisplayName: "Gmail",
    description: "Import relevant messages, prepare drafts, and send approved emails.",
    authType: "oauth2",
    capabilities: ["read_email", "draft_email", "send_email"],
    requiredScopes: ["google.gmail.read", "google.gmail.compose", "google.gmail.send"],
    scopeLabels: ["Import relevant messages", "Prepare email drafts", "Send approved emails"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "read_email",
        safeLabel: "Import relevant messages",
        requiredCapabilities: ["read_email"],
        requiredScopes: ["google.gmail.read"],
        approval: "never",
        handlerKey: "gmail.read",
      },
      {
        type: "draft_email",
        safeLabel: "Prepare email drafts",
        requiredCapabilities: ["draft_email"],
        requiredScopes: ["google.gmail.compose"],
        approval: "never",
        handlerKey: "gmail.draft",
      },
      {
        type: "send_email",
        safeLabel: "Send approved emails",
        requiredCapabilities: ["send_email"],
        requiredScopes: ["google.gmail.send"],
        approval: "always",
        sensitiveActionKind: "send_email",
        handlerKey: "gmail.send",
      },
    ],
  },
  calendar: {
    id: "calendar",
    safeDisplayName: "Calendar",
    description: "Read availability and create approved meetings.",
    authType: "oauth2",
    capabilities: ["read_calendar", "manage_calendar"],
    requiredScopes: ["calendar.read", "calendar.write"],
    scopeLabels: ["Read availability", "Create approved meetings"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "read_calendar",
        safeLabel: "Read availability",
        requiredCapabilities: ["read_calendar"],
        requiredScopes: ["calendar.read"],
        approval: "never",
        handlerKey: "calendar.read",
      },
      {
        type: "schedule_meeting",
        safeLabel: "Create approved meetings",
        requiredCapabilities: ["manage_calendar"],
        requiredScopes: ["calendar.write"],
        approval: "always",
        sensitiveActionKind: "create_calendar_event",
        handlerKey: "calendar.schedule",
      },
    ],
  },
  google_calendar: {
    id: "google_calendar",
    safeDisplayName: "Google Calendar",
    description: "Import availability and create approved calendar events.",
    authType: "oauth2",
    capabilities: ["read_calendar", "check_availability", "create_calendar_event"],
    requiredScopes: ["google.calendar.read", "google.calendar.events"],
    scopeLabels: ["Import availability", "Create approved events"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "read_calendar",
        safeLabel: "Import calendar context",
        requiredCapabilities: ["read_calendar"],
        requiredScopes: ["google.calendar.read"],
        approval: "never",
        handlerKey: "google_calendar.read",
      },
      {
        type: "check_availability",
        safeLabel: "Check availability",
        requiredCapabilities: ["check_availability"],
        requiredScopes: ["google.calendar.read"],
        approval: "never",
        handlerKey: "google_calendar.availability",
      },
      {
        type: "create_calendar_event",
        safeLabel: "Create approved events",
        requiredCapabilities: ["create_calendar_event"],
        requiredScopes: ["google.calendar.events"],
        approval: "always",
        sensitiveActionKind: "create_calendar_event",
        handlerKey: "google_calendar.create_event",
      },
    ],
  },
  payments: {
    id: "payments",
    safeDisplayName: "Payments",
    description: "Read payment status and prepare approved charges.",
    authType: "api_key",
    capabilities: ["read_payments", "spend_money"],
    requiredScopes: ["payments.read", "payments.charge"],
    scopeLabels: ["Read payment status", "Create approved charges"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "read_payments",
        safeLabel: "Read payment status",
        requiredCapabilities: ["read_payments"],
        requiredScopes: ["payments.read"],
        approval: "never",
        handlerKey: "payments.read",
      },
      {
        type: "charge_payment",
        safeLabel: "Create approved charges",
        requiredCapabilities: ["spend_money"],
        requiredScopes: ["payments.charge"],
        approval: "always",
        sensitiveActionKind: "spend_money",
        handlerKey: "payments.charge",
      },
    ],
  },
  publishing: {
    id: "publishing",
    safeDisplayName: "Publishing",
    description: "Publish approved posts and update approved live content.",
    authType: "oauth2",
    capabilities: ["post_externally", "change_live_asset"],
    requiredScopes: ["publishing.post", "publishing.manage"],
    scopeLabels: ["Publish approved posts", "Update approved live content"],
    connectionStatus: "not_connected",
    approvalPolicy: "always",
    actions: [
      {
        type: "publish_post",
        safeLabel: "Publish approved posts",
        requiredCapabilities: ["post_externally"],
        requiredScopes: ["publishing.post"],
        approval: "always",
        sensitiveActionKind: "post_externally",
        handlerKey: "publishing.post",
      },
      {
        type: "update_live_asset",
        safeLabel: "Update approved live content",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["publishing.manage"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "publishing.update",
      },
    ],
  },
  knowledge: {
    id: "knowledge",
    safeDisplayName: "Knowledge base",
    description: "Read and organize approved business records.",
    authType: "oauth2",
    capabilities: ["read_business_records", "write_business_records"],
    requiredScopes: ["records.read", "records.write"],
    scopeLabels: ["Read business records", "Organize approved records"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "read_records",
        safeLabel: "Read business records",
        requiredCapabilities: ["read_business_records"],
        requiredScopes: ["records.read"],
        approval: "never",
        handlerKey: "knowledge.read",
      },
      {
        type: "write_record",
        safeLabel: "Organize approved records",
        requiredCapabilities: ["write_business_records"],
        requiredScopes: ["records.write"],
        approval: "never",
        handlerKey: "knowledge.write",
      },
    ],
  },
  code_hosting: {
    id: "code_hosting",
    safeDisplayName: "Code hosting",
    description: "Publish approved previews and update approved live code.",
    authType: "oauth2",
    capabilities: ["publish_preview", "change_live_asset"],
    requiredScopes: ["code.preview", "code.write"],
    scopeLabels: ["Publish approved previews", "Update approved live code"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "publish_preview",
        safeLabel: "Publish approved previews",
        requiredCapabilities: ["publish_preview"],
        requiredScopes: ["code.preview"],
        approval: "always",
        sensitiveActionKind: "publish_preview",
        handlerKey: "code.preview",
      },
      {
        type: "update_live_asset",
        safeLabel: "Update approved live code",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["code.write"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "code.update",
      },
    ],
  },
  vercel: {
    id: "vercel",
    safeDisplayName: "Website previews",
    description: "Create review links for sites and tools, and update live sites after approval.",
    authType: "api_key",
    capabilities: ["create_preview_deployment", "change_live_asset"],
    requiredScopes: ["web.preview", "web.publish"],
    scopeLabels: ["Create review links", "Update approved live sites"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "create_preview_deployment",
        safeLabel: "Create review links",
        requiredCapabilities: ["create_preview_deployment"],
        requiredScopes: ["web.preview"],
        approval: "never",
        handlerKey: "vercel.preview",
      },
      {
        type: "publish_live_deployment",
        safeLabel: "Update approved live sites",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["web.publish"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "vercel.publish",
      },
    ],
  },
};

export function listConnectorDefinitions() {
  return Object.values(connectorRegistry);
}

export function getConnectorDefinition(connectorId: string) {
  return connectorRegistry[connectorId];
}

export function getConnectorAction(definition: ConnectorDefinition, actionType: string) {
  return definition.actions.find((action) => action.type === actionType);
}

export function publicConnectorDefinition(definition: ConnectorDefinition) {
  return {
    id: definition.id,
    safeDisplayName: definition.safeDisplayName,
    description: definition.description,
    authType: definition.authType,
    capabilities: definition.capabilities,
    requiredAccess: definition.scopeLabels,
    connectionStatus: definition.connectionStatus,
    approvalPolicy: definition.approvalPolicy,
    actions: definition.actions.map((action) => ({
      type: action.type,
      safeLabel: action.safeLabel,
      approval: action.approval,
      requiredCapabilities: action.requiredCapabilities,
    })),
  };
}

export function publicConnectionCard(
  definition: ConnectorDefinition,
  connection?: ConnectorConnectionLike & { _id?: unknown },
) {
  const status = testConnectorConnection(definition, connection);
  return {
    ...publicConnectorDefinition(definition),
    connectionId: connection?._id,
    status: status.status,
    statusMessage: status.safeMessage,
    healthy: status.healthy,
    connectedAt: connection?.connectedAt,
    lastTestedAt: connection?.lastTestedAt,
  };
}

export function missingRequiredScopes(requiredScopes: string[], grantedScopes?: string[]) {
  const granted = new Set(grantedScopes ?? []);
  return requiredScopes.filter((scope) => !granted.has(scope));
}

function cleanSettingString(value: unknown, maxLength = 160) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return cleaned || undefined;
}

function cleanPathSetting(value: unknown) {
  const cleaned = cleanSettingString(value, 180);
  if (!cleaned) return undefined;
  return cleaned.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\.(\/|$)/g, "");
}

function cleanDomainSetting(value: unknown) {
  const cleaned = cleanSettingString(value, 180);
  if (!cleaned) return undefined;
  return cleaned
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function cleanEmailSetting(value: unknown) {
  const cleaned = cleanSettingString(value, 180);
  if (!cleaned || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleaned)) return undefined;
  return cleaned.toLowerCase();
}

export function sanitizeVercelConnectionSettings(settings?: unknown): VercelConnectionSettings {
  const source = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};

  return {
    projectId: cleanSettingString(source.projectId),
    projectName: cleanSettingString(source.projectName),
    teamId: cleanSettingString(source.teamId),
    productionDomain: cleanDomainSetting(source.productionDomain),
    rootDirectory: cleanPathSetting(source.rootDirectory),
    framework: cleanSettingString(source.framework, 80),
    buildCommand: cleanSettingString(source.buildCommand, 240),
    installCommand: cleanSettingString(source.installCommand, 240),
    outputDirectory: cleanPathSetting(source.outputDirectory),
  };
}

export function sanitizeGoogleWorkspaceConnectionSettings(
  settings?: unknown,
): GoogleWorkspaceConnectionSettings {
  const source = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};

  return {
    accountEmail: cleanEmailSetting(source.accountEmail),
    calendarName: cleanSettingString(source.calendarName, 120),
    calendarId: cleanSettingString(source.calendarId, 180),
  };
}

export function sanitizeConnectorConnectionSettings(connectorId: string, settings?: unknown) {
  if (connectorId === "vercel") {
    const sanitized = sanitizeVercelConnectionSettings(settings);
    const entries = Object.entries(sanitized).filter(
      ([, value]) => typeof value === "string" && value.length > 0,
    );
    return entries.length > 0 ? Object.fromEntries(
      entries,
    ) : undefined;
  }

  if (connectorId === "gmail" || connectorId === "google_calendar") {
    const sanitized = sanitizeGoogleWorkspaceConnectionSettings(settings);
    const entries = Object.entries(sanitized).filter(
      ([, value]) => typeof value === "string" && value.length > 0,
    );
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  return undefined;
}

function hasVercelProjectSettings(settings?: unknown) {
  const sanitized = sanitizeVercelConnectionSettings(settings);
  return Boolean(sanitized.projectId || sanitized.projectName);
}

export function testConnectorConnection(
  definition: ConnectorDefinition,
  connection?: ConnectorConnectionLike | null,
): ConnectorStatusResult {
  if (!connection) {
    return {
      status: "not_connected",
      safeMessage: "Not connected yet.",
      healthy: false,
    };
  }

  if (connection.status === "disabled" || connection.disabledAt) {
    return {
      status: "disabled",
      safeMessage: "Turned off.",
      healthy: false,
    };
  }

  if (!connection.credentialRef) {
    return {
      status: "needs_attention",
      safeMessage: "Finish connecting this service before FounderOS uses it.",
      healthy: false,
    };
  }

  if (definition.id === "vercel" && !hasVercelProjectSettings(connection.settings)) {
    return {
      status: "needs_attention",
      safeMessage: "Choose the site or tool before FounderOS uses this connection.",
      healthy: false,
    };
  }

  const missingScopes = missingRequiredScopes(definition.requiredScopes, connection.grantedScopes);
  if (missingScopes.length > 0) {
    return {
      status: "needs_attention",
      safeMessage: "This service needs updated access before FounderOS uses it.",
      healthy: false,
    };
  }

  return {
    status: "connected",
    safeMessage: "Connected and ready.",
    healthy: true,
  };
}

function testBaseConnectorConnection(connection?: ConnectorConnectionLike | null): ConnectorStatusResult {
  if (!connection) {
    return {
      status: "not_connected",
      safeMessage: "Not connected yet.",
      healthy: false,
    };
  }

  if (connection.status === "disabled" || connection.disabledAt) {
    return {
      status: "disabled",
      safeMessage: "Turned off.",
      healthy: false,
    };
  }

  if (!connection.credentialRef) {
    return {
      status: "needs_attention",
      safeMessage: "Finish connecting this service before FounderOS uses it.",
      healthy: false,
    };
  }

  return {
    status: "connected",
    safeMessage: "Connected and ready.",
    healthy: true,
  };
}

export function connectorActionRequiresApproval(
  definition: ConnectorDefinition,
  action: ConnectorActionDefinition,
) {
  if (definition.approvalPolicy === "always") return true;
  if (action.approval === "always") return true;
  return action.requiredCapabilities.some((capability) => sensitiveCapabilities.has(capability));
}

export function evaluateConnectorActionRequest(args: {
  connectorId: string;
  actionType: string;
  connection?: ConnectorConnectionLike | null;
  grantedScopes?: string[];
  approvalGranted?: boolean;
}): ConnectorActionEvaluation {
  const definition = getConnectorDefinition(args.connectorId);
  if (!definition) {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "unknown_connector",
      safeMessage: "That service is not available yet.",
    };
  }

  const action = getConnectorAction(definition, args.actionType);
  if (!action) {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "unknown_action",
      safeMessage: "That action is not available for this service.",
    };
  }

  const status = testBaseConnectorConnection(args.connection);
  if (status.status === "disabled") {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "disabled",
      safeMessage: "This service is turned off.",
    };
  }
  if (status.status !== "connected") {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "not_connected",
      safeMessage: status.safeMessage,
    };
  }

  const missingScopes = missingRequiredScopes(
    action.requiredScopes,
    args.grantedScopes ?? args.connection?.grantedScopes,
  );
  if (missingScopes.length > 0) {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "missing_permission",
      safeMessage: "This service needs updated access before FounderOS can do that.",
    };
  }

  const approvalRequired = connectorActionRequiresApproval(definition, action);
  if (approvalRequired && !args.approvalGranted) {
    return {
      allowed: false,
      approvalRequired,
      reason: "approval_required",
      safeMessage: "This needs your approval first.",
      sensitiveActionKind: action.sensitiveActionKind,
    };
  }

  return {
    allowed: true,
    approvalRequired,
    reason: "ready",
    safeMessage: "Ready.",
    sensitiveActionKind: action.sensitiveActionKind,
  };
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function secretPreview(secret: string) {
  const visible = secret.trim().slice(-4);
  return visible ? `****${visible}` : "stored securely";
}

export const connectorCredentialStorage = {
  seal(args: {
    workspaceId: string;
    connectorId: string;
    secret: string;
    now: number;
    keyVersion?: string;
  }): ConnectorCredentialEnvelope {
    const cleanSecret = args.secret.trim();
    if (!cleanSecret) {
      throw new Error("A credential is required.");
    }

    const fingerprint = stableHash(`${args.connectorId}:${cleanSecret}`);
    const vaultKey = [
      "connector",
      args.workspaceId,
      args.connectorId,
      fingerprint,
    ].join(":");

    return {
      storageProvider: "founderos_managed_vault",
      vaultKey,
      sealedReference: `sealed:${stableHash(`${vaultKey}:${args.now}`)}`,
      fingerprint,
      keyVersion: args.keyVersion ?? "managed-v1",
      secretPreview: secretPreview(cleanSecret),
      createdAt: args.now,
    };
  },

  publicMetadata(envelope: ConnectorCredentialEnvelope) {
    return {
      storageProvider: envelope.storageProvider,
      fingerprint: envelope.fingerprint,
      keyVersion: envelope.keyVersion,
      secretPreview: envelope.secretPreview,
      createdAt: envelope.createdAt,
    };
  },
};

export function safeConnectorError(error: unknown, fallback = "The connection could not finish that step.") {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const scrubbed = raw
    .replace(/https?:\/\/\S+/gi, "the service")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(sk|pk|rk|ghp|xox[baprs]?|ya29)[-_A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, "private detail")
    .replace(/\{[\s\S]*\}/g, "details")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !scrubbed ||
    /api|endpoint|stack|trace|stdout|stderr|payload|json|token|secret|key|credential|http|response/i.test(scrubbed)
  ) {
    return fallback;
  }

  return scrubbed.slice(0, 180);
}

const safeNoopHandler: ConnectorActionHandler = async ({ actionType }) => ({
  status: "completed",
  safeSummary: safeActionSummary(actionType),
});

export const connectorActionHandlers: Record<string, ConnectorActionHandler> = {
  "email.read": safeNoopHandler,
  "email.send": safeNoopHandler,
  "gmail.read": safeNoopHandler,
  "gmail.draft": safeNoopHandler,
  "gmail.send": safeNoopHandler,
  "calendar.read": safeNoopHandler,
  "calendar.schedule": safeNoopHandler,
  "google_calendar.read": safeNoopHandler,
  "google_calendar.availability": safeNoopHandler,
  "google_calendar.create_event": safeNoopHandler,
  "payments.read": safeNoopHandler,
  "payments.charge": safeNoopHandler,
  "publishing.post": safeNoopHandler,
  "publishing.update": safeNoopHandler,
  "knowledge.read": safeNoopHandler,
  "knowledge.write": safeNoopHandler,
  "code.preview": safeNoopHandler,
  "code.update": safeNoopHandler,
  "vercel.preview": safeNoopHandler,
  "vercel.publish": safeNoopHandler,
};

export function getConnectorActionHandler(handlerKey: string) {
  return connectorActionHandlers[handlerKey];
}

export function safeActionSummary(actionType: string) {
  const labels: Record<string, string> = {
    read_email: "Email access is ready.",
    draft_email: "The email draft is ready.",
    send_email: "The approved email step is ready.",
    read_calendar: "Calendar access is ready.",
    check_availability: "Availability is ready.",
    create_calendar_event: "The approved calendar event step is ready.",
    schedule_meeting: "The approved meeting step is ready.",
    read_payments: "Payment status access is ready.",
    charge_payment: "The approved payment step is ready.",
    publish_post: "The approved publishing step is ready.",
    update_live_asset: "The approved live update is ready.",
    read_records: "Business records access is ready.",
    write_record: "The record update is ready.",
    create_preview_deployment: "The review link is ready.",
    publish_preview: "The approved preview step is ready.",
    publish_live_deployment: "The approved live update is ready.",
  };

  return labels[actionType] ?? "The approved step is ready.";
}
