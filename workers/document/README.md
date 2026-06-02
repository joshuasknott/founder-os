# Hidden Document Worker

This local worker handles document-style work for FounderOS. It keeps FounderOS Library as the primary destination and does not expose external document connectors.

Current behavior:

- finds queued `document` work runs
- marks them in progress
- writes plain-language progress updates
- pulls relevant approved Library context through privacy gates
- prepares a markdown draft through the local OpenCode subscription
- uses `glm-4.7` for normal documents and `glm-5-turbo` for planning, finance,
  synthesis, and strategy documents
- reviews important documents with a different GLM route where practical
- saves the result as a versioned Library item
- marks the run ready for founder review

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

No direct `ZAI_API_KEY` is required. DeepSeek is not used for routine document
generation.

Supported first-pass document outputs include memos, briefs, plans, SOPs,
proposals, strategy documents, checklists, meeting notes, and launch plans.
