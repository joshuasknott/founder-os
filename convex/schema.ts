import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
  }),

  api_keys: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    value: v.string(),
    createdAt: v.optional(v.number()),
  }).index("by_workspace", ["workspaceId"]),

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
  }).index("by_workspace", ["workspaceId"]),

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
  // 1. THE WORKFORCE LAYER (Lean Workforce — 5 Core Agents)
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
    taskMatrix: v.array(
      v.object({
        title: v.string(),
        descriptionTemplate: v.string(),
        assignedAgentId: v.string(),
        autonomyLevel: v.number(),
        dependencies: v.array(v.string()),
      })
    ),
  }).index("by_department", ["departmentId"]),

  // ===========================================================================
  // 2. THE EXECUTION LAYER (Deterministic State Machine)
  // ===========================================================================

  directives: defineTable({
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
  }).index("by_status", ["status"]),

  tasks: defineTable({
    directiveId: v.id("directives"),
    title: v.string(),
    description: v.string(),
    assignedAgentId: v.id("agents"),
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
    retryCount: v.optional(v.number()),
    executionToken: v.optional(v.string()),
  }).index("by_directive", ["directiveId"]),

  // ===========================================================================
  // 3. THE CIRCUIT BREAKER (Tiered Autonomy Approval Gate)
  // ===========================================================================

  approvalQueue: defineTable({
    type: v.union(
      v.literal("spec_gate"),
      v.literal("integration_gate"),
      v.literal("budget_warning"),
      v.literal("shadow_approval")
    ),
    directiveId: v.id("directives"),
    taskId: v.optional(v.id("tasks")),
    status: v.union(
      v.literal("pending"),
      v.literal("shadow_pending"),
      v.literal("approved"),
      v.literal("denied")
    ),
    payloadHash: v.optional(v.string()),
    principalSignature: v.optional(v.string()),
    autonomyLevel: v.union(v.literal(1), v.literal(2), v.literal(3)),
  }).index("by_directive", ["directiveId"]),

  chatSessions: defineTable({
    title: v.string(),
    agentId: v.id("agents"),
    lastMessageAt: v.number(),
  }).index("by_lastMessage", ["lastMessageAt"]),

  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    agentName: v.optional(v.string()),
  }).index("by_session", ["sessionId"]),

  // ===========================================================================
  // 4. THE INTELLIGENCE LAYER (Sovereign Knowledge Vault — RAG)
  // ===========================================================================

  documents: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
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
  }).index("by_status", ["status"]),

  scheduleItems: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    departmentId: v.optional(v.id("departments")),
    projectId: v.optional(v.id("projects")),
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
      v.literal("done"),
      v.literal("skipped")
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
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_start", ["startAt"]),

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
  }).index("by_created", ["createdAt"]),

  // ===========================================================================
  // 5. THE WORK RUNS LAYER (Hidden Task Execution Tracking)
  // ===========================================================================

  workRuns: defineTable({
    directiveId: v.id("directives"),
    taskId: v.optional(v.id("tasks")),
    kind: v.union(
      v.literal("code_preview"),
      v.literal("document"),
      v.literal("design"),
      v.literal("email"),
      v.literal("schedule"),
      v.literal("data_update"),
      v.literal("generic")
    ),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_directive", ["directiveId"])
    .index("by_status", ["status"]),

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
    traceId: v.union(v.id("directives"), v.string()),
    actor: v.string(),
    eventType: v.union(
      v.literal("STATE_TRANSITION"),
      v.literal("TOOL_INVOCATION"),
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
      })
    ),
  }).index("by_traceId", ["traceId"]),
});
