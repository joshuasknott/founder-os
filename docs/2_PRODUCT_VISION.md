# FounderOS Product Direction

FounderOS is an AI-native company workspace for a non-technical founder running one business. It gives the founder one calm place to chat, delegate work, and create useful business outputs from accumulated context.

The product should feel like a trusted workspace, not a marketing site, demo dashboard, project manager, or developer command center.

## Product Model

The founder-facing model is:

1. **Home**: chat, shape tasks, start work, and review progress.
2. **Library**: documents, websites, presentations, tools, automations, task outputs, uploaded files, conversations, history, and useful business records.
3. **Settings**: keys, connected services, spending limits, and review rules.

The backend may keep richer internal structures, but the founder should not have to understand them.

## Chat And Task

FounderOS has two prompt modes:

- **Chat**: think, plan, ask questions, understand the business, and shape future work. Chat is read-only and must not create outputs or make changes.
- **Task**: perform work. Every task creates a visible work item, shows progress, and saves finished outputs to Library when outputs exist.

Clarification happens inside the same conversation thread. Completed task summaries stay in that conversation and are reflected in task history and Library.

## Library

Library is the real business context layer, not just a file shelf. It stores the prior work FounderOS should use to produce better answers and outputs.

The Library is organized by type first: Documents, Websites, Presentations, Tools, Automations, History, and Conversations. Internal areas can be used quietly for assignment and search, but founders should not manage departments in the main flow.

Saved items open into an item view. Editable items can be revised manually, with version history kept inside the item. Version controls should stay useful but quiet.

Automations should read like business requests, for example "send me priorities every morning at 6am." They must be visible and manageable without exposing cron syntax.

## AI Workers

AI workers should feel like professional staff roles: Chief of Staff, Systems Lead, Preview Designer, Growth Lead, and Operations Steward. The UI may show their names, roles, avatars, and current step.

The UI must not expose raw orchestration, provider logic, model choices, internal logs, or technical state.

## Approvals

FounderOS can draft, preview, organize, summarize, plan, schedule, and prepare internal work without interrupting the founder. It asks for review before public publishing, changing live assets, deleting important data, spending money, sending email, posting externally, or contacting external people.

Approval requests should appear only when real approval is needed.

## Data Honesty

No fake records should be seeded or displayed as real work. Empty workspaces should feel quiet and honest. Starter ideas belong in prompt suggestions, not in the database as pretend projects, schedules, files, or activity.
