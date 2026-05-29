# FounderOS Product Direction

FounderOS is an AI-native operating system for a non-technical founder running one business. It gives the founder one calm place to ask, decide, delegate, review, and reuse company knowledge.

The product should feel like a trusted business workspace, not a marketing site, demo dashboard, project manager, developer command center, or file cabinet.

## Product Model

The founder-facing model has five surfaces:

1. **Home**: the universal AI command surface. The founder asks questions, gives direction, shapes work, and receives timely prompts from FounderOS.
2. **Work**: the active, review, and completed task flow. Work shows what FounderOS is doing, what needs the founder's decision, and what has already been finished.
3. **Library**: queryable business knowledge. Library stores and explains the company context FounderOS can use; it is not a folder system the founder has to maintain.
4. **Schedules**: recurring work. Schedules are plain-language requests FounderOS repeats on the founder's behalf.
5. **Settings**: account, connections, and rules. Settings covers the founder profile, connected services, spending limits, review rules, and other standing preferences.

The backend may keep richer internal structures, but the founder should not have to understand them. User-facing surfaces should stay centered on business intent, work state, knowledge, recurring requests, and rules.

## Home

Home is the founder's universal command surface. It is where the founder can ask for advice, search company knowledge, start work, refine a request, or act on a timely suggestion without choosing an internal tool first.

Home can support lightweight modes, but the product should not make the founder manage technical routing. The same prompt should be able to:

- answer from business context
- help think through a decision
- shape a task before it starts
- start visible work
- find a Library item
- update or create a recurring schedule
- explain what needs review

When work starts, Home should create or link to a visible Work item. Clarification happens in context so the founder does not lose the thread.

## Work

Work is the task flow for FounderOS. It is not a project-management board. It answers three founder questions:

- **Active**: what is FounderOS working on now?
- **Review**: what needs my answer, approval, or decision?
- **Completed**: what has been done, and where is the result?

Every meaningful task creates a visible Work item. Work items show plain progress, the current owner or AI worker, review needs, and final outcomes. Completed work should link to the relevant Library knowledge, saved output, schedule, or external result when one exists.

## Library

Library is the queryable business knowledge layer. It stores the context FounderOS should use to produce better answers and outputs: documents, pages, presentations, tools, task outputs, uploaded files, conversations, decisions, research, customer notes, and useful records.

Library should feel like asking the business what it knows, not browsing folders. It can offer filters and views, but the primary action is search, ask, summarize, compare, and reuse. The founder should not have to build a taxonomy for FounderOS to be useful.

Saved items open into an item view with a clear summary, source, related work, and relevant versions when needed. Version controls should stay useful but quiet.

## Schedules

Schedules are recurring work requests, not technical timers. A schedule should read like "send me priorities every morning at 6am" or "review new customer feedback every Friday."

Schedules should show what will happen, when it repeats, where results go, and whether review is needed before any external action. They must be visible and manageable without exposing cron syntax or internal worker details.

## Contextual AI Sidebar

The AI sidebar is contextual help, not a second app. It should understand the page the founder is on and offer the most useful next step:

- on Home, help clarify the ask or turn a conversation into work
- in Work, explain status, summarize progress, draft a reply, or help make a review decision
- in Library, answer from the selected knowledge and surface related context
- in Schedules, explain cadence, suggest improvements, or help pause/change recurring work
- in Settings, explain rules and connections in plain language

The sidebar should be available when useful and quiet when it is not. It must not expose hidden orchestration, raw logs, model choices, or technical routing.

## Pinned Intelligent Views

FounderOS can provide pinned views that act like living business lenses, for example "Open Reviews," "This Week's Priorities," "Recent Customer Signals," or "Launch Materials."

Pinned views are not static folders. They are saved questions or criteria over the business context and work state. They should update automatically as the business changes and explain why items appear when that is useful.

## Hidden Context Graph

FounderOS should quietly maintain relationships between conversations, work, outputs, people, decisions, schedules, and business records. This hidden context graph helps the system retrieve the right context without making the founder manage links manually.

The founder-facing principle is simple: FounderOS remembers how work, knowledge, and decisions relate. The UI can show helpful related items, sources, and reasons, but it should not expose graph mechanics, node labels, embeddings, or internal scoring.

## AI Workers

AI workers should feel like professional staff roles: Chief of Staff, Systems Lead, Preview Designer, Growth Lead, and Operations Steward. The UI may show their names, roles, avatars, and current step.

The UI must not expose raw orchestration, provider logic, model choices, internal logs, or technical state.

## Approvals

FounderOS can draft, preview, organize, summarize, plan, schedule, and prepare internal work without interrupting the founder. It asks for review before public publishing, changing live assets, deleting important data, spending money, sending email, posting externally, or contacting external people.

Approval requests should appear only when real approval is needed.

## Data Honesty

No fake records should be seeded or displayed as real work. Empty workspaces should feel quiet and honest. Starter ideas belong in prompt suggestions, not in the database as pretend projects, schedules, files, or activity.

## Implementation Boundary

Do not overbuild UI before the product model is stable. The immediate direction is to make navigation, copy, docs, and core data behavior match the five-surface model. Rich pinned views, graph explanations, and sidebar behaviors can be introduced gradually once the underlying work and knowledge flows are real.
