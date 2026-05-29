# Hidden Builder Worker

This local worker handles queued preview-building work for FounderOS. It is intentionally not part of the founder-facing product surface.

Current behavior:

- finds queued `code_preview` work runs
- marks them in progress
- writes plain-language progress updates
- simulates a preview result
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
- `BUILDER_PREVIEW_URL`: optional preview URL to attach to simulated runs. Defaults to `http://localhost:3000`.
- `BUILDER_POLL_INTERVAL_MS`: optional polling interval. Defaults to `5000`.

The worker must only write plain-language updates to `workRunUpdates`. Internal logs stay in the terminal.
