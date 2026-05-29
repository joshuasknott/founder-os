# Hidden Builder Worker

This local worker handles queued preview-building work for FounderOS. It is intentionally not part of the founder-facing product surface.

Current behavior:

- finds queued `code_preview` work runs
- marks them in progress
- writes plain-language progress updates
- uses Codex when explicitly enabled
- falls back to a simulated review result for local development
- marks the run ready for review

Run once:

```bash
npm run builder:once
```

Run continuously:

```bash
npm run builder
```

Configuration:

- `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL. The worker also reads `.env.local`.
- `BUILDER_USE_CODEX`: set to `true` to run Codex instead of the local simulation.
- `OPENAI_API_KEY`: required when `BUILDER_USE_CODEX=true`.
- `BUILDER_WORKSPACE_DIR`: optional project workspace for Codex. Defaults to the current directory.
- `BUILDER_CODEX_MODEL`: optional Codex model override.
- `BUILDER_CODEX_REASONING_EFFORT`: optional reasoning effort. Defaults to `medium`.
- `BUILDER_PREVIEW_URL`: local preview URL to check. Defaults to `http://localhost:3000`.
- `BUILDER_PREVIEW_PROVIDER`: internal preview provider label. Defaults to `local`.
- `BUILDER_START_PREVIEW`: set to `true` to let the worker start a local preview if one is not already running.
- `BUILDER_PREVIEW_COMMAND`: command used when `BUILDER_START_PREVIEW=true`. Defaults to `npm run dev`.
- `BUILDER_PREVIEW_TIMEOUT_MS`: how long to wait for a local preview. Defaults to `30000`.
- `BUILDER_POLL_INTERVAL_MS`: optional polling interval. Defaults to `5000`.
- `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID`: optional internal deployment metadata for future approved publishing flows.

The worker must only write plain-language updates to `workRunUpdates`. Internal logs, source metadata, deployment metadata, changed file metadata, command counts, usage, and thread ids stay in internal run notes. Publishing or deployment must remain approval-gated.
