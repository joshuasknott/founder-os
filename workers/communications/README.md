# Hidden Communications Worker

This worker prepares communication and scheduling work for review. It does not send email, post externally, or create calendar events.

Current behavior:

- finds queued `email` and `schedule` work runs
- prepares a draft or scheduling suggestion
- marks the run ready for review
- saves the output to Library

Run once:

```bash
npm run worker:communications:once
```

Run continuously:

```bash
npm run worker:communications
```

Configuration:

- `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL. The worker also reads `.env.local`.
- `COMMUNICATIONS_WORKER_POLL_INTERVAL_MS`: optional polling interval. Defaults to `5000`.

External actions remain approval-gated. FounderOS may draft and suggest, but it must ask before sending, posting, or creating calendar events.
