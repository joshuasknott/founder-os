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
  "import_content",
  "export_content",
  "query_analytics",
  "send_transactional_email",
  "create_design",
  "import_repository_context",
  "write_code",
  "run_code_builder",
] as const;

export type ConnectorCapability = (typeof connectorCapabilities)[number];

export type ConnectorAuthType = "oauth2" | "api_key" | "webhook" | "github_app" | "managed";
export type ConnectorConnectionStatus =
  | "not_connected"
  | "needs_attention"
  | "connected"
  | "disabled";
export type ConnectorApprovalPolicy = "never" | "per_sensitive_action" | "always";
export type ConnectorActionApproval = "never" | "always" | "blocked";

export type ConnectorActionType =
  | "read_email"
  | "draft_email"
  | "send_email"
  | "read_calendar"
  | "check_availability"
  | "create_calendar_event"
  | "schedule_meeting"
  | "read_payments"
  | "sync_stripe_customers"
  | "sync_stripe_products"
  | "sync_stripe_prices"
  | "sync_stripe_invoices"
  | "sync_stripe_subscriptions"
  | "sync_stripe_revenue"
  | "sync_stripe_finance_context"
  | "charge_payment"
  | "refund_payment"
  | "cancel_subscription"
  | "delete_external_record"
  | "publish_post"
  | "update_live_asset"
  | "read_records"
  | "write_record"
  | "import_content"
  | "export_content"
  | "post_message"
  | "update_external_record"
  | "create_preview_deployment"
  | "publish_preview"
  | "publish_live_deployment"
  | "query_analytics"
  | "send_transactional_email"
  | "create_design"
  | "export_design"
  | "import_repository_context"
  | "create_pull_request"
  | "create_issue"
  | "run_code_builder";

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
  blockedSafeMessage?: string;
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
    | "blocked_by_policy"
    | "unknown_connector"
    | "unknown_action";
  safeMessage: string;
  sensitiveActionKind?: ConnectorActionDefinition["sensitiveActionKind"];
};

export type ConnectorCredentialEnvelope = {
  storageProvider: "founderos_encrypted_secret_store";
  vaultKey: string;
  sealedReference: string;
  encryptedSecret: string;
  encryptionAlgorithm: "AES-GCM";
  encryptionNonce: string;
  fingerprint: string;
  keyVersion: string;
  secretPreview: string;
  tokenExpiresAt?: number;
  refreshCredentialRef?: string;
  metadata?: Record<string, unknown>;
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

export type ContentConnectorConnectionSettings = {
  accountEmail?: string;
  workspaceName?: string;
  defaultLocation?: string;
  channelName?: string;
};

export type GitHubConnectionSettings = {
  accountName?: string;
  organizationName?: string;
  repositoryOwner?: string;
  repositoryName?: string;
  installationId?: string;
};

export type PostHogConnectionSettings = {
  host?: string;
  projectId?: string;
  projectName?: string;
};

export type ResendConnectionSettings = {
  senderEmail?: string;
  senderDomain?: string;
};

export type CanvaConnectionSettings = {
  accountEmail?: string;
  teamName?: string;
  brandFolderName?: string;
  defaultDesignType?: string;
};

export type OpenCodeConnectionSettings = {
  command?: string;
  model?: string;
  modelLow?: string;
  modelMedium?: string;
  modelHigh?: string;
  agent?: string;
  attachUrl?: string;
};

export type ApiKeyConnectorId = "stripe" | "vercel" | "posthog" | "resend";

export type ApiKeyConnectorSetupValidation = {
  ok: boolean;
  connectorId?: ApiKeyConnectorId;
  grantedScopes: string[];
  settings?: Record<string, unknown>;
  status: ConnectorConnectionStatus;
  safeMessage: string;
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
  "export_content",
  "send_transactional_email",
  "write_code",
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
  google_drive: {
    id: "google_drive",
    safeDisplayName: "Google Drive",
    description: "Import files and export approved Library items.",
    authType: "oauth2",
    capabilities: ["read_business_records", "write_business_records", "import_content", "export_content"],
    requiredScopes: ["google.drive.read", "google.drive.file"],
    scopeLabels: ["Import files", "Export approved Library items"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "import_content",
        safeLabel: "Import files",
        requiredCapabilities: ["read_business_records", "import_content"],
        requiredScopes: ["google.drive.read"],
        approval: "never",
        handlerKey: "google_drive.import",
      },
      {
        type: "export_content",
        safeLabel: "Export approved Library items",
        requiredCapabilities: ["write_business_records", "export_content"],
        requiredScopes: ["google.drive.file"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "google_drive.export",
      },
      {
        type: "update_external_record",
        safeLabel: "Update approved files",
        requiredCapabilities: ["write_business_records", "change_live_asset"],
        requiredScopes: ["google.drive.file"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "google_drive.update",
      },
    ],
  },
  google_docs: {
    id: "google_docs",
    safeDisplayName: "Google Docs",
    description: "Import documents and export or update approved Library drafts.",
    authType: "oauth2",
    capabilities: ["read_business_records", "write_business_records", "import_content", "export_content"],
    requiredScopes: ["google.docs.read", "google.docs.file"],
    scopeLabels: ["Import documents", "Export approved documents"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "import_content",
        safeLabel: "Import documents",
        requiredCapabilities: ["read_business_records", "import_content"],
        requiredScopes: ["google.docs.read"],
        approval: "never",
        handlerKey: "google_docs.import",
      },
      {
        type: "export_content",
        safeLabel: "Export approved documents",
        requiredCapabilities: ["write_business_records", "export_content"],
        requiredScopes: ["google.docs.file"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "google_docs.export",
      },
      {
        type: "update_external_record",
        safeLabel: "Update approved documents",
        requiredCapabilities: ["write_business_records", "change_live_asset"],
        requiredScopes: ["google.docs.file"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "google_docs.update",
      },
    ],
  },
  google_sheets: {
    id: "google_sheets",
    safeDisplayName: "Google Sheets",
    description: "Import spreadsheet context and export or update approved Library tables.",
    authType: "oauth2",
    capabilities: ["read_business_records", "write_business_records", "import_content", "export_content"],
    requiredScopes: ["google.sheets.read", "google.sheets.write"],
    scopeLabels: ["Import spreadsheets", "Export approved spreadsheets"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "import_content",
        safeLabel: "Import spreadsheets",
        requiredCapabilities: ["read_business_records", "import_content"],
        requiredScopes: ["google.sheets.read"],
        approval: "never",
        handlerKey: "google_sheets.import",
      },
      {
        type: "export_content",
        safeLabel: "Export approved spreadsheets",
        requiredCapabilities: ["write_business_records", "export_content"],
        requiredScopes: ["google.sheets.write"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "google_sheets.export",
      },
      {
        type: "update_external_record",
        safeLabel: "Update approved spreadsheets",
        requiredCapabilities: ["write_business_records", "change_live_asset"],
        requiredScopes: ["google.sheets.write"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "google_sheets.update",
      },
    ],
  },
  github: {
    id: "github",
    safeDisplayName: "GitHub",
    description: "Import repository context and prepare approved repository changes.",
    authType: "github_app",
    capabilities: ["import_repository_context", "read_business_records", "write_business_records", "write_code", "change_live_asset", "import_content"],
    requiredScopes: ["github.metadata", "github.contents.read", "github.pull_requests.write", "github.issues.write"],
    scopeLabels: ["Import repository context", "Prepare approved repository changes"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "import_repository_context",
        safeLabel: "Import repository context",
        requiredCapabilities: ["import_repository_context", "read_business_records", "import_content"],
        requiredScopes: ["github.metadata", "github.contents.read"],
        approval: "never",
        handlerKey: "github.import_repository_context",
      },
      {
        type: "create_pull_request",
        safeLabel: "Create approved pull requests",
        requiredCapabilities: ["write_code", "change_live_asset"],
        requiredScopes: ["github.pull_requests.write", "github.contents.read"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "github.create_pull_request",
      },
      {
        type: "create_issue",
        safeLabel: "Create approved issues",
        requiredCapabilities: ["write_business_records"],
        requiredScopes: ["github.issues.write"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "github.create_issue",
      },
    ],
  },
  slack: {
    id: "slack",
    safeDisplayName: "Slack",
    description: "Import useful conversations and post or update approved messages.",
    authType: "oauth2",
    capabilities: ["read_business_records", "post_externally", "change_live_asset", "import_content"],
    requiredScopes: ["slack.history", "slack.post", "slack.update"],
    scopeLabels: ["Import conversations", "Post approved messages", "Update approved messages"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "import_content",
        safeLabel: "Import useful conversations",
        requiredCapabilities: ["read_business_records", "import_content"],
        requiredScopes: ["slack.history"],
        approval: "never",
        handlerKey: "slack.import",
      },
      {
        type: "post_message",
        safeLabel: "Post approved messages",
        requiredCapabilities: ["post_externally"],
        requiredScopes: ["slack.post"],
        approval: "always",
        sensitiveActionKind: "post_externally",
        handlerKey: "slack.post",
      },
      {
        type: "update_external_record",
        safeLabel: "Update approved messages",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["slack.update"],
        approval: "always",
        sensitiveActionKind: "post_externally",
        handlerKey: "slack.update",
      },
    ],
  },
  notion: {
    id: "notion",
    safeDisplayName: "Notion",
    description: "Import pages and export or update approved workspace records.",
    authType: "oauth2",
    capabilities: ["read_business_records", "write_business_records", "change_live_asset", "import_content", "export_content"],
    requiredScopes: ["notion.read", "notion.write"],
    scopeLabels: ["Import pages", "Export approved records", "Update approved records"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "import_content",
        safeLabel: "Import pages",
        requiredCapabilities: ["read_business_records", "import_content"],
        requiredScopes: ["notion.read"],
        approval: "never",
        handlerKey: "notion.import",
      },
      {
        type: "export_content",
        safeLabel: "Export approved records",
        requiredCapabilities: ["write_business_records", "export_content"],
        requiredScopes: ["notion.write"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "notion.export",
      },
      {
        type: "update_external_record",
        safeLabel: "Update approved records",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["notion.write"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "notion.update",
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
  stripe: {
    id: "stripe",
    safeDisplayName: "Stripe",
    description: "Sync read-only customers, products, prices, invoices, subscriptions, and revenue summaries.",
    authType: "api_key",
    capabilities: ["read_payments", "read_business_records", "import_content"],
    requiredScopes: ["stripe.read"],
    scopeLabels: [
      "Sync customer and subscription context",
      "Sync product and pricing context",
      "Sync invoice and revenue summaries",
    ],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "sync_stripe_customers",
        safeLabel: "Sync customers",
        requiredCapabilities: ["read_payments", "read_business_records", "import_content"],
        requiredScopes: ["stripe.read"],
        approval: "never",
        handlerKey: "stripe.sync_customers",
      },
      {
        type: "sync_stripe_products",
        safeLabel: "Sync products",
        requiredCapabilities: ["read_payments", "read_business_records", "import_content"],
        requiredScopes: ["stripe.read"],
        approval: "never",
        handlerKey: "stripe.sync_products",
      },
      {
        type: "sync_stripe_prices",
        safeLabel: "Sync prices",
        requiredCapabilities: ["read_payments", "read_business_records", "import_content"],
        requiredScopes: ["stripe.read"],
        approval: "never",
        handlerKey: "stripe.sync_prices",
      },
      {
        type: "sync_stripe_invoices",
        safeLabel: "Sync invoices",
        requiredCapabilities: ["read_payments", "read_business_records", "import_content"],
        requiredScopes: ["stripe.read"],
        approval: "never",
        handlerKey: "stripe.sync_invoices",
      },
      {
        type: "sync_stripe_subscriptions",
        safeLabel: "Sync subscriptions",
        requiredCapabilities: ["read_payments", "read_business_records", "import_content"],
        requiredScopes: ["stripe.read"],
        approval: "never",
        handlerKey: "stripe.sync_subscriptions",
      },
      {
        type: "sync_stripe_revenue",
        safeLabel: "Sync revenue summaries",
        requiredCapabilities: ["read_payments", "read_business_records", "import_content"],
        requiredScopes: ["stripe.read"],
        approval: "never",
        handlerKey: "stripe.sync_revenue",
      },
      {
        type: "sync_stripe_finance_context",
        safeLabel: "Sync finance context",
        requiredCapabilities: ["read_payments", "read_business_records", "import_content"],
        requiredScopes: ["stripe.read"],
        approval: "never",
        handlerKey: "stripe.sync_finance_context",
      },
      {
        type: "charge_payment",
        safeLabel: "Create charges",
        requiredCapabilities: ["spend_money"],
        requiredScopes: ["stripe.write"],
        approval: "blocked",
        sensitiveActionKind: "spend_money",
        handlerKey: "stripe.blocked",
        blockedSafeMessage: "Stripe money movement is blocked by policy. FounderOS can only sync read-only finance context for this connection.",
      },
      {
        type: "refund_payment",
        safeLabel: "Issue refunds",
        requiredCapabilities: ["spend_money"],
        requiredScopes: ["stripe.write"],
        approval: "blocked",
        sensitiveActionKind: "spend_money",
        handlerKey: "stripe.blocked",
        blockedSafeMessage: "Stripe refunds are blocked by policy. FounderOS can only sync read-only finance context for this connection.",
      },
      {
        type: "cancel_subscription",
        safeLabel: "Cancel subscriptions",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["stripe.write"],
        approval: "blocked",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "stripe.blocked",
        blockedSafeMessage: "Stripe subscription changes are blocked by policy. FounderOS can only sync read-only finance context for this connection.",
      },
      {
        type: "update_external_record",
        safeLabel: "Update Stripe records",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["stripe.write"],
        approval: "blocked",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "stripe.blocked",
        blockedSafeMessage: "Stripe record changes are blocked by policy. FounderOS can only sync read-only finance context for this connection.",
      },
      {
        type: "delete_external_record",
        safeLabel: "Delete Stripe records",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["stripe.write"],
        approval: "blocked",
        sensitiveActionKind: "delete_data",
        handlerKey: "stripe.blocked",
        blockedSafeMessage: "Stripe deletion is blocked by policy. FounderOS can only sync read-only finance context for this connection.",
      },
    ],
  },
  posthog: {
    id: "posthog",
    safeDisplayName: "PostHog",
    description: "Import product analytics summaries and answer product usage questions.",
    authType: "api_key",
    capabilities: ["query_analytics", "read_business_records", "import_content"],
    requiredScopes: ["posthog.read"],
    scopeLabels: ["Read product analytics", "Import summarized insights"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "query_analytics",
        safeLabel: "Query analytics",
        requiredCapabilities: ["query_analytics", "read_business_records"],
        requiredScopes: ["posthog.read"],
        approval: "never",
        handlerKey: "posthog.query",
      },
      {
        type: "import_content",
        safeLabel: "Import product insights",
        requiredCapabilities: ["query_analytics", "import_content"],
        requiredScopes: ["posthog.read"],
        approval: "never",
        handlerKey: "posthog.import",
      },
      {
        type: "update_external_record",
        safeLabel: "Update analytics configuration",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["posthog.write"],
        approval: "blocked",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "posthog.blocked",
        blockedSafeMessage: "PostHog changes are blocked in this version. FounderOS can only read analytics and import summaries.",
      },
    ],
  },
  resend: {
    id: "resend",
    safeDisplayName: "Resend",
    description: "Prepare outbound emails and send them only after approval.",
    authType: "api_key",
    capabilities: ["draft_email", "send_transactional_email", "send_email"],
    requiredScopes: ["resend.send"],
    scopeLabels: ["Prepare emails", "Send approved emails"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "draft_email",
        safeLabel: "Prepare email drafts",
        requiredCapabilities: ["draft_email"],
        requiredScopes: ["resend.send"],
        approval: "never",
        handlerKey: "resend.draft",
      },
      {
        type: "send_transactional_email",
        safeLabel: "Send approved emails",
        requiredCapabilities: ["send_transactional_email", "send_email"],
        requiredScopes: ["resend.send"],
        approval: "always",
        sensitiveActionKind: "send_email",
        handlerKey: "resend.send",
      },
    ],
  },
  canva: {
    id: "canva",
    safeDisplayName: "Canva",
    description: "Create design drafts, import assets, and export reviewable design files.",
    authType: "oauth2",
    capabilities: ["create_design", "read_business_records", "write_business_records", "import_content", "export_content"],
    requiredScopes: ["canva.design.read", "canva.design.write", "canva.asset.read"],
    scopeLabels: ["Create design drafts", "Import design assets", "Export review files"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "create_design",
        safeLabel: "Create design drafts",
        requiredCapabilities: ["create_design", "write_business_records"],
        requiredScopes: ["canva.design.write"],
        approval: "never",
        handlerKey: "canva.create_design",
      },
      {
        type: "import_content",
        safeLabel: "Import design assets",
        requiredCapabilities: ["read_business_records", "import_content"],
        requiredScopes: ["canva.asset.read"],
        approval: "never",
        handlerKey: "canva.import",
      },
      {
        type: "export_design",
        safeLabel: "Export review files",
        requiredCapabilities: ["export_content", "read_business_records"],
        requiredScopes: ["canva.design.read"],
        approval: "never",
        handlerKey: "canva.export_design",
      },
      {
        type: "update_external_record",
        safeLabel: "Update approved designs",
        requiredCapabilities: ["change_live_asset"],
        requiredScopes: ["canva.design.write"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "canva.update",
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
  opencode: {
    id: "opencode",
    safeDisplayName: "OpenCode",
    description: "Run private product-building work and return review artifacts.",
    authType: "managed",
    capabilities: ["run_code_builder", "write_code", "create_preview_deployment"],
    requiredScopes: ["opencode.run"],
    scopeLabels: ["Run private builder work"],
    connectionStatus: "not_connected",
    approvalPolicy: "per_sensitive_action",
    actions: [
      {
        type: "run_code_builder",
        safeLabel: "Run builder work",
        requiredCapabilities: ["run_code_builder", "write_code"],
        requiredScopes: ["opencode.run"],
        approval: "never",
        handlerKey: "opencode.run",
      },
      {
        type: "update_live_asset",
        safeLabel: "Apply approved code changes",
        requiredCapabilities: ["write_code", "change_live_asset"],
        requiredScopes: ["opencode.run"],
        approval: "always",
        sensitiveActionKind: "change_live_asset",
        handlerKey: "opencode.apply",
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
  const safeSettings = definition.id === "opencode"
    ? definedSettings(sanitizeOpenCodeConnectionSettings(connection?.settings))
    : undefined;
  return {
    ...publicConnectorDefinition(definition),
    connectionId: connection?._id,
    status: status.status,
    statusMessage: status.safeMessage,
    healthy: status.healthy,
    connectedAt: connection?.connectedAt,
    lastTestedAt: connection?.lastTestedAt,
    safeSettings,
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

function cleanHostSetting(value: unknown) {
  const cleaned = cleanSettingString(value, 240);
  if (!cleaned) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`);
    if (url.protocol !== "https:") return undefined;
    return url.origin.toLowerCase();
  } catch {
    return undefined;
  }
}

function cleanOpenCodeAttachUrl(value: unknown) {
  const cleaned = cleanSettingString(value, 240);
  if (!cleaned) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(cleaned) ? cleaned : `http://${cleaned}`);
    const hostname = url.hostname.toLowerCase();
    const isLocalHttp =
      url.protocol === "http:" &&
      (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1");
    if (url.protocol !== "https:" && !isLocalHttp) return undefined;
    return url.origin.toLowerCase();
  } catch {
    return undefined;
  }
}

function cleanIdSetting(value: unknown, maxLength = 120) {
  const cleaned = cleanSettingString(value, maxLength);
  if (!cleaned) return undefined;
  return cleaned.replace(/[^A-Za-z0-9._:-]/g, "");
}

export function sanitizeContentConnectorConnectionSettings(
  settings?: unknown,
): ContentConnectorConnectionSettings {
  const source = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};

  return {
    accountEmail: cleanEmailSetting(source.accountEmail),
    workspaceName: cleanSettingString(source.workspaceName, 120),
    defaultLocation: cleanSettingString(source.defaultLocation, 160),
    channelName: cleanSettingString(source.channelName, 120),
  };
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

export function sanitizeGitHubConnectionSettings(settings?: unknown): GitHubConnectionSettings {
  const source = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};

  return {
    accountName: cleanIdSetting(source.accountName),
    organizationName: cleanIdSetting(source.organizationName),
    repositoryOwner: cleanIdSetting(source.repositoryOwner),
    repositoryName: cleanIdSetting(source.repositoryName),
    installationId: cleanIdSetting(source.installationId),
  };
}

export function sanitizePostHogConnectionSettings(settings?: unknown): PostHogConnectionSettings {
  const source = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};

  return {
    host: cleanHostSetting(source.host),
    projectId: cleanIdSetting(source.projectId),
    projectName: cleanSettingString(source.projectName, 120),
  };
}

export function sanitizeResendConnectionSettings(settings?: unknown): ResendConnectionSettings {
  const source = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};

  return {
    senderEmail: cleanEmailSetting(source.senderEmail),
    senderDomain: cleanDomainSetting(source.senderDomain),
  };
}

export function sanitizeCanvaConnectionSettings(settings?: unknown): CanvaConnectionSettings {
  const source = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};

  return {
    accountEmail: cleanEmailSetting(source.accountEmail),
    teamName: cleanSettingString(source.teamName, 120),
    brandFolderName: cleanSettingString(source.brandFolderName, 120),
    defaultDesignType: cleanSettingString(source.defaultDesignType, 80),
  };
}

export function sanitizeOpenCodeConnectionSettings(settings?: unknown): OpenCodeConnectionSettings {
  const source = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};

  return {
    command: cleanSettingString(source.command, 80),
    model: cleanSettingString(source.model, 120),
    modelLow: cleanSettingString(source.modelLow, 120),
    modelMedium: cleanSettingString(source.modelMedium, 120),
    modelHigh: cleanSettingString(source.modelHigh, 120),
    agent: cleanSettingString(source.agent, 120),
    attachUrl: cleanOpenCodeAttachUrl(source.attachUrl),
  };
}

function definedSettings<T extends Record<string, unknown>>(settings: T) {
  const entries = Object.entries(settings).filter(([, value]) => typeof value === "string" && value.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function sanitizeConnectorConnectionSettings(connectorId: string, settings?: unknown) {
  if (connectorId === "vercel") {
    return definedSettings(sanitizeVercelConnectionSettings(settings));
  }

  if (
    connectorId === "gmail" ||
    connectorId === "google_calendar" ||
    connectorId === "google_drive" ||
    connectorId === "google_docs" ||
    connectorId === "google_sheets"
  ) {
    return definedSettings(sanitizeGoogleWorkspaceConnectionSettings(settings));
  }

  if (connectorId === "github") {
    return definedSettings(sanitizeGitHubConnectionSettings(settings));
  }

  if (connectorId === "posthog") {
    return definedSettings(sanitizePostHogConnectionSettings(settings));
  }

  if (connectorId === "resend") {
    return definedSettings(sanitizeResendConnectionSettings(settings));
  }

  if (connectorId === "canva") {
    return definedSettings(sanitizeCanvaConnectionSettings(settings));
  }

  if (connectorId === "opencode") {
    return definedSettings(sanitizeOpenCodeConnectionSettings(settings));
  }

  if (connectorId === "slack" || connectorId === "notion") {
    return definedSettings(sanitizeContentConnectorConnectionSettings(settings));
  }

  return undefined;
}

const apiKeyConnectorScopes: Record<ApiKeyConnectorId, string[]> = {
  stripe: ["stripe.read"],
  vercel: ["web.preview", "web.publish"],
  posthog: ["posthog.read"],
  resend: ["resend.send"],
};

function isApiKeyConnectorId(connectorId: string): connectorId is ApiKeyConnectorId {
  return connectorId === "stripe" || connectorId === "vercel" || connectorId === "posthog" || connectorId === "resend";
}

function cleanCredentialCandidate(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isStripeRestrictedReadKey(value: string) {
  return /^rk_(test|live)_[A-Za-z0-9_]+$/.test(value);
}

function hasReasonablePrivateTokenShape(connectorId: ApiKeyConnectorId, value: string) {
  if (!value || value.length < 12 || /\s/.test(value)) return false;
  if (connectorId === "stripe") return isStripeRestrictedReadKey(value);
  if (connectorId === "resend") return /^re_[A-Za-z0-9_-]{8,}$/.test(value);
  if (connectorId === "posthog") return /^(phx|phc)_[A-Za-z0-9_-]{8,}$/.test(value);
  return value.length >= 16;
}

export function validateApiKeyConnectorSetup(args: {
  connectorId: string;
  credential: unknown;
  settings?: unknown;
}): ApiKeyConnectorSetupValidation {
  const definition = getConnectorDefinition(args.connectorId);
  if (!definition || !isApiKeyConnectorId(args.connectorId) || definition.authType !== "api_key") {
    return {
      ok: false,
      grantedScopes: [],
      status: "not_connected",
      safeMessage: "That service is not available for private key setup.",
    };
  }

  const credential = cleanCredentialCandidate(args.credential);
  if (!hasReasonablePrivateTokenShape(args.connectorId, credential)) {
    const message = args.connectorId === "stripe"
      ? "Use a restricted read-only Stripe key."
      : "Use a valid private key for this service.";
    return {
      ok: false,
      connectorId: args.connectorId,
      grantedScopes: [],
      status: "needs_attention",
      safeMessage: message,
    };
  }

  const grantedScopes = apiKeyConnectorScopes[args.connectorId];
  const settings = sanitizeConnectorConnectionSettings(args.connectorId, args.settings);
  const status = testConnectorConnection(definition, {
    status: "connected",
    credentialRef: "pending",
    grantedScopes,
    settings,
  });

  return {
    ok: true,
    connectorId: args.connectorId,
    grantedScopes,
    settings,
    status: status.status,
    safeMessage: status.safeMessage,
  };
}

function hasVercelProjectSettings(settings?: unknown) {
  const sanitized = sanitizeVercelConnectionSettings(settings);
  return Boolean(sanitized.projectId || sanitized.projectName);
}

function hasGitHubInstallSettings(settings?: unknown) {
  const sanitized = sanitizeGitHubConnectionSettings(settings);
  return Boolean(sanitized.installationId && (sanitized.repositoryName || sanitized.organizationName || sanitized.repositoryOwner));
}

function hasPostHogProjectSettings(settings?: unknown) {
  const sanitized = sanitizePostHogConnectionSettings(settings);
  return Boolean(sanitized.host && sanitized.projectId);
}

function hasResendSenderSettings(settings?: unknown) {
  const sanitized = sanitizeResendConnectionSettings(settings);
  return Boolean(sanitized.senderEmail || sanitized.senderDomain);
}

function hasOpenCodeSettings(settings?: unknown) {
  const sanitized = sanitizeOpenCodeConnectionSettings(settings);
  return Boolean(
    sanitized.command ||
    sanitized.model ||
    sanitized.modelLow ||
    sanitized.modelMedium ||
    sanitized.modelHigh ||
    sanitized.agent ||
    sanitized.attachUrl,
  );
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

  if (definition.id === "opencode") {
    if (!hasOpenCodeSettings(connection.settings)) {
      return {
        status: "needs_attention",
        safeMessage: "Choose how FounderOS should call OpenCode before using it.",
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
      safeMessage: "OpenCode is configured and ready.",
      healthy: true,
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

  if (definition.id === "github" && !hasGitHubInstallSettings(connection.settings)) {
    return {
      status: "needs_attention",
      safeMessage: "Choose the repository before FounderOS uses this connection.",
      healthy: false,
    };
  }

  if (definition.id === "posthog" && !hasPostHogProjectSettings(connection.settings)) {
    return {
      status: "needs_attention",
      safeMessage: "Choose the analytics project before FounderOS uses this connection.",
      healthy: false,
    };
  }

  if (definition.id === "resend" && !hasResendSenderSettings(connection.settings)) {
    return {
      status: "needs_attention",
      safeMessage: "Choose the sender before FounderOS uses this connection.",
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

export function connectorActionRequiresApproval(
  definition: ConnectorDefinition,
  action: ConnectorActionDefinition,
) {
  if (action.approval === "never") return false;
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

  if (action.approval === "blocked") {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "blocked_by_policy",
      safeMessage: action.blockedSafeMessage ?? "That action is blocked by policy.",
      sensitiveActionKind: action.sensitiveActionKind,
    };
  }

  if (!args.connection) {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "not_connected",
      safeMessage: "Not connected yet.",
    };
  }
  if (args.connection.status === "disabled" || args.connection.disabledAt) {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "disabled",
      safeMessage: "This service is turned off.",
    };
  }
  if (definition.id !== "opencode" && !args.connection.credentialRef) {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "not_connected",
      safeMessage: "Finish connecting this service before FounderOS uses it.",
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

  const status = testConnectorConnection(definition, args.connection);
  if (status.status !== "connected") {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "not_connected",
      safeMessage: status.safeMessage,
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

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function connectorEncryptionKey(keyMaterial?: string) {
  const encoder = new TextEncoder();
  const material = keyMaterial ?? process.env.CONNECTOR_SECRET_ENCRYPTION_KEY;
  if (!material) {
    throw new Error("CONNECTOR_SECRET_ENCRYPTION_KEY must be set. Add it to your environment variables.");
  }
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(material));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export const connectorCredentialStorage = {
  async seal(args: {
    workspaceId: string;
    connectorId: string;
    secret: string;
    now: number;
    keyVersion?: string;
    keyMaterial?: string;
    tokenExpiresAt?: number;
    refreshCredentialRef?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConnectorCredentialEnvelope> {
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
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const key = await connectorEncryptionKey(args.keyMaterial);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      encoder.encode(cleanSecret),
    );

    return {
      storageProvider: "founderos_encrypted_secret_store",
      vaultKey,
      sealedReference: `sealed:${stableHash(`${vaultKey}:${args.now}`)}`,
      encryptedSecret: bytesToBase64(new Uint8Array(encrypted)),
      encryptionAlgorithm: "AES-GCM",
      encryptionNonce: bytesToBase64(nonce),
      fingerprint,
      keyVersion: args.keyVersion ?? "managed-v1",
      secretPreview: secretPreview(cleanSecret),
      tokenExpiresAt: args.tokenExpiresAt,
      refreshCredentialRef: args.refreshCredentialRef,
      metadata: args.metadata,
      createdAt: args.now,
    };
  },

  async unseal(args: {
    encryptedSecret: string;
    encryptionNonce: string;
    keyMaterial?: string;
  }) {
    const key = await connectorEncryptionKey(args.keyMaterial);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(args.encryptionNonce) },
      key,
      base64ToBytes(args.encryptedSecret),
    );
    return new TextDecoder().decode(decrypted);
  },

  publicMetadata(envelope: ConnectorCredentialEnvelope) {
    return {
      storageProvider: envelope.storageProvider,
      fingerprint: envelope.fingerprint,
      keyVersion: envelope.keyVersion,
      secretPreview: envelope.secretPreview,
      tokenExpiresAt: envelope.tokenExpiresAt,
      createdAt: envelope.createdAt,
    };
  },
};

export function safeConnectorError(error: unknown, fallback = "The connection could not finish that step.") {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const scrubbed = raw
    .replace(/https?:\/\/\S+/gi, "the service")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(sk|pk|rk|ghp|ghs|github_pat|xox[baprs]?|ya29|re|phx|phc)[-_A-Za-z0-9]{8,}\b/gi, "private credential")
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

const blockedActionHandler: ConnectorActionHandler = async () => ({
  status: "needs_attention",
  safeSummary: "That action is blocked by policy.",
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
  "google_drive.import": safeNoopHandler,
  "google_drive.export": safeNoopHandler,
  "google_drive.update": safeNoopHandler,
  "google_docs.import": safeNoopHandler,
  "google_docs.export": safeNoopHandler,
  "google_docs.update": safeNoopHandler,
  "google_sheets.import": safeNoopHandler,
  "google_sheets.export": safeNoopHandler,
  "google_sheets.update": safeNoopHandler,
  "github.import_repository_context": safeNoopHandler,
  "github.create_pull_request": safeNoopHandler,
  "github.create_issue": safeNoopHandler,
  "slack.import": safeNoopHandler,
  "slack.post": safeNoopHandler,
  "slack.update": safeNoopHandler,
  "notion.import": safeNoopHandler,
  "notion.export": safeNoopHandler,
  "notion.update": safeNoopHandler,
  "payments.read": safeNoopHandler,
  "payments.charge": safeNoopHandler,
  "stripe.sync_customers": safeNoopHandler,
  "stripe.sync_products": safeNoopHandler,
  "stripe.sync_prices": safeNoopHandler,
  "stripe.sync_invoices": safeNoopHandler,
  "stripe.sync_subscriptions": safeNoopHandler,
  "stripe.sync_revenue": safeNoopHandler,
  "stripe.sync_finance_context": safeNoopHandler,
  "stripe.blocked": blockedActionHandler,
  "posthog.query": safeNoopHandler,
  "posthog.import": safeNoopHandler,
  "posthog.blocked": blockedActionHandler,
  "resend.draft": safeNoopHandler,
  "resend.send": safeNoopHandler,
  "canva.create_design": safeNoopHandler,
  "canva.import": safeNoopHandler,
  "canva.export_design": safeNoopHandler,
  "canva.update": safeNoopHandler,
  "publishing.post": safeNoopHandler,
  "publishing.update": safeNoopHandler,
  "knowledge.read": safeNoopHandler,
  "knowledge.write": safeNoopHandler,
  "code.preview": safeNoopHandler,
  "code.update": safeNoopHandler,
  "opencode.run": safeNoopHandler,
  "opencode.apply": safeNoopHandler,
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
    sync_stripe_customers: "Stripe customers are ready in Library.",
    sync_stripe_products: "Stripe products are ready in Library.",
    sync_stripe_prices: "Stripe prices are ready in Library.",
    sync_stripe_invoices: "Stripe invoices are ready in Library.",
    sync_stripe_subscriptions: "Stripe subscriptions are ready in Library.",
    sync_stripe_revenue: "Stripe revenue summaries are ready in Library.",
    sync_stripe_finance_context: "Stripe finance context is ready in Library.",
    charge_payment: "The approved payment step is ready.",
    refund_payment: "The approved refund step is ready.",
    cancel_subscription: "The approved subscription change is ready.",
    delete_external_record: "The approved deletion is ready.",
    publish_post: "The approved publishing step is ready.",
    update_live_asset: "The approved live update is ready.",
    read_records: "Business records access is ready.",
    write_record: "The record update is ready.",
    import_content: "Imported content is ready in Library.",
    export_content: "The approved export is ready.",
    post_message: "The approved post is ready.",
    update_external_record: "The approved update is ready.",
    create_preview_deployment: "The review link is ready.",
    publish_preview: "The approved preview step is ready.",
    publish_live_deployment: "The approved live update is ready.",
    query_analytics: "Analytics context is ready.",
    send_transactional_email: "The approved email step is ready.",
    create_design: "The design draft is ready.",
    export_design: "The design export is ready for review.",
    import_repository_context: "Repository context is ready in Library.",
    create_pull_request: "The approved repository change is ready.",
    create_issue: "The approved issue is ready.",
    run_code_builder: "The private builder step is ready.",
  };

  return labels[actionType] ?? "The approved step is ready.";
}
