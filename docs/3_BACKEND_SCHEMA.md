# FounderOS Backend Schema (Convex) - V1.1 (Audited)

## 1. Core Entity Tables

### `workspaces`
- `name` (v.string())
- `iconSlug` (v.string()): Lucide icon name or emoji code (replaces 'logo' for better UI mapping).
- `createdAt` (v.number()): Epoch timestamp.

### `users`
- `externalId` (v.string())
- `workspaceId` (v.id("workspaces"))
- `name` (v.string())
- `email` (v.string())
- `role` (v.union(v.literal("Owner"), v.literal("Contributor"), v.literal("Viewer")))
- `status` (v.union(v.literal("online"), v.literal("offline")))
- `avatarUrl` (v.optional(v.string()))
- `joinedAt` (v.number()): Required for Team Table rendering.

### `agents`
- `workspaceId` (v.id("workspaces"))
- `name` (v.string())
- `role` (v.string())
- `model` (v.string())
- `systemPrompt` (v.string())
- `status` (v.union(v.literal("idle"), v.literal("working"), v.literal("offline")))
- `clearanceLevel` (v.number()): 1 (Auto) to 3 (Human Approval).

---

## 2. Intelligence & Operations

### `knowledge_nodes`
- `workspaceId` (v.id("workspaces"))
- `parentId` (v.optional(v.id("knowledge_nodes")))
- `type` (v.union(v.literal("Folder"), v.literal("File"), v.literal("Blueprint")))
- `title` (v.string())
- `content` (v.optional(v.string()))
- `metadata` (v.optional(v.any()))

### `approval_queue`
- `workspaceId` (v.id("workspaces"))
- `agentId` (v.id("agents"))
- `title` (v.string())
- `description` (v.string()): Short summary for Rightnav Inbox cards.
- `justification` (v.string()): Full agent reasoning for the Modal.
- `status` (v.union(v.literal("Pending"), v.literal("Approved"), v.literal("Denied")))
- `proposedPayload` (v.string()): Code/JSON diff.
- `createdAt` (v.number())

### `event_ledger`
- `workspaceId` (v.id("workspaces"))
- `actorType` (v.union(v.literal("Human"), v.literal("Agent")))
- `actorId` (v.string())
- `action` (v.string())
- `displayLabel` (v.string()): Pre-composed string for the Logs view (e.g., "> Atlas: Sandbox passed").
- `targetResource` (v.optional(v.string()))
- `timestamp` (v.number())