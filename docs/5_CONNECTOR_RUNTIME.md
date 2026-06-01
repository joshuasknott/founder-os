# FounderOS Hidden Runtime

FounderOS is the workspace the founder uses. External services, specialist engines, retrieval systems, and schedule runners stay hidden behind the product surface. The founder sees Home, Work, Library, Schedules, Settings, progress, previews, drafts, knowledge, and approvals. They do not see connector names, API details, raw logs, model names, branches, command output, graph mechanics, or internal state names by default.

## Core Principle

**Work is visible. Machinery is not.**

Home can turn a plain-language request into a visible Work item, Library answer, or Schedule. The hidden runtime tracks the work, records founder-facing progress, stores useful outputs, keeps context relationships current, and pauses for approval before any sensitive external action.

## Runtime Model

```
Home request -> Work, Library answer, or Schedule -> Plain updates -> Output or answer -> Review when needed -> Library knowledge
```

### Home Request

A request starts on Home or in the contextual AI sidebar. FounderOS can answer from knowledge, ask a clarifying question, start visible Work, or create/update a Schedule. Conversation remains read-only until the founder confirms an action that changes business records, starts work, or creates recurring work.

### Work

When the request needs execution, FounderOS creates a visible Work item from the underlying `directives` record. Work appears as Active, Review, or Completed.

Each Work item can have one or more `workRuns`. A run is the hidden execution record for a specific kind of work:

- `code_preview`
- `document`
- `design`
- `email`
- `schedule`
- `data_update`
- `generic`

Runs should be translated into founder-facing statuses:

| Status | Founder meaning |
|---|---|
| `queued` | Preparing |
| `working` | In progress |
| `needs_review` | Ready for review |
| `waiting_for_approval` | Waiting for approval |
| `completed` | Completed |
| `failed` | Could not finish |
| `stopped` | Stopped |

Technical details can be stored in internal fields for debugging, but they should not be rendered in the founder-facing UI.

`generic` is a fallback work type, not the product model. FounderOS should route work to the most specific useful type as capabilities mature.

### Plain Updates

`workRunUpdates` are the only progress messages shown to the founder. They must be short, calm, and non-technical.

Good examples:

- "I've added this to Work and I'm preparing the next step."
- "I'm making the requested changes."
- "I found something that needs correcting."
- "Your preview is ready to review."
- "Saved to Library."

Avoid:

- connector names
- raw API responses
- shell commands
- file paths
- branches or commit hashes
- provider/model names
- retry counts or tool invocation details

### Output

`workArtifacts` records hold outputs from a run: preview links, draft links, summary records, or Library links. Artifacts may point at a `documents` record when the output should become part of the FounderOS Library.

The Library remains the source of truth for useful business outputs. External destinations can exist behind the scenes, but FounderOS should always keep a plain summary and useful record in Library.

### Library Knowledge

Library is queryable business knowledge, not a folder system. The runtime may store summaries, source links, embeddings, relationship metadata, and retrieval signals to help answer future questions.

The founder should see answers, sources, related items, and saved outputs. They should not see graph nodes, embeddings, retrieval scores, or manual relationship maintenance.

### Schedules

Schedules are recurring work requests. The runtime may use queues, timers, or cron-like rules internally, but the founder should see plain cadence and business intent.

A schedule run can create Work, write to Library, or request Review before any external action.

### Pinned Intelligent Views

Pinned views are saved business lenses over Work, Library, Schedules, and hidden context relationships. They should update from live data and show founder-facing titles, counts, and item lists.

The runtime can keep query criteria and context graph signals internally. The UI should not present pinned views as manual folders.

### Review And Approval

Drafting, preparing, organizing, and private previews can proceed without approval. FounderOS must ask before:

- publishing publicly
- changing live assets
- sending email
- posting externally
- spending money
- deleting important data
- contacting people outside the business

Approval prompts should describe the business action, not the connector action:

- "Publish this page"
- "Send this email"
- "Update the live site"
- "Delete this record"

Approving should resume the paused work. Denying should decline that step without erasing the whole task.

## Connector Visibility

Connectors are implementation details. They are selected by the runtime based on the requested work, available credentials, and approval rules. Settings may show connected services in plain language, but there is no connector marketplace or technical connector-control surface in the founder experience.

Visible connector actions must be honest. A visible action may complete only when it calls the real provider or writes a real local/Library result. If the runtime cannot do that yet, the action should return a plain "not live yet" message or be blocked by connector action evaluation. It must not return a placeholder success.

Current live connector boundary:

- Gmail can read context, prepare drafts, and send only after approval.
- Google Calendar can read context and create exact approved events.
- Google Drive, Docs, and Sheets can find relevant files and read safe previews for context. Export and update actions are not live yet and are blocked.
- GitHub can import selected repository context into Library when the GitHub App installation and app credentials are configured. Issue and pull-request creation are not live yet and are blocked.
- OpenCode can run private product-building work when local setup is configured.
- Vercel preview publishing is live through the builder worker environment, not through the Settings connector card. Settings Vercel actions are blocked until wired end to end.

The UI may show:

- task title
- run status
- plain progress updates
- preview or review links
- Library items
- approval requests
- schedule cadence
- related sources

The UI must not show:

- connector names
- API endpoint URLs
- model/provider names
- raw logs
- command output
- branch names or commit hashes
- internal table/state names
- tool invocation payloads
- graph nodes, embeddings, or retrieval scores

## Current Implementation Boundary

The current implementation should keep using the existing runtime records while the product direction moves to Home, Work, Library, Schedules, and Settings. Some task requests may still fall back to a `generic` run locally, but that is an implementation fallback rather than a founder-facing promise or the only future work model.

Next runtime steps:

1. Render Work as Active, Review, and Completed.
2. Keep Home as the universal command surface without adding heavy dashboard UI.
3. Make Library search and item views feel like business knowledge, not folders.
4. Keep Schedules as plain recurring work.
5. Save completed outputs and useful decisions to Library.
6. Extend approvals so paused work can resume after founder approval.
7. Introduce contextual sidebar and pinned intelligent views gradually once the underlying data is real.
