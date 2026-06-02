# FounderOS local runner

The local runner is the preferred hidden Work executor. It registers with
Convex, heartbeats, leases matching hidden work, delegates to the existing
worker handlers, and writes plain progress/results back to Work and Library.

## Run

```bash
npm run local-runner
```

Use `npm run local-runner:once` to lease at most one job.

## Required

- `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL`
- `FOUNDEROS_WORKER_TOKEN`
- `LOCAL_RUNNER_ID` for a stable machine name

For local OpenCode work:

- install and sign in to `opencode`
- set `BUILDER_PROVIDER=opencode`
- set `LOCAL_RUNNER_REQUIRE_OPENCODE=true`

The startup check validates the local command and auth before coding capability
is advertised.
