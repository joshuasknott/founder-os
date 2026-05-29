# FounderOS Frontend Architecture

## Overview

FounderOS is a calm AI company workspace for one founder and one business. The UI should feel like a practical app for thinking, delegating work, and reviewing finished business outputs. It must not feel like a marketing site, demo dashboard, project manager, or developer console.

The frontend uses Next.js App Router, Convex queries/mutations/actions, and Tailwind CSS. The interface should hide backend planning details while preserving the underlying system capability.

## Design Principles

- **App-like, not promotional**: no landing-page hero, metrics wall, feature catalogue, or fake activity panels.
- **Prompt-first**: the Home screen is centered on one dominant floating prompt box.
- **Plain language**: user-facing copy says `Library`, `Chat`, `Task`, `workspace`, `review`, and `saved outputs`.
- **Avoid user-facing internal terms**: do not show artifacts, operators, routing, autonomy level, command center, directives, or projects.
- **Honest data**: show live Convex data only. Starter examples may appear as prompt suggestions, not as seeded records pretending to be real.
- **Calm utility**: restrained surfaces, readable typography, stable spacing, and no decorative visual bloat.

## App Shell

The root layout is a two-zone app:

- **Left navigation**: fixed sidebar on desktop, top bar on small screens.
- **Main workspace**: route content with independent scrolling.

Primary navigation is intentionally simple:

1. **Home**
2. **Library**
3. **Settings**

Workspace switching is hidden for now. FounderOS assumes one founder and one business. Internal workspace support may remain in the backend, but the primary UI should not ask the founder to choose between workspaces.

The left sidebar also contains recent chats and tasks. Recent conversations belong here, not on the Home canvas.

## Home

Home is the main loop:

1. The founder types into the floating prompt.
2. The founder chooses `Chat` or `Task` inside the prompt box.
3. Chat keeps the conversation read-only and helps with thinking, planning, decisions, and context.
4. Task creates a visible work item, shows progress, and records finished outputs in Library.

New sessions default to Chat. Chat must not create business outputs, schedule work, publish, send messages, or change data. If the founder asks for work while in Chat, the assistant should help shape a task.

Task mode always creates a visible work item. Clarifying questions and answers stay in the same conversation thread. Completed task summaries are also written back into that conversation, and generated outputs are linked from the task panel to Library.

Home should only show:

- the prompt box
- useful prompt suggestions
- conversation messages when a conversation exists
- active task/result feedback when relevant
- approval requests only when one is actually pending
- quiet empty states

Home should not show department grids, project cards, schedule cards, build activity feeds, permanent approval blocks, marketing copy, preview promos, or fake panels.

## Active Task View

Task progress should be understandable to a non-technical founder:

- use named professional AI workers with avatars/initials and roles
- show steps as a simple timeline/list
- use plain statuses such as Preparing, In progress, Needs your answer, Waiting for review, Paused, Completed
- show concise output summaries
- link to real saved outputs in Library when they exist

Do not expose provider choices, raw logs, internal planning, tool calls, model tiers, or backend state names.

## Library

Library is the business context layer. FounderOS should create better outputs because it can reuse saved documents, assets, websites, presentations, tools, automations, task outputs, uploaded files, conversations, history, and useful records.

The route is `/library`. The legacy `/context` route redirects to `/library`.

Library is organized by type first:

- Documents
- Websites
- Presentations
- Tools
- Automations
- History
- Conversations

No asset type should dominate the page. Internal areas may exist as quiet metadata or secondary filters, but the main flow should not ask the founder to manage departments.

Library items should open into a selected item view. Documents and saved outputs support manual editing by creating a new version. Version history belongs only inside the selected item view, not as a global Library screen. Completed tasks and conversations should be reachable for continuity without turning the Library list into an activity feed.

Automations stay plain-language. A request such as "send me priorities every morning at 6am" should appear as a manageable Library automation, without cron syntax or technical schedule controls.

## Settings

Settings contains practical controls:

- AI keys
- connected services
- spending limits
- review rules

Settings copy should stay plain-language. It should not expose provider routing, internal worker controls, autonomy settings, or technical schedule rules.

## Data Flow

The frontend should prefer Convex data over local mock arrays. Local React state is appropriate for temporary UI state such as selected mode, draft text, open panels, and selected item IDs.

Initialization creates only the minimum real workspace foundation: workspace, owner, internal business areas, AI worker roster, and task playbooks. It must not seed fake projects, schedules, build activity, or Library records.
