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
- `BUILDER_PREVIEW_URL`: optional preview URL to attach to simulated runs. Defaults to `http://localhost:3000`.
- `BUILDER_POLL_INTERVAL_MS`: optional polling interval. Defaults to `5000`.

The worker must only write plain-language updates to `workRunUpdates`. Internal logs, changed file metadata, command counts, usage, and thread ids stay in internal run notes.
