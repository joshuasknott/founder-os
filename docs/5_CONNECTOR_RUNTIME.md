# FounderOS Hidden Work Runtime

FounderOS is the workspace the founder uses. External services and specialist engines stay hidden behind the product surface. The founder sees tasks, progress, previews, drafts, Library items, and approvals. They do not see connector names, API details, raw logs, model names, branches, command output, or internal state names by default.

## Core Principle

**Work is visible. Machinery is not.**

Task mode turns a plain-language request into a visible work item. The hidden runtime tracks the work, records founder-facing progress, stores useful outputs, and pauses for approval before any sensitive external action.

## Runtime Model

```
Task -> Work run -> Plain updates -> Output -> Review or approval -> Library
```

### Task

A task starts when the founder uses Task mode from Home. FounderOS creates a `directives` record with the task title, objective, conversation link, and visible status. Chat remains read-only and must not create outputs or change business data.

### Work Run

Each task can have one or more `workRuns`. A run is the hidden execution record for a specific kind of work:

- `code_preview`
- `document`
- `design`
- `email`
- `schedule`
- `data_update`
- `generic`

Runs use founder-facing statuses:

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

### Plain Updates

`workRunUpdates` are the only progress messages shown to the founder. They must be short, calm, and non-technical.

Good examples:

- "I’ve added this to your workspace and I’m preparing the next step."
- "I’m making the requested changes."
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

Approving should resume the paused run. Denying should decline that step without erasing the whole task.

## Connector Visibility

Connectors are implementation details. They are selected by the runtime based on the requested work, available credentials, and approval rules. There is no connector marketplace or connector settings surface in the founder experience.

The UI may show:

- task title
- run status
- plain progress updates
- preview or review links
- Library items
- approval requests

The UI must not show:

- connector names
- API endpoint URLs
- model/provider names
- raw logs
- command output
- branch names or commit hashes
- internal table/state names
- tool invocation payloads

## Current Implementation Boundary

The current implementation creates a directive and a queued generic `workRun` for new Task mode requests. It does not yet execute real connector work. The old text-only playbook executor should not be used for new task execution.

Next runtime steps:

1. Render work runs and updates in the task conversation.
2. Add a local hidden builder worker.
3. Use Codex as the first hidden builder for code previews.
4. Add preview handling.
5. Save completed outputs to Library.
6. Extend approvals so paused runs can resume after founder approval.
