# Remembered Details

FounderOS uses remembered details as hidden operating context. Founders manage the behavior in plain language from `Settings`, while the runtime keeps extraction, deduplication, redaction, and retrieval rules behind the Library surface.

## Stored Detail Types

`memoryEntries` stores durable details in these categories:

- `founder_preference`
- `business_fact`
- `decision`
- `recurring_workflow`
- `person`
- `company`
- `product`
- `reusable_context`

Each entry stores a short label, a founder-readable value, a canonical deduplication key, search text, sensitivity, source, timestamps, and deletion state. Sources are `library_item`, `completed_work`, or `manual`.

## Extraction Behavior

FounderOS queues safe extraction after:

- a Library item is created through `items.create`, `items.intake`, or the document compatibility layer
- a Library item receives a new version
- a connector import creates or updates a Library item
- completed work saves an output to Library
- the founder selects `Refresh` under `Settings -> Remembered details`

Extraction is deliberately conservative. It looks for durable language such as preferences, decisions, recurring routines, reusable context, business facts, and explicit `Person:`, `Company:`, or `Product:` lines. It does not store every sentence from a Library item.

Entries deduplicate on normalized type, label, and value. When a founder deletes an entry, FounderOS blanks its value and keeps a tombstone. Automatic refreshes do not recreate that deleted detail. A founder can add a new corrected detail manually.

## Privacy Rules

Remembered details are not a secret store.

- Credential-like content is rejected from remembered details.
- API keys, passwords, bearer tokens, access tokens, refresh tokens, private keys, common hosted-service key formats, JWT-like values, and credentials embedded in URLs are redacted before indexing.
- Intake search metadata is redacted before storage.
- Extracted facts carry `sensitivity` and `isSensitive`.
- Stripe-derived finance facts are marked `confidential`.
- `sensitive` remembered details can be viewed and deleted in Settings but are never injected into automatic context.
- `confidential` details are injected only when the request itself is classified as confidential.
- Library-sourced remembered details are checked against the source item's current approval and privacy rules again at retrieval time.
- Completed-work details with a saved Library output re-check that output's privacy metadata and content sensitivity before reuse.

The original Library item remains the founder's saved source of truth. A founder may intentionally save private material there. The memory layer stores only the safe extracted detail, and automatic Library context still applies approval, privacy, and sensitivity gates.

## Retrieval Behavior

Remembered details are selected by keyword relevance and sensitivity for:

- read-only Home chat
- Library item questions and document revisions
- document work
- workflow runs
- builder tasks

The workspace-level `Settings -> Remembered details -> Use remembered details` switch disables remembered-detail retrieval. The Home prompt also exposes `Use remembered details` for one request. That per-request choice follows the created task into its hidden work records.

Automatic Library retrieval is stricter than founder-visible search:

- archived items are excluded
- unapproved Library versions are excluded unless the existing document-context override explicitly allows them
- private or restricted Library content is excluded
- sensitive extracted facts are excluded
- remembered-detail mirror facts are excluded because the dedicated memory retrieval path already applies its policy
- semantic document lookup is workspace-scoped

Founder-visible Library search remains a way to find the founder's own saved records. It is not the same as automatic prompt context.

## Founder Controls

Settings contains the only direct remembered-detail management surface:

- view remembered details
- enable or disable reuse
- refresh from Library and completed work
- add a correction
- edit a remembered detail
- delete a remembered detail

No new top-level navigation item is added. The UI does not expose models, providers, workers, embeddings, retrieval scores, or logs.

## Operator Notes

- Existing workspaces do not need a migration script. Use `Settings -> Remembered details -> Refresh` to queue a bounded rescan of up to 100 active Library items and 100 completed work records per request.
- The public `memory.rescanWorkspace` mutation accepts an optional `limit` capped at `250` for operator-driven batches.
- The default is enabled when a workspace has no `memorySettings` row.
- Deletion is intentionally a tombstone operation. Do not purge deleted rows unless you also preserve a suppression record, or automatic refresh can recreate a removed detail.
- Existing historical facts created before this layer are not rewritten automatically. Re-save or re-import affected Library items when redacted fact metadata needs to be refreshed.
- Tests for the deterministic policy live in `tests/memoryModel.test.mjs`.
