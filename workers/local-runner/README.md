# FounderOS local runner

The local runner is the preferred hidden executor for Home chat intake and Work.
It registers with Convex, heartbeats, leases hidden chat jobs before Work jobs,
uses local opencode subscription auth for replies, and writes plain progress and
results back to Convex.

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
- keep `FOUNDEROS_OPENCODE_BUSINESS_MODEL=zai-coding-plan/glm-4.7` unless you have a specific paid subscription route
- set `LOCAL_RUNNER_REQUIRE_OPENCODE=true`
- optional for build work: set `BUILDER_PROVIDER=opencode`

The startup check validates the local command and auth before chat or coding
capability is advertised. If opencode is missing and `LOCAL_RUNNER_REQUIRE_OPENCODE`
is not set, the runner stays available for non-opencode work only.

Troubleshooting:

- Home stays on "Preparing a reply": start `npm run local-runner` and confirm the
  same `.env.local` has `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL`,
  `FOUNDEROS_WORKER_TOKEN`, and `LOCAL_RUNNER_ID`.
- Home says FounderOS could not finish on this computer: run `opencode --version`,
  sign in to opencode, then restart `npm run local-runner`.
- Routine Home chat should not use `ZAI_API_KEY`, DeepSeek, OpenRouter, or free
  opencode routes. The normal paid GLM route comes from the local opencode
  subscription.
