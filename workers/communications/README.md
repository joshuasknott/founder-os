# Hidden Communications Worker

This worker prepares communication and scheduling work for review. It imports safe Gmail and Google Calendar context when connected, saves drafts or suggestions first, and uses the approval queue before sending email or creating calendar events.

Current behavior:

- finds queued `email` and `schedule` work runs
- imports relevant email or availability context when available
- prepares a draft or scheduling suggestion
- marks the run ready for review and queues approval for requested external actions
- resumes approved sends or event creation through the hidden connector runtime
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

External actions remain approval-gated. FounderOS may draft and suggest, but it must ask before sending, posting, or creating calendar events. Sent email and scheduled-event results are saved back to Library history and connector action history.
