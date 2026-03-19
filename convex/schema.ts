import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ===========================================================================
  // 1. Core Entity Tables
  // ===========================================================================

  workspaces: defineTable({
    name: v.string(),
    iconSlug: v.optional(v.string()),
    createdAt: v.number(),
  }),

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
    .index("by_externalId", ["externalId"]),

  agents: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    role: v.string(),
    model: v.string(),
    systemPrompt: v.string(),
    status: v.union(
      v.literal("idle"),
      v.literal("working"),
      v.literal("offline")
    ),
    clearanceLevel: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  // ===========================================================================
  // 2. Intelligence & Operations
  // ===========================================================================

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
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_parent", ["parentId"]),

  approval_queue: defineTable({
    workspaceId: v.id("workspaces"),
    agentId: v.id("agents"),
    title: v.string(),
    description: v.string(),
    justification: v.string(),
    status: v.union(
      v.literal("Pending"),
      v.literal("Approved"),
      v.literal("Denied")
    ),
    proposedPayload: v.string(),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_status", ["status"]),

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
});
