# Hidden Design Worker

This worker provides the design-work contract before a full design connector is added.

Current behavior:

- finds queued `design` work runs
- prepares a design brief and draft concept notes
- marks the run ready for review
- saves the design direction to Library

Run once:

```bash
npm run worker:design:once
```

Run continuously:

```bash
npm run worker:design
```

Configuration:

- `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL. The worker also reads `.env.local`.
- `DESIGN_WORKER_POLL_INTERVAL_MS`: optional polling interval. Defaults to `5000`.
- `DESIGN_REVIEW_URL`: optional review link to attach to design runs.

The founder-facing product should only show the design brief, review state, review link if present, and Library record. It should not show connector names.
