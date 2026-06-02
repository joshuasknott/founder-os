import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  entityType,
  factStatus,
  itemKind,
  itemSource,
  itemStatus,
  relationType,
  savedViewScope,
  versionFormat,
  workflowKind,
  workflowStatus,
} from "./itemValidators";

const workRunKind = v.union(
  v.literal("code_preview"),
  v.literal("document"),
  v.literal("design"),
  v.literal("email"),
  v.literal("schedule"),
  v.literal("data_update"),
  v.literal("generic")
);

const workerKind = v.union(
  v.literal("builder"),
  v.literal("document"),
  v.literal("design"),
  v.literal("communications"),
  v.literal("generic")
);

const localRunnerCapability = v.union(
  v.literal("coding"),
  v.literal("debugging"),
  v.literal("document"),
  v.literal("design"),
  v.literal("communication"),
  v.literal("schedule"),
  v.literal("data"),
  v.literal("generic"),
  v.literal("business_reasoning"),
  v.literal("product_marketing_docs"),
  v.literal("planning")
);

const localRunnerSensitivity = v.union(
  v.literal("public"),
  v.literal("low"),
  v.literal("internal"),
  v.literal("confidential"),
  v.literal("restricted")
);

const localRunnerOutputContract = v.union(
  v.literal("plain_text"),
  v.literal("structured_json"),
  v.literal("library_item"),
  v.literal("code_changes"),
  v.literal("public_draft")
);

const taskCategory = v.union(
  v.literal("build"),
  v.literal("document"),
  v.literal("design"),
  v.literal("communication"),
  v.literal("schedule"),
  v.literal("data"),
  v.literal("generic")
);

const outputDocumentKind = v.union(
  v.literal("document"),
  v.literal("file"),
  v.literal("website"),
  v.literal("internal_tool"),
  v.literal("tool"),
  v.literal("presentation"),
  v.literal("automation"),
  v.literal("task_output"),
  v.literal("conversation"),
  v.literal("record"),
  v.literal("brief"),
  v.literal("plan")
);

const taskClassification = v.object({
  category: taskCategory,
  runKind: workRunKind,
  workerKind,
  outputItemKind: itemKind,
  outputDocumentKind,
  requiresReview: v.boolean(),
  confidence: v.number(),
  signals: v.array(v.string()),
});

const sensitiveActionKind = v.union(
  v.literal("publish_preview"),
  v.literal("send_email"),
  v.literal("create_calendar_event"),
  v.literal("post_externally"),
  v.literal("spend_money"),
  v.literal("delete_data"),
  v.literal("change_live_asset"),
  v.literal("generic")
);

const localRunRouting = v.object({
  capability: localRunnerCapability,
  sensitivity: localRunnerSensitivity,
  outputContract: localRunnerOutputContract,
  approvalNeeds: v.array(sensitiveActionKind),
});

const connectorAuthType = v.union(
  v.literal("oauth2"),
  v.literal("api_key"),
  v.literal("webhook"),
  v.literal("github_app"),
  v.literal("managed")
);

const connectorConnectionStatus = v.union(
  v.literal("needs_attention"),
  v.literal("connected"),
  v.literal("disabled")
);

const connectorApprovalPolicy = v.union(
  v.literal("never"),
  v.literal("per_sensitive_action"),
  v.literal("always")
);

const connectorActionStatus = v.union(
  v.literal("pending"),
  v.literal("completed"),
  v.literal("needs_attention"),
  v.literal("approval_required"),
  v.literal("failed")
);

const approvalAuditEvent = v.object({
  event: v.union(
    v.literal("requested"),
    v.literal("approved"),
    v.literal("denied"),
    v.literal("handled")
  ),
  at: v.number(),
  actor: v.string(),
  actionKind: v.optional(sensitiveActionKind),
  message: v.optional(v.string()),
});

const chatMessageCard = v.object({
  type: v.union(v.literal("task_result"), v.literal("item_navigation")),
  title: v.string(),
  summary: v.optional(v.string()),
  href: v.optional(v.string()),
  label: v.optional(v.string()),
  itemId: v.optional(v.id("items")),
  documentId: v.optional(v.id("documents")),
  runId: v.optional(v.id("workRuns")),
  directiveId: v.optional(v.id("directives")),
});

const chatJobStatus = v.union(
  v.literal("queued"),
  v.literal("working"),
  v.literal("completed"),
  v.literal("failed")
);

const memoryType = v.union(
  v.literal("founder_preference"),
  v.literal("business_fact"),
  v.literal("decision"),
  v.literal("recurring_workflow"),
  v.literal("person"),
  v.literal("company"),
  v.literal("product"),
  v.literal("reusable_context")
);

const memorySensitivity = v.union(
  v.literal("public"),
  v.literal("internal"),
  v.literal("confidential"),
  v.literal("sensitive")
);

const memorySourceKind = v.union(
  v.literal("library_item"),
  v.literal("completed_work"),
  v.literal("manual")
);

export default defineSchema({
  // ===========================================================================
  // 0. THE BUSINESS SHELL (Workspace -> internal areas -> Library -> Versions)
  // ===========================================================================

  workspaces: defineTable({
    name: v.string(),
    iconSlug: v.string(),
    createdAt: v.number(),
    dailySpendLimit: v.optional(v.number()),
    alertThreshold: v.optional(v.number()),
    onboardingCompletedAt: v.optional(v.number()),
    onboardingConnectorIds: v.optional(v.array(v.string())),
    reviewExternalActions: v.optional(v.boolean()),
  }),

  api_keys: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    value: v.string(),
    createdAt: v.optional(v.number()),
  }).index("by_workspace", ["workspaceId"]),

  connectorCredentials: defineTable({
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    storageProvider: v.string(),
    vaultKey: v.string(),
    sealedReference: v.string(),
    encryptedSecret: v.optional(v.string()),
    encryptionAlgorithm: v.optional(v.string()),
    encryptionNonce: v.optional(v.string()),
    fingerprint: v.string(),
    keyVersion: v.string(),
    secretPreview: v.string(),
    tokenExpiresAt: v.optional(v.number()),
    refreshCredentialRef: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    rotatedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_connector", ["workspaceId", "connectorId"])
    .index("by_vault_key", ["vaultKey"]),

  connectorSyncStates: defineTable({
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    entityType: v.string(),
    cursor: v.optional(v.string()),
    lastSuccessfulSyncAt: v.optional(v.number()),
    lastAttemptedSyncAt: v.optional(v.number()),
    lastSafeMessage: v.optional(v.string()),
    lastSafeError: v.optional(v.string()),
    status: v.union(
      v.literal("idle"),
      v.literal("syncing"),
      v.literal("needs_attention"),
      v.literal("failed")
    ),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_connector", ["workspaceId", "connectorId"])
    .index("by_workspace_connector_entity", ["workspaceId", "connectorId", "entityType"]),

  connectorSetupSessions: defineTable({
    workspaceId: v.id("workspaces"),
    providerId: v.string(),
    connectorIds: v.array(v.string()),
    state: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("expired")
    ),
    codeVerifierCredentialRef: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    completedAt: v.optional(v.number()),
    lastSafeMessage: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_state", ["state"])
    .index("by_workspace_provider", ["workspaceId", "providerId"]),

  connectorConnections: defineTable({
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    safeDisplayName: v.string(),
    authType: connectorAuthType,
    capabilities: v.array(v.string()),
    requiredScopes: v.array(v.string()),
    grantedScopes: v.array(v.string()),
    approvalPolicy: connectorApprovalPolicy,
    status: connectorConnectionStatus,
    credentialRef: v.optional(v.string()),
    credentialFingerprint: v.optional(v.string()),
    credentialPreview: v.optional(v.string()),
    settings: v.optional(v.any()),
    connectedBy: v.optional(v.string()),
    connectedAt: v.optional(v.number()),
    lastTestedAt: v.optional(v.number()),
    lastHealthyAt: v.optional(v.number()),
    lastSafeMessage: v.optional(v.string()),
    disabledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_connector", ["workspaceId", "connectorId"])
    .index("by_status", ["workspaceId", "status"]),

  connectorActionLogs: defineTable({
    workspaceId: v.id("workspaces"),
    connectionId: v.optional(v.id("connectorConnections")),
    connectorId: v.string(),
    actionType: v.string(),
    requestedBy: v.optional(v.string()),
    directiveId: v.optional(v.id("directives")),
    runId: v.optional(v.id("workRuns")),
    approvalId: v.optional(v.id("approvalQueue")),
    status: connectorActionStatus,
    approvalRequired: v.boolean(),
    safeSummary: v.string(),
    safeError: v.optional(v.string()),
    internalErrorCode: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_connection", ["connectionId"])
    .index("by_run", ["runId"])
    .index("by_created", ["createdAt"]),

  users: defineTable({
    externalId: v.string(),
    workspaceId: v.id("workspaces"),
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("Owner"),
      v.literal("Contributor"),
      v.literal("Viewer")
    ),
    status: v.union(v.literal("online"), v.literal("offline")),
    avatarUrl: v.optional(v.string()),
    joinedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_external", ["externalId"])
    .index("by_email", ["email"])
    .index("by_workspace_external", ["workspaceId", "externalId"])
    .index("by_workspace_email", ["workspaceId", "email"]),

  knowledge_nodes: defineTable({
    workspaceId: v.id("workspaces"),
    parentId: v.optional(v.id("knowledge_nodes")),
    type: v.union(
      v.literal("Folder"),
      v.literal("File"),
      v.literal("Blueprint")
    ),
    title: v.string(),
    content: v.optional(v.string()),
    metadata: v.optional(v.any()),
  }).index("by_workspace", ["workspaceId"]),

  event_ledger: defineTable({
    workspaceId: v.id("workspaces"),
    actorType: v.union(v.literal("Human"), v.literal("Agent")),
    actorId: v.string(),
    action: v.string(),
    displayLabel: v.string(),
    targetResource: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_timestamp", ["timestamp"]),

  // ===========================================================================
  // 1. THE WORKFORCE LAYER (hidden internal workers)
  // ===========================================================================

  departments: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    name: v.string(),
    icon: v.string(),
    description: v.string(),
    objective: v.optional(v.string()),
  }).index("by_workspace", ["workspaceId"]),

  agents: defineTable({
    name: v.string(),
    role: v.string(),
    description: v.string(),
    systemPrompt: v.string(),
    avatar: v.string(),
    departmentId: v.id("departments"),
    routingRequest: v.union(
      v.literal("triage"),
      v.literal("reasoning"),
      v.literal("coding"),
      v.literal("long-context"),
      v.literal("creative")
    ),
    toolClearance: v.array(v.string()),
    rank: v.optional(
      v.union(
        v.literal("chief"),
        v.literal("lead"),
        v.literal("specialist")
      )
    ),
    reportsTo: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_department", ["departmentId"]),

  playbooks: defineTable({
    name: v.string(),
    departmentId: v.id("departments"),
    description: v.string(),
    templateKey: v.optional(v.string()),
    workflowKind: v.optional(workflowKind),
    inputs: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          type: v.union(
            v.literal("text"),
            v.literal("number"),
            v.literal("date"),
            v.literal("select"),
            v.literal("boolean")
          ),
          required: v.boolean(),
          defaultValue: v.optional(v.any()),
          options: v.optional(v.array(v.string())),
        })
      )
    ),
    outputs: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          kind: itemKind,
          description: v.optional(v.string()),
        })
      )
    ),
    approvalRules: v.optional(
      v.array(
        v.object({
          actionKind: sensitiveActionKind,
          policy: v.union(v.literal("always"), v.literal("when_external"), v.literal("over_threshold")),
          threshold: v.optional(v.number()),
          description: v.optional(v.string()),
        })
      )
    ),
    isStarter: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
    taskMatrix: v.array(
      v.object({
        key: v.optional(v.string()),
        title: v.string(),
        descriptionTemplate: v.string(),
        assignedAgentId: v.string(),
        autonomyLevel: v.number(),
        dependencies: v.array(v.string()),
        kind: v.optional(v.string()),
        outputItemKind: v.optional(itemKind),
      })
    ),
  })
    .index("by_department", ["departmentId"])
    .index("by_template_key", ["templateKey"]),

  // ===========================================================================
  // 2. THE EXECUTION LAYER (Deterministic State Machine)
  // ===========================================================================

  directives: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    objective: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    status: v.union(
      v.literal("pending_spec"),
      v.literal("needs_clarification"),
      v.literal("custom_fallback"),
      v.literal("awaiting_approval"),
      v.literal("in_progress"),
      v.literal("blocked"),
      v.literal("aborted_by_principal"),
      v.literal("completed")
    ),
    tokenBudgetUSD: v.optional(v.number()),
    useMemory: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_archived", ["workspaceId", "archivedAt"]),

  tasks: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    directiveId: v.id("directives"),
    workflowId: v.optional(v.id("workflows")),
    workflowStepKey: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    assignedAgentId: v.optional(v.id("agents")),
    status: v.union(
      v.literal("queued"),
      v.literal("in_progress"),
      v.literal("shadow_pending"),
      v.literal("blocked"),
      v.literal("completed"),
      v.literal("failed")
    ),
    autonomyLevel: v.union(v.literal(1), v.literal(2), v.literal(3)),
    dependencies: v.array(v.id("tasks")),
    classification: v.optional(taskClassification),
    workerKind: v.optional(workerKind),
    modelProfile: v.optional(v.string()),
    localRouting: v.optional(localRunRouting),
    useMemory: v.optional(v.boolean()),
    outputItemId: v.optional(v.id("items")),
    outputDocumentId: v.optional(v.id("documents")),
    failureReason: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    retryDelayMs: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    executionToken: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_directive", ["directiveId"])
    .index("by_workspace", ["workspaceId"]),

  localRunners: defineTable({
    runnerId: v.string(),
    name: v.optional(v.string()),
    status: v.union(
      v.literal("starting"),
      v.literal("online"),
      v.literal("offline")
    ),
    capabilities: v.array(localRunnerCapability),
    outputContracts: v.array(localRunnerOutputContract),
    maxSensitivity: localRunnerSensitivity,
    approvalCapabilities: v.array(sensitiveActionKind),
    currentRunId: v.optional(v.id("workRuns")),
    lastSafeMessage: v.optional(v.string()),
    opencodeReady: v.optional(v.boolean()),
    opencodeSafeMessage: v.optional(v.string()),
    processId: v.optional(v.number()),
    version: v.optional(v.string()),
    leaseCount: v.optional(v.number()),
    completedCount: v.optional(v.number()),
    failedCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.number(),
    lastHeartbeatAt: v.number(),
    heartbeatExpiresAt: v.number(),
    stoppedAt: v.optional(v.number()),
  })
    .index("by_runner_id", ["runnerId"])
    .index("by_status", ["status"])
    .index("by_heartbeat", ["heartbeatExpiresAt"]),

  // ===========================================================================
  // 3. THE CIRCUIT BREAKER (Tiered Autonomy Approval Gate)
  // ===========================================================================

  approvalQueue: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    type: v.union(
      v.literal("spec_gate"),
      v.literal("integration_gate"),
      v.literal("budget_warning"),
      v.literal("shadow_approval")
    ),
    directiveId: v.id("directives"),
    taskId: v.optional(v.id("tasks")),
    runId: v.optional(v.id("workRuns")),
    actionKind: v.optional(sensitiveActionKind),
    actionTitle: v.optional(v.string()),
    actionDescription: v.optional(v.string()),
    actionPayload: v.optional(v.any()),
    status: v.union(
      v.literal("pending"),
      v.literal("shadow_pending"),
      v.literal("approved"),
      v.literal("denied")
    ),
    payloadHash: v.optional(v.string()),
    principalSignature: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    decidedAt: v.optional(v.number()),
    handledAt: v.optional(v.number()),
    auditHistory: v.optional(v.array(approvalAuditEvent)),
    autonomyLevel: v.union(v.literal(1), v.literal(2), v.literal(3)),
  })
    .index("by_directive", ["directiveId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_run_status", ["runId", "status"]),

  chatSessions: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    userId: v.optional(v.id("users")),
    title: v.string(),
    agentId: v.id("agents"),
    lastMessageAt: v.number(),
  })
    .index("by_lastMessage", ["lastMessageAt"])
    .index("by_workspace_lastMessage", ["workspaceId", "lastMessageAt"]),

  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    agentName: v.optional(v.string()),
    card: v.optional(chatMessageCard),
  }).index("by_session", ["sessionId"]),

  chatJobs: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
    userMessageId: v.optional(v.id("chatMessages")),
    directiveId: v.optional(v.id("directives")),
    taskId: v.optional(v.id("tasks")),
    runId: v.optional(v.id("workRuns")),
    status: chatJobStatus,
    content: v.string(),
    systemPrompt: v.string(),
    userPrompt: v.string(),
    agentName: v.string(),
    safeProgress: v.string(),
    sensitivity: localRunnerSensitivity,
    localRouting: localRunRouting,
    routeId: v.string(),
    opencodeModel: v.string(),
    verifierRequired: v.boolean(),
    allowFreeRoute: v.boolean(),
    requiresWork: v.boolean(),
    useMemory: v.optional(v.boolean()),
    classification: v.optional(taskClassification),
    attemptCount: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
    failureReason: v.optional(v.string()),
    lastError: v.optional(v.string()),
    leaseId: v.optional(v.string()),
    leaseOwner: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    localRunnerId: v.optional(v.string()),
    assistantMessageId: v.optional(v.id("chatMessages")),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_status", ["status"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  // ===========================================================================
  // 4. THE INTELLIGENCE LAYER (Sovereign Knowledge Vault — RAG)
  // ===========================================================================

  items: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    departmentId: v.optional(v.id("departments")),
    title: v.string(),
    kind: itemKind,
    status: itemStatus,
    source: itemSource,
    author: v.optional(v.string()),
    summary: v.optional(v.string()),
    currentVersionId: v.optional(v.id("itemVersions")),
    versionCount: v.optional(v.number()),
    legacyDocumentId: v.optional(v.id("documents")),
    traceId: v.optional(v.id("directives")),
    taskId: v.optional(v.id("tasks")),
    runId: v.optional(v.id("workRuns")),
    sourceUrl: v.optional(v.string()),
    externalId: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_kind", ["workspaceId", "kind"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_department", ["departmentId"])
    .index("by_trace", ["traceId"])
    .index("by_run", ["runId"])
    .index("by_updated", ["updatedAt"])
    .index("by_external", ["source", "externalId"]),

  itemVersions: defineTable({
    itemId: v.id("items"),
    versionNumber: v.number(),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    format: versionFormat,
    sourceUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    checksum: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    metadata: v.optional(v.any()),
    legacyDocumentVersionId: v.optional(v.id("documentVersions")),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_item", ["itemId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["itemId"],
    }),

  itemRelations: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    fromItemId: v.id("items"),
    toItemId: v.optional(v.id("items")),
    toEntityId: v.optional(v.id("entities")),
    relationType,
    summary: v.optional(v.string()),
    strength: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_from", ["fromItemId"])
    .index("by_to_item", ["toItemId"])
    .index("by_to_entity", ["toEntityId"])
    .index("by_workspace_type", ["workspaceId", "relationType"]),

  entities: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    type: entityType,
    name: v.string(),
    canonicalName: v.string(),
    aliases: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    sourceItemId: v.optional(v.id("items")),
    externalId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "type"])
    .index("by_canonical", ["workspaceId", "canonicalName"])
    .index("by_external", ["type", "externalId"]),

  facts: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    entityId: v.optional(v.id("entities")),
    itemId: v.optional(v.id("items")),
    subject: v.string(),
    predicate: v.string(),
    object: v.string(),
    value: v.optional(v.any()),
    confidence: v.optional(v.number()),
    status: factStatus,
    sensitivity: v.optional(memorySensitivity),
    isSensitive: v.optional(v.boolean()),
    sourceItemId: v.optional(v.id("items")),
    sourceVersionId: v.optional(v.id("itemVersions")),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_entity", ["entityId"])
    .index("by_item", ["itemId"])
    .index("by_source_item", ["sourceItemId"])
    .index("by_workspace_predicate", ["workspaceId", "predicate"]),

  memoryEntries: defineTable({
    workspaceId: v.id("workspaces"),
    type: memoryType,
    label: v.string(),
    value: v.string(),
    canonicalKey: v.string(),
    searchText: v.string(),
    sensitivity: memorySensitivity,
    status: v.union(v.literal("active"), v.literal("deleted")),
    sourceKind: memorySourceKind,
    sourceItemId: v.optional(v.id("items")),
    sourceVersionId: v.optional(v.id("itemVersions")),
    sourceRunId: v.optional(v.id("workRuns")),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_key", ["workspaceId", "canonicalKey"])
    .index("by_source_item", ["sourceItemId"])
    .index("by_source_run", ["sourceRunId"]),

  memorySettings: defineTable({
    workspaceId: v.id("workspaces"),
    enabled: v.boolean(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  savedViews: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    description: v.optional(v.string()),
    scope: savedViewScope,
    query: v.optional(v.string()),
    itemKinds: v.optional(v.array(itemKind)),
    filters: v.optional(v.any()),
    sort: v.optional(v.any()),
    isPinned: v.boolean(),
    usageCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    suggestedAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_pinned", ["workspaceId", "isPinned"])
    .index("by_scope", ["workspaceId", "scope"]),

  workflows: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    sourcePlaybookId: v.optional(v.id("playbooks")),
    title: v.string(),
    description: v.optional(v.string()),
    kind: workflowKind,
    status: workflowStatus,
    trigger: v.optional(v.any()),
    inputs: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          type: v.union(
            v.literal("text"),
            v.literal("number"),
            v.literal("date"),
            v.literal("select"),
            v.literal("boolean")
          ),
          required: v.boolean(),
          defaultValue: v.optional(v.any()),
          options: v.optional(v.array(v.string())),
        })
      )
    ),
    steps: v.array(
      v.object({
        key: v.string(),
        title: v.string(),
        kind: v.string(),
        config: v.optional(v.any()),
        outputItemKind: v.optional(itemKind),
      })
    ),
    outputs: v.optional(
      v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          kind: itemKind,
          description: v.optional(v.string()),
        })
      )
    ),
    approvalRules: v.optional(
      v.array(
        v.object({
          actionKind: sensitiveActionKind,
          policy: v.union(v.literal("always"), v.literal("when_external"), v.literal("over_threshold")),
          threshold: v.optional(v.number()),
          description: v.optional(v.string()),
        })
      )
    ),
    ownerId: v.optional(v.id("users")),
    useMemory: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_status", ["workspaceId", "status"])
    .index("by_kind", ["workspaceId", "kind"]),

  documents: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    itemId: v.optional(v.id("items")),
    title: v.string(),
    departmentTag: v.id("departments"),
    author: v.string(),
    traceId: v.optional(v.id("directives")),
    kind: v.optional(
      v.union(
        v.literal("document"),
        v.literal("file"),
        v.literal("website"),
        v.literal("internal_tool"),
        v.literal("tool"),
        v.literal("presentation"),
        v.literal("automation"),
        v.literal("task_output"),
        v.literal("conversation"),
        v.literal("record"),
        v.literal("brief"),
        v.literal("plan")
      )
    ),
    summary: v.optional(v.string()),
    currentVersionId: v.optional(v.id("documentVersions")),
    versionCount: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    status: v.union(
      v.literal("draft"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("finalized"),
      v.literal("deprecated")
    ),
    isArchived: v.boolean(),
    deprecatedAt: v.optional(v.number()),
  })
    .index("by_department", ["departmentTag"])
    .index("by_workspace", ["workspaceId"]),

  documentVersions: defineTable({
    documentId: v.id("documents"),
    itemVersionId: v.optional(v.id("itemVersions")),
    content: v.string(),
    versionNumber: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    summary: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_document", ["documentId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["documentId"],
    }),

  projects: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    departmentId: v.optional(v.id("departments")),
    name: v.string(),
    outcome: v.string(),
    status: v.union(
      v.literal("planned"),
      v.literal("active"),
      v.literal("waiting"),
      v.literal("complete")
    ),
    dueAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_status", ["status"]),

  scheduleItems: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    departmentId: v.optional(v.id("departments")),
    projectId: v.optional(v.id("projects")),
    workflowId: v.optional(v.id("workflows")),
    title: v.string(),
    kind: v.union(
      v.literal("follow_up"),
      v.literal("review"),
      v.literal("deadline"),
      v.literal("meeting"),
      v.literal("automation")
    ),
    status: v.union(
      v.literal("scheduled"),
      v.literal("paused"),
      v.literal("done"),
      v.literal("skipped"),
      v.literal("deleted")
    ),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    prompt: v.optional(v.string()),
    cadence: v.optional(
      v.union(
        v.literal("once"),
        v.literal("daily"),
        v.literal("weekdays"),
        v.literal("weekly")
      )
    ),
    timezone: v.optional(v.string()),
    nextRunAt: v.optional(v.number()),
    lastRunAt: v.optional(v.number()),
    runCount: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_start", ["startAt"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_next_run", ["workspaceId", "status", "nextRunAt"])
    .index("by_next_run", ["status", "nextRunAt"])
    .index("by_workflow", ["workflowId"]),

  buildActivities: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    source: v.string(),
    title: v.string(),
    summary: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("building"),
      v.literal("ready"),
      v.literal("failed")
    ),
    branch: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_workspace_created", ["workspaceId", "createdAt"]),

  // ===========================================================================
  // 5. THE WORK RUNS LAYER (Hidden Task Execution Tracking)
  // ===========================================================================

  workRuns: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    directiveId: v.id("directives"),
    taskId: v.optional(v.id("tasks")),
    scheduleItemId: v.optional(v.id("scheduleItems")),
    workflowId: v.optional(v.id("workflows")),
    workflowStepKey: v.optional(v.string()),
    scheduledFor: v.optional(v.number()),
    trigger: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("schedule"),
        v.literal("retry"),
        v.literal("chat")
      )
    ),
    kind: workRunKind,
    workerKind: v.optional(workerKind),
    classification: v.optional(taskClassification),
    modelProfile: v.optional(v.string()),
    localRouting: v.optional(localRunRouting),
    useMemory: v.optional(v.boolean()),
    status: v.union(
      v.literal("queued"),
      v.literal("working"),
      v.literal("needs_review"),
      v.literal("waiting_for_approval"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("stopped")
    ),
    title: v.string(),
    summary: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    outputItemId: v.optional(v.id("items")),
    outputDocumentId: v.optional(v.id("documents")),
    resultCardMessageId: v.optional(v.id("chatMessages")),
    navigationCardMessageId: v.optional(v.id("chatMessages")),
    attemptCount: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
    retryDelayMs: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
    lastError: v.optional(v.string()),
    leaseId: v.optional(v.string()),
    leaseOwner: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    localRunnerId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_directive", ["directiveId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_schedule", ["scheduleItemId"])
    .index("by_workflow", ["workflowId"])
    .index("by_status", ["status"])
    .index("by_kind_status", ["kind", "status"]),

  workRunUpdates: defineTable({
    runId: v.id("workRuns"),
    message: v.string(),
    tone: v.union(
      v.literal("info"),
      v.literal("progress"),
      v.literal("review"),
      v.literal("blocked"),
      v.literal("complete"),
      v.literal("error")
    ),
    createdAt: v.number(),
  }).index("by_run", ["runId"]),

  workArtifacts: defineTable({
    runId: v.id("workRuns"),
    directiveId: v.optional(v.id("directives")),
    title: v.string(),
    kind: v.string(),
    summary: v.optional(v.string()),
    url: v.optional(v.string()),
    libraryItemId: v.optional(v.id("items")),
    libraryDocumentId: v.optional(v.id("documents")),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_run", ["runId"])
    .index("by_directive", ["directiveId"]),

  // ===========================================================================
  // 6. THE TELEMETRY LAYER (Radical Observability — Glass Box)
  // ===========================================================================

  observabilityLogs: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    traceId: v.union(v.id("directives"), v.string()),
    actor: v.string(),
    eventType: v.union(
      v.literal("STATE_TRANSITION"),
      v.literal("TOOL_INVOCATION"),
      v.literal("AI_REQUEST"),
      v.literal("RAG_QUERY"),
      v.literal("ERROR_ESCALATION"),
      v.literal("SYSTEM_HALT")
    ),
    payload: v.string(),
    metrics: v.optional(
      v.object({
        latencyMs: v.number(),
        tokensUsed: v.number(),
        model: v.optional(v.string()),
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        costUSD: v.optional(v.number()),
        useCase: v.optional(v.string()),
      })
    ),
  })
    .index("by_traceId", ["traceId"])
    .index("by_workspace", ["workspaceId"]),

  auditEvents: defineTable({
    workspaceId: v.id("workspaces"),
    actorId: v.string(),
    actorName: v.string(),
    actorType: v.union(v.literal("user"), v.literal("worker"), v.literal("system")),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "createdAt"])
    .index("by_resource", ["resourceType", "resourceId"]),
});
