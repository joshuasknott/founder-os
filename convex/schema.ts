import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ===========================================================================
  // 1. THE WORKFORCE LAYER (Lean Workforce — 5 Core Agents)
  // ===========================================================================

  departments: defineTable({
    name: v.string(),
    icon: v.string(),
    description: v.string(),
  }),

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
    title: v.string(),
    departmentTag: v.id("departments"),
    author: v.string(),
    traceId: v.optional(v.id("directives")),
    status: v.union(
      v.literal("draft"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("finalized"),
      v.literal("deprecated")
    ),
    isArchived: v.boolean(),
    deprecatedAt: v.optional(v.number()),
  }),

  documentVersions: defineTable({
    documentId: v.id("documents"),
    content: v.string(),
    embedding: v.optional(v.array(v.float64())),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 768,
    filterFields: ["documentId"],
  }),

  // ===========================================================================
  // 5. THE TELEMETRY LAYER (Radical Observability — Glass Box)
  // ===========================================================================

  observabilityLogs: defineTable({
    traceId: v.id("directives"),
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
