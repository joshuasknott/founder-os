# FounderOS Backend Schema

FounderOS uses Convex for live workspace data. Some table names preserve earlier internal architecture, but user-facing UI should translate them into the founder-facing product model: Home, Work, Library, Schedules, and Settings.

## Founder-Facing Mapping

- `chatSessions` and `chatMessages` power conversations.
- `directives` are visible Work items.
- `tasks` are the steps inside a work item.
- `workRuns`, `workRunUpdates`, and `workArtifacts` are hidden execution records behind Work.
- `localRunners` records local processes that can lease hidden Work safely from Convex.
- `items` and `itemVersions` are the unified FounderOS knowledge model.
- `documents` and `documentVersions` remain the editable Library compatibility layer used by the current UI.
- `itemRelations`, `entities`, `facts`, `memoryEntries`, and `memorySettings` store relationships and structured knowledge behind Library search and hidden remembered context.
- `savedViews` store pinned business views. `workflows` store durable founder-facing business processes.
- `scheduleItems` with the legacy internal kind `automation` are founder-facing Schedules.
- `departments`, `agents`, and `playbooks` are internal foundations for assigning work to professional AI roles. Starter `playbooks` are hidden templates behind founder-visible workflows.
- `projects` and `buildActivities` remain backend foundations but are not primary user-facing Home concepts.
- Context relationships, embeddings, and retrieval metadata are hidden foundations for Library search, sidebar help, and pinned intelligent views.

## Initialization

`convex/init.ts` must stay idempotent and minimal. It creates only:

- one workspace
- one owner record
- internal business areas
- the AI worker roster
- task playbooks
- hidden starter workflow templates

It must not clear existing user data and must not seed fake Library items, fake projects, fake schedules, or fake build activity.

## Conversations

`chatSessions`

- `title`
- `agentId`
- `lastMessageAt`

`chatMessages`

- `sessionId`
- `role`
- `content`
- `agentName`

Conversation is read-only until the founder confirms a work, schedule, or business-data change. It may use Library context to answer but must not quietly create outputs or mutate business records beyond storing the conversation itself.

## Work

`directives`

- `title`
- `objective`
- `sessionId` optional link back to the conversation thread
- `status`
- `tokenBudgetUSD`

Work creation writes a visible Work item and records a conversation note when a session is present. Clarification and completion messages are also written back to the linked conversation.

`tasks`

- `directiveId`
- `title`
- `description`
- `assignedAgentId`
- `status`
- `dependencies`
- internal control fields

The UI should translate backend statuses into plain labels such as Preparing, In progress, Needs your answer, Waiting for review, Paused, and Completed.

Work should be queryable in three founder-facing groups:

- Active: queued or in-progress work.
- Review: work needing an answer, approval, or decision.
- Completed: finished or stopped work with outcomes and links.

`workRuns`, `workRunUpdates`, and `workArtifacts` remain hidden runtime tables. The founder sees their business meaning through Work items, progress updates, review prompts, and saved outputs.

`workRuns.localRouting` stores hidden routing inputs for local execution:
capability, sensitivity, output contract, and approval needs. `attemptCount`,
`maxAttempts`, `retryDelayMs`, and `nextRetryAt` hold retry metadata used by
both the local runner and legacy workers.

`localRunners`

- `runnerId`: stable local process identity
- `status`, `lastHeartbeatAt`, and `heartbeatExpiresAt`
- hidden capabilities, output contracts, max sensitivity, and approval capabilities
- safe readiness messages and counters

Local runner rows are not founder-facing UI. They exist so Convex can lease work
to a local machine without cloud functions needing direct access to local
OpenCode subscriptions.

## Library

`items`

- `workspaceId`
- `departmentId` optional internal business area
- `title`
- `kind`: supports created outputs, uploads, websites, decks, docs, emails, contacts, companies, decisions, research, automations, tools, task outputs, and legacy Library kinds
- `status`: draft, active, under review, approved, finalized, archived, or deprecated
- `source`: user, agent, upload, website, connector, migration, or system
- `summary`
- `currentVersionId`
- `versionCount`
- optional links to `directives`, `tasks`, and `workRuns`
- optional source URL, storage ID, MIME type, tags, external ID, and metadata
- `legacyDocumentId` when mirrored for the current Library UI
- timestamps

`itemVersions`

- `itemId`
- `versionNumber`
- optional title and summary
- content or external/storage reference
- format: markdown, plain text, HTML, JSON, binary, or external
- optional embedding for retrieval
- `legacyDocumentVersionId` when mirrored for the current Library UI
- creation metadata

`itemRelations`

- `fromItemId`
- optional `toItemId` or `toEntityId`
- relationship type such as references, derived from, output of, mentions, supports, contradicts, part of, duplicate of, or related
- optional summary, strength, metadata, creator, and timestamp

`entities`

- canonical people, companies, customers, competitors, vendors, products, markets, tools, websites, emails, domains, and concepts
- aliases, source item, optional external ID, metadata, and timestamps

`facts`

- subject, predicate, object, optional typed value
- optional entity/item/source links
- confidence, status, sensitivity marker, validity window, metadata, and timestamps

`documents`

- `workspaceId`
- `itemId` optional link to the unified item record
- `title`
- `departmentTag`
- `author`
- `traceId` optional link to the Work item that created it
- `kind`
- `summary`
- `currentVersionId`
- `versionCount`
- `status`
- archive timestamps

`documentVersions`

- `documentId`
- `itemVersionId` optional link to the unified item version
- `content`
- `versionNumber`
- `createdAt`
- `createdBy`
- `summary`
- optional embedding

`memoryEntries`

- stores founder preferences, business facts, decisions, recurring workflows, people, companies, products, and reusable context
- stores a normalized deduplication key, sensitivity, source Library item or completed work record, and deletion tombstone
- never acts as a credential store; secret-like values are rejected or redacted before indexing

`memorySettings`

- stores the workspace-level plain-language `Use remembered details` switch
- defaults to enabled when a workspace has no row

Library queries should hide archived records by default and expose saved outputs by Work item when Home, Work, or the AI sidebar needs result links.

Library item kinds can include documents, files, websites, presentations, tools, task outputs, conversations, decisions, research, customer notes, and records. New code should use `items.kind` for the canonical model, while `documents.kind` stays available for the current Library UI. Department tags are internal metadata only.

`documentVersions` power manual edits and generated revisions. Version history should be queried only for the selected item view.

Library should support queryable knowledge behavior. Structured summaries, source links, embeddings, relationship metadata, and retrieval signals may exist internally, but founders should see search results, answers, related items, and source explanations instead of graph mechanics.

Remembered details are the durable operating-context subset of Library knowledge. Safe extraction runs after Library saves, connector imports, and completed work outputs. Settings provides view, refresh, add, edit, delete, and disable controls. Home provides a per-request `Use remembered details` switch. See [Remembered Details](./8_MEMORY_LAYER.md).

### Compatibility and Migration

The current Library UI still calls `artifacts.list/create/update/revert/remove`, which returns document-shaped records and document version history. Those mutations now create and update linked `items` and `itemVersions` records at the same time.

Existing `documents` without an `itemId` continue to work. Use `items.migrateLegacyDocuments` to backfill linked item records in batches without changing the Library UI route shape or stored document IDs.

New integrations and workers should write to `items` directly when they do not need the current document editor, or request a document mirror when the output should appear immediately in the existing Library UI.

## Schedules

`scheduleItems`

- `title`
- `kind: "automation"` as the legacy internal value for a founder-facing Schedule
- `status`
- `startAt`
- `prompt`
- `cadence`

Schedules are stored as plain business requests such as daily priorities. The UI should show cadence and time in normal language, not cron syntax.

Every Schedule points to a `workflowId`. Older prompt-only schedules are migrated to a compatible single-step workflow the next time they run. Schedule execution must call the workflow runtime rather than creating standalone backend work directly.

Schedule results should write to Work and Library when useful. A recurring request that needs review should create a Review item rather than quietly taking an external action.

## Pinned Intelligent Views

Pinned views should be stored in `savedViews` as saved business questions or criteria over Work, Library, Schedules, and hidden context relationships. They should not be stored as manual folders.

The UI can show a short title, count, and item list. Internal query definitions, retrieval weights, and graph details should stay hidden.

## Workflows

`workflows` are the durable founder-facing process layer. A workflow defines a trigger, ordered steps, expected Library outputs, and approval rules. The founder can add a starter workflow, save a custom workflow, run one now, or put one on a Schedule without seeing backend mechanics.

`playbooks` remain hidden reusable templates. Starter playbooks carry a stable `templateKey`, workflow defaults, and an internal task matrix. Creating a workflow from a starter copies that template into a workspace-owned `workflow` row and records `sourcePlaybookId`; later runs use the copied workflow so founder edits remain durable.

Workflow execution creates one visible `directive`, then internal `tasks` and `workRuns` for the ordered steps. Later steps stay queued until their dependency tasks complete. Work groups those records back into one founder-facing card with plain progress, review needs, approvals, and saved Library outputs.

Approval gates are reserved for external, destructive, or spend-related actions. Rules with `policy: "always"` pause execution before the first step. Rules with `policy: "when_external"` describe the boundary but only create a real approval when the external action is requested.

Seeded starter templates:

- Create Website
- Create Document
- Weekly Review
- Marketing Asset
- Inbox Follow-up
- Investor Update
- Product Research

## Approvals

`approvalQueue` stores real review gates for sensitive actions. The UI should only show review UI when queue items are pending. Permanent approval panels on Home are not part of the product direction.

Review gates are for risky external or destructive actions: public publishing, live asset changes, deleting important data, spending money, sending email, posting externally, or contacting third parties. Internal drafts, previews, documents, presentations, schedule preparation, organization, and private tool previews should proceed without a review gate.

## Overview Query

`commandCenter.getOverview` is an internal overview query despite the legacy file name. It may aggregate workspace, recent work, Library, Schedules, approval, and internal foundation counts, but the frontend should not surface legacy naming.
