# FounderOS Backend Schema

FounderOS uses Convex for live workspace data. Some table names preserve earlier internal architecture, but user-facing UI should translate them into the simpler product model: Home, chats, tasks, Library, and settings.

## Founder-Facing Mapping

- `chatSessions` and `chatMessages` power conversations.
- `directives` are visible task work items.
- `tasks` are the steps inside a work item.
- `documents` and `documentVersions` are editable Library items and versions.
- `scheduleItems` with `kind: "automation"` are founder-facing automations.
- `departments`, `agents`, and `playbooks` are internal foundations for assigning work to professional AI roles.
- `projects` and `buildActivities` remain backend foundations but are not primary user-facing Home concepts.

## Initialization

`convex/init.ts` must stay idempotent and minimal. It creates only:

- one workspace
- one owner record
- internal business areas
- the AI worker roster
- task playbooks

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

Chat mode is read-only business conversation. It may use Library context to answer but must not create outputs or mutate business records beyond storing the conversation itself.

## Tasks

`directives`

- `title`
- `objective`
- `sessionId` optional link back to the conversation thread
- `status`
- `tokenBudgetUSD`

Task creation writes a visible work item and records a conversation note when a session is present. Clarification and completion messages are also written back to the linked conversation.

`tasks`

- `directiveId`
- `title`
- `description`
- `assignedAgentId`
- `status`
- `dependencies`
- internal control fields

The UI should translate backend statuses into plain labels such as Preparing, In progress, Needs your answer, Waiting for review, Paused, and Completed.

## Library

`documents`

- `workspaceId`
- `title`
- `departmentTag`
- `author`
- `traceId` optional link to the task that created it
- `kind`
- `summary`
- `currentVersionId`
- `versionCount`
- `status`
- archive timestamps

`documentVersions`

- `documentId`
- `content`
- `versionNumber`
- `createdAt`
- `createdBy`
- `summary`
- optional embedding

Library queries should hide archived records by default and expose saved outputs by task when Home needs task result links.

Library item kinds can include documents, files, websites, presentations, tools, automations, task outputs, conversations, and records. The UI should group by these plain-language types first. Department tags are internal metadata only.

`documentVersions` power manual edits and generated revisions. Version history should be queried only for the selected item view.

## Automations

`scheduleItems`

- `title`
- `kind: "automation"` for founder-facing automations
- `status`
- `startAt`
- `prompt`
- `cadence`

Automations are stored as plain business requests such as daily priorities. The UI should show cadence and time in normal language, not cron syntax.

## Approvals

`approvalQueue` stores real review gates for sensitive actions. The UI should only show review UI when queue items are pending. Permanent approval panels on Home are not part of the product direction.

Review gates are for risky external or destructive actions: public publishing, live asset changes, deleting important data, spending money, sending email, posting externally, or contacting third parties. Internal drafts, previews, documents, presentations, schedules, organization, and private tool previews should proceed without a review gate.

## Overview Query

`commandCenter.getOverview` is an internal overview query despite the legacy file name. It may aggregate workspace, recent task, Library, approval, and internal foundation counts, but the frontend should not surface legacy naming.
