# FounderOS Acceptance Runbook

This runbook is for end-to-end acceptance on a real FounderOS workspace. The
product should feel like Home, Work, Library, Schedules, and Settings. Backend
mechanics, provider names, model names, routes, leases, and worker logs should
stay hidden from founder-facing screens.

## Required Environment

Copy `.env.example` to `.env.local`, then fill these values for local
acceptance:

```bash
CONVEX_DEPLOYMENT=
CONVEX_URL=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER_DOMAIN=

FOUNDEROS_WORKER_TOKEN=
CONNECTOR_SECRET_ENCRYPTION_KEY=
```

Set the Convex-side server values as well:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN <clerk-issuer-domain>
npx convex env set FOUNDEROS_WORKER_TOKEN <long-random-token>
npx convex env set CONNECTOR_SECRET_ENCRYPTION_KEY <encryption-key>
```

Optional connector and deployment values:

```bash
GOOGLE_CONNECTOR_CLIENT_ID=
GOOGLE_CONNECTOR_CLIENT_SECRET=
GITHUB_APP_NAME=founderos-connect
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=

BUILDER_VERCEL_PREVIEWS=false
BUILDER_VERCEL_TOKEN=
BUILDER_VERCEL_PROJECT_ID=
BUILDER_VERCEL_PROJECT_NAME=
BUILDER_VERCEL_TEAM_ID=
BUILDER_VERCEL_PRODUCTION_DOMAIN=
```

Do not set `ZAI_API_KEY` for the normal path. The default GLM routes are used
through local opencode auth, not through a direct Z.ai API key. Direct Z.ai is a
manual compatibility path only and requires `FOUNDEROS_ENABLE_DIRECT_ZAI=true`.

## OpenCode Auth

Install opencode on the computer running FounderOS, then sign in with the
account that has the paid GLM subscription routes available.

Check it locally:

```bash
opencode --version
opencode run --title "FounderOS setup check" "Reply with READY only."
```

Recommended local runner settings:

```bash
LOCAL_RUNNER_ID=founder-laptop
LOCAL_RUNNER_NAME=FounderOS local runner
LOCAL_RUNNER_REQUIRE_OPENCODE=true
LOCAL_RUNNER_SKIP_OPENCODE_CHECK=false
FOUNDEROS_OPENCODE_CLASSIFICATION_MODEL=zai-coding-plan/glm-4.5-air
FOUNDEROS_OPENCODE_BUSINESS_MODEL=zai-coding-plan/glm-4.7
FOUNDEROS_OPENCODE_PLANNING_MODEL=zai-coding-plan/glm-5-turbo
FOUNDEROS_OPENCODE_CODING_MODEL=zai-coding-plan/glm-5.1
```

Do not point routine Home chat or normal build work at free opencode routes or
DeepSeek. Free opencode routes are only for redacted public drafts and require
GLM verification.

## Local Commands

Start Convex:

```bash
npx convex dev
```

Start the web app:

```bash
npm run dev
```

Start the preferred local runner:

```bash
npm run local-runner
```

Single-lease checks:

```bash
npm run local-runner:once
npm run builder:once
npm run worker:documents:once
npm run worker:design:once
npm run worker:communications:once
npm run worker:generic:once
```

Continuous legacy workers, when needed:

```bash
npm run builder
npm run worker:documents
npm run worker:design
npm run worker:communications
npm run worker:generic
```

## Automated Browser Acceptance

FounderOS uses Playwright with Clerk test auth so authenticated browser tests can
reuse a saved storage state instead of signing in manually every time. The saved
browser state is written under `playwright/.auth` and must stay out of Git.

Required browser-test values:

```bash
E2E_BASE_URL=http://localhost:3000
E2E_CLERK_TEST_USER_EMAIL=e2e+clerk_test@example.com
CLERK_SECRET_KEY=
```

Optional values:

```bash
E2E_START_WEB_SERVER=true
E2E_REUSE_EXISTING_SERVER=false
FOUNDEROS_E2E_LIVE_CONNECTORS=false
E2E_ACCEPTANCE_EMAIL_TO=
E2E_ACCEPTANCE_CALENDAR_ATTENDEE=
E2E_ACCEPTANCE_GITHUB_OWNER=
E2E_ACCEPTANCE_GITHUB_REPO=
E2E_ACCEPTANCE_GITHUB_HEAD_BRANCH=
E2E_ACCEPTANCE_GITHUB_BASE_BRANCH=main
```

Use `E2E_START_WEB_SERVER=true` when Playwright should start `npm run dev`
itself. The server starts on the host and port from `E2E_BASE_URL`, and it will
not reuse an existing server unless `E2E_REUSE_EXISTING_SERVER=true` is set.
Leave `E2E_START_WEB_SERVER=false` when Convex, Next, and the local runner are
already running in separate terminals.

Run the browser checks:

```bash
npm run test:e2e:setup
npm run test:e2e
```

Run the full local acceptance gate:

```bash
npm run test:acceptance
```

Only set `FOUNDEROS_E2E_LIVE_CONNECTORS=true` for staging accounts and staging
resources. Live destructive checks should use unique test names and teardown
where each provider supports deletion or cleanup.

## Builder Preview Setup

Default builder settings:

```bash
BUILDER_PROVIDER=opencode
BUILDER_OPENCODE_COMMAND=opencode
BUILDER_PREVIEW_PROVIDER=local
BUILDER_PREVIEW_PORT=3100
BUILDER_START_PREVIEW=true
BUILDER_PREVIEW_COMMAND="npm run dev"
BUILDER_BROWSER_QA_MODE=http
BUILDER_SKIP_BROWSER_QA=false
```

For Vercel preview creation:

```bash
BUILDER_VERCEL_PREVIEWS=true
BUILDER_VERCEL_TOKEN=
BUILDER_VERCEL_PROJECT_ID=
BUILDER_VERCEL_TEAM_ID=
```

Publishing or changing a live asset must remain approval-gated. A founder should
see "Needs approval" before anything is made public or live.

## Gemini Setup

Gemini is optional and only for low-sensitive, redacted vision or screenshots.

```bash
GEMINI_API_KEY=
GEMINI_VISION_MODEL=gemini-3-flash
```

External embeddings are off by default. Only enable them for public or
low-sensitive text:

```bash
FOUNDEROS_ALLOW_EXTERNAL_EMBEDDINGS=true
```

## DeepSeek Setup

DeepSeek V4 Pro is optional and reserved for escalation or review after GLM
routes are unavailable or when a manual review/rescue adapter is explicitly
selected. It is not a normal Home chat, document, or builder fallback.

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_V4_PRO_MODEL=deepseek-v4-pro
```

Manual builder escalation:

```bash
BUILDER_PROVIDER=deepseek
DEEPSEEK_API_KEY=
```

Return to normal builder routing afterwards:

```bash
BUILDER_PROVIDER=opencode
```

## Deployment Steps

1. Confirm local checks pass:

   ```bash
   npm run test:acceptance
   ```

2. Push the current `main` branch.
3. Set the required environment variables on the hosting provider and Convex.
4. Deploy Convex functions:

   ```bash
   npx convex deploy
   ```

5. Deploy the Next.js app through the hosting provider.
6. Run `init.seedSwarm` once for an existing workspace if starter workflows or
   hidden worker roster records are missing. It is idempotent.
7. Open the deployed app, sign in, and confirm Home, Work, Library, Schedules,
   and Settings load without backend labels.

## Acceptance Walkthrough

1. Home chat: ask "Help me decide what to focus on this week." Expect a plain
   answer in Home. No Work item should be required.
2. Website: ask "Create a website for a neighborhood bakery." Expect the task
   to appear in Work, progress to be plain, and a private preview link to appear
   when the builder finishes. Open the preview.
3. Document: ask "Create a document for the launch plan." Expect Work to run the
   document worker and save a viewable Library item. Open it from Library.
4. Work: confirm items are grouped as Working, Ready to review, Needs approval,
   and Completed work. Preview links and saved Library outputs should be visible
   where available.
5. Approvals: request publish, send, spend, delete, or live-site changes. Expect
   "Needs approval" before any external action occurs.
6. Schedules: create a schedule, run it now, and confirm it queues a workflow
   run with history and a Library link after completion.
7. Library: upload or paste content, approve safe reusable context, and confirm
   restricted/private/draft material is not used as automatic document context.
8. Settings: use the OpenCode "Check this computer" action to verify local auth.

## Checks Not Completed By Automated Tests

- Real opencode authentication and paid GLM account availability.
- Real Convex and Clerk production environment values.
- Real Google Workspace, GitHub, and Vercel OAuth/app credentials.
- Real Clerk Playwright auth unless `E2E_CLERK_TEST_USER_EMAIL` and Clerk test
  credentials are set.
- Real Gemini API call with redacted low-sensitive vision input.
- Real DeepSeek escalation call with `DEEPSEEK_API_KEY`.
- Real browser opening of a generated builder preview on the founder's machine.
- Hosted deployment smoke test after environment variables are set.
