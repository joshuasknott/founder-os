# FounderOS Frontend Architecture

## Overview

FounderOS is a calm AI company workspace for one founder and one business. The UI should feel like a practical app for thinking, delegating work, reviewing outcomes, scheduling recurring work, and using company knowledge. It must not feel like a marketing site, demo dashboard, project manager, file cabinet, or developer console.

The frontend uses Next.js App Router, Convex queries/mutations/actions, and Tailwind CSS. The interface should hide backend planning details while preserving the underlying system capability.

## Design Principles

- **App-like, not promotional**: no landing-page hero, metrics wall, feature catalogue, or fake activity panels.
- **Command-first**: Home is the universal AI command surface for asking, deciding, finding, and starting work.
- **Work as task flow**: Work is organized around Active, Review, and Completed.
- **Knowledge, not folders**: Library is queryable business knowledge, not a folder system the founder has to maintain.
- **Plain language**: user-facing copy says `Home`, `Work`, `Library`, `Schedules`, `Settings`, `review`, and `saved outputs`.
- **Avoid user-facing internal terms**: do not show artifacts, operators, routing, autonomy level, command center, directives, graph nodes, embeddings, or projects.
- **Honest data**: show live Convex data only. Starter examples may appear as prompt suggestions, not as seeded records pretending to be real.
- **Calm utility**: restrained surfaces, readable typography, stable spacing, and no decorative visual bloat.
- **Do not overbuild early**: introduce the five-surface direction in navigation, copy, and data behavior before adding heavy new UI.

## App Shell

The root layout is a two-zone app:

- **Left navigation**: fixed sidebar on desktop, top bar on small screens.
- **Main workspace**: route content with independent scrolling.

Primary navigation is intentionally simple:

1. **Home**
2. **Work**
3. **Library**
4. **Schedules**
5. **Settings**

Workspace switching is hidden for now. FounderOS assumes one founder and one business. Internal workspace support may remain in the backend, but the primary UI should not ask the founder to choose between workspaces.

The left sidebar may include recent conversations, open reviews, and pinned intelligent views. These should support quick return to important context without turning Home into an activity feed.

## Home

Home is the universal AI command surface. It is the place to ask, decide, search, shape work, and start a task without first choosing a tool or department.

The main loop is:

1. The founder types into the prompt.
2. FounderOS answers, asks a clarifying question, finds knowledge, or proposes work.
3. If work starts, FounderOS creates or links a visible Work item.
4. Work progress and review needs are shown in Work, with concise feedback available from Home when relevant.
5. Finished outputs and useful decisions are saved or linked in Library.

Conversation remains read-only until the founder chooses or confirms a work action. FounderOS should not create outputs, schedule recurring work, publish, send messages, or change business records without making that action clear.

Clarifying questions and answers stay in context. Completed task summaries are written back to the conversation and linked from the Work item.

Home should only show:

- the prompt box
- useful prompt suggestions
- conversation messages when a conversation exists
- concise active work or result feedback when relevant
- review requests only when one actually needs the founder
- pinned intelligent views when they help the founder return to important work or knowledge
- quiet empty states

Home should not show department grids, project cards, folder trees, build activity feeds, permanent approval blocks, marketing copy, preview promos, or fake panels.

## Work

Work is the founder-facing task flow. It should be organized around three views:

- **Active**: work currently being prepared or worked on.
- **Review**: work waiting for the founder's answer, approval, or decision.
- **Completed**: finished work with outcomes and links to saved knowledge.

These views are not project-management columns. They are a calm way to understand what FounderOS is doing and what the founder needs to touch.

## Work Item View

Work progress should be understandable to a non-technical founder:

- use named professional AI workers with avatars/initials and roles
- show steps as a simple timeline/list
- use plain statuses such as Preparing, In progress, Needs your answer, Waiting for review, Paused, Completed
- show concise output summaries
- link to real saved outputs in Library when they exist

Do not expose provider choices, raw logs, internal planning, tool calls, model tiers, or backend state names.

## Library

Library is queryable business knowledge. FounderOS should create better outputs because it can reuse saved documents, assets, websites, presentations, tools, task outputs, uploaded files, conversations, decisions, history, and useful records.

The route is `/library`. The legacy `/context` route redirects to `/library`.

Library should prioritize search, asking, filtering, summarizing, and related context. It is not a folder system. Views may group by type when helpful:

- Documents
- Websites
- Presentations
- Tools
- Task outputs
- History
- Conversations
- Records

No asset type should dominate the page. Internal areas may exist as quiet metadata or secondary filters, but the main flow should not ask the founder to manage departments, folders, or graph links.

Library items should open into a selected item view. The item view should show a clear summary, source, related work, and versions when useful. Documents and saved outputs support manual editing by creating a new version. Version history belongs only inside the selected item view, not as a global Library screen.

FounderOS may extract a conservative set of remembered business details from Library saves and completed work. The direct controls stay under Settings: view, refresh, add, edit, delete, and disable. Home exposes only a per-request `Use remembered details` checkbox. Do not add a top-level memory route or expose extraction, embedding, scoring, worker, model, or provider mechanics.

Completed tasks, conversations, schedules, and decisions should be reachable for continuity without turning Library into an activity feed.

## Schedules

Schedules are recurring work. The route is `/schedules`. It also hosts the
founder-facing workflow list: reusable business processes that can run now or
be put on a schedule. Hidden templates, task matrices, queues, and runtime
records must not appear in UI copy.

Schedules should show:

- the plain-language request
- when it repeats
- where results will appear
- whether review is needed before an external action
- pause, edit, and archive controls

Schedules should not expose cron syntax, worker routing, connector names, or technical schedule controls.

## Contextual AI Sidebar

The AI sidebar is page-aware help. It should understand the current page, selected item, active work item, or schedule and offer actions that fit that context.

Expected behavior:

- on Home, clarify the ask, search knowledge, or turn the conversation into work
- in Work, summarize status, explain blockers, draft founder replies, and help with review decisions
- in Library, answer from the selected item, compare related knowledge, and explain sources
- in Schedules, explain cadence and help change or pause recurring work
- in Settings, explain rules and connection effects in plain language

The sidebar must remain founder-facing. It should not show hidden graph mechanics, raw orchestration, model choices, or internal state.

## Pinned Intelligent Views

Pinned views are saved business lenses over Work and Library, not folders. Examples include Open Reviews, This Week's Priorities, Recent Customer Signals, and Launch Materials.

Pinned views should update from live data and can explain why an item is included. They should be small, useful entry points in navigation or Home, not a new dashboard layer.

## Hidden Context Graph

The frontend can benefit from a hidden context graph that relates conversations, work, outputs, schedules, decisions, people, and records. The founder-facing UI should only reveal useful context: related items, sources, and short reasons.

Do not expose graph nodes, embeddings, retrieval scores, or relationship maintenance as user work.

## Settings

Settings contains practical controls:

- account details
- connected services
- spending limits
- review rules
- standing preferences

Settings copy should stay plain-language. It should not expose provider routing, internal worker controls, autonomy settings, graph controls, or technical schedule rules.

## Data Flow

The frontend should prefer Convex data over local mock arrays. Local React state is appropriate for temporary UI state such as selected mode, draft text, open panels, and selected item IDs.

Initialization creates only the minimum real workspace foundation: workspace, owner, internal business areas, AI worker roster, task playbooks, and hidden starter workflow templates. It must not seed fake projects, schedules, build activity, or Library records.
