# Hidden Document Worker

This local worker handles document-style work for FounderOS. It keeps FounderOS Library as the primary destination and does not expose external document connectors.

Current behavior:

- finds queued `document` work runs
- marks them in progress
- writes plain-language progress updates
- prepares a first internal draft
- saves the result to Library
- marks the run completed

Run once:

```bash
npm run worker:documents:once
```

Run continuously:

```bash
npm run worker:documents
```

Configuration:

- `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL. The worker also reads `.env.local`.
- `DOCUMENT_WORKER_POLL_INTERVAL_MS`: optional polling interval. Defaults to `5000`.

Supported first-pass document outputs include briefs, plans, checklists, proposals, meeting notes, and launch plans.
