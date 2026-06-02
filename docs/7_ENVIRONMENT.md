# Environment

Copy `.env.example` to `.env.local` for the Next app and local workers. Convex
also needs the server-side variables below set on the active deployment with
`npx convex env set NAME value` before hosted actions, cron jobs, auth callbacks,
or AI calls can use them.

## Required for a local authenticated app

- `CONVEX_DEPLOYMENT`: Local Convex deployment name from `npx convex dev`.
- `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL used by Next and workers. Workers may use `CONVEX_URL` instead.
- `NEXT_PUBLIC_SITE_URL`: Browser-facing app URL, normally `http://localhost:3000`.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk publishable key for the browser app.
- `CLERK_SECRET_KEY`: Clerk secret key used by Next.js route handlers and proxy auth checks.
- `CLERK_JWT_ISSUER_DOMAIN`: Clerk JWT issuer domain configured in Convex, for example `https://your-app.clerk.accounts.dev`.
- `FOUNDEROS_WORKER_TOKEN`: Long random shared secret for local workers that call worker-only mutations.
- `LOCAL_RUNNER_ID`: Stable name for the computer running hidden local work, for example `founder-laptop`.

## Clerk and Convex setup

1. Create or select a Clerk application and enable the sign-in methods FounderOS should offer, including Google if needed.
2. In Clerk, create a JWT template named `convex`. The template name must match the Convex auth `applicationID`.
3. Copy the Clerk JWT issuer domain into `.env.local` as `CLERK_JWT_ISSUER_DOMAIN`.
4. Set the same issuer domain on the active Convex deployment:
   `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev`
5. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in the Next.js runtime environment.
6. Run `npx convex codegen` or `npx convex dev` after the Convex env value is set, then sign in and confirm workspace data loads through `ctx.auth.getUserIdentity()`.

## Optional accounts by feature

- Google sign-in: enable Google as a social connection in the Clerk dashboard.
- Hidden AI orchestration through opencode: local opencode authentication supplies the paid GLM routes. FounderOS does not require a separate `ZAI_API_KEY` for the default path.
- Local opencode route defaults: `FOUNDEROS_OPENCODE_CLASSIFICATION_MODEL=zai-coding-plan/glm-4.5-air`, `FOUNDEROS_OPENCODE_BUSINESS_MODEL=zai-coding-plan/glm-4.7`, `FOUNDEROS_OPENCODE_PLANNING_MODEL=zai-coding-plan/glm-5-turbo`, and `FOUNDEROS_OPENCODE_CODING_MODEL=zai-coding-plan/glm-5.1`.
- Gemini vision: `GEMINI_API_KEY` and optional `GEMINI_VISION_MODEL=gemini-3-flash`. This path is only for low-sensitive, redacted image or screenshot understanding.
- Optional DeepSeek escalation/review: `DEEPSEEK_API_KEY`, optional `DEEPSEEK_BASE_URL`, and `DEEPSEEK_V4_PRO_MODEL`. DeepSeek is reserved for escalation/review and is not a routine fallback.
- Optional external embeddings: `GEMINI_API_KEY` plus `FOUNDEROS_ALLOW_EXTERNAL_EMBEDDINGS=true`. The default is local deterministic embeddings unless this is explicitly enabled for public or low-sensitive text.
- Connector credential encryption: `CONNECTOR_SECRET_ENCRYPTION_KEY`; optional `CONNECTOR_OAUTH_STATE_SECRET`.
- Google Workspace connector OAuth: `GOOGLE_CONNECTOR_CLIENT_ID`, `GOOGLE_CONNECTOR_CLIENT_SECRET`.
- GitHub App install flow and webhook ingestion: `GITHUB_APP_NAME`, `GITHUB_WEBHOOK_SECRET`; optional app variables `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`.
- Vercel private keys are entered in Settings and stored through the encrypted connector credential path.
- Preferred real opencode runs through the local build engine:
  - Install and sign in to opencode on the computer running FounderOS.
  - FounderOS uses `opencode` by default for local build work when `BUILDER_PROVIDER=opencode`.
  - `npm run local-runner` validates the local opencode command and auth before advertising coding capability when `LOCAL_RUNNER_REQUIRE_OPENCODE=true`.
  - In Settings, use **Check this computer** to confirm opencode is ready for chat-side local checks.
  - Advanced builder environment variables are still supported for hosted worker runs when needed: `BUILDER_PROVIDER=opencode`, `BUILDER_OPENCODE_MODEL`, `BUILDER_OPENCODE_AGENT`, and `BUILDER_OPENCODE_ATTACH_URL`. If no model is pinned, coding/build work uses `zai-coding-plan/glm-5.1`.
- Direct chat-completions builder adapters are optional legacy/manual paths when opencode is not used:
  - DeepSeek preset: `BUILDER_PROVIDER=deepseek` and `DEEPSEEK_API_KEY`. Use this only for manual escalation/review or rescue work, not routine chat or default builds.
  - Z.ai preset: `BUILDER_PROVIDER=zai`, `FOUNDEROS_ENABLE_DIRECT_ZAI=true`, and `ZAI_API_KEY`. This is a manual direct-billing compatibility path, not normal GLM/OpenCode setup.
  - OpenRouter preset: `BUILDER_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL`.
  - Any compatible endpoint: `BUILDER_PROVIDER=llm`, `BUILDER_LLM_API_KEY`, `BUILDER_LLM_CHAT_COMPLETIONS_URL`, and `BUILDER_LLM_MODEL`.
- Real builder runs with the OpenAI Codex SDK: `BUILDER_PROVIDER=codex`, `BUILDER_USE_CODEX=true`, and `OPENAI_API_KEY`.
- Vercel preview publishing: `BUILDER_VERCEL_PREVIEWS=true` plus `VERCEL_TOKEN` or `BUILDER_VERCEL_TOKEN`, and `VERCEL_PROJECT_ID` or `BUILDER_VERCEL_PROJECT_ID`. Add `VERCEL_TEAM_ID` or `BUILDER_VERCEL_TEAM_ID` for team-scoped projects.

## Local runner defaults

The local runner is the preferred hidden execution process. It registers in the
`localRunners` table, renews a heartbeat, leases matching `workRuns`, delegates
to the existing builder/document/design/communications/generic handlers, and
writes plain progress/results back through the same Work and Library paths.

Common settings:

- `LOCAL_RUNNER_ID`: stable machine id. Defaults to `local:<process id>`.
- `LOCAL_RUNNER_CAPABILITIES`: comma-separated hidden capabilities. Defaults to `coding,document,design,communication,schedule,data,generic`.
- `LOCAL_RUNNER_OUTPUT_CONTRACTS`: defaults to `plain_text,structured_json,library_item,code_changes,public_draft`.
- `LOCAL_RUNNER_MAX_SENSITIVITY`: defaults to `restricted`.
- `LOCAL_RUNNER_APPROVAL_CAPABILITIES`: sensitive actions this runner can prepare or resume.
- `LOCAL_RUNNER_REQUIRE_OPENCODE=true`: fail startup if opencode is not installed and authenticated.
- `LOCAL_RUNNER_SKIP_OPENCODE_CHECK=true`: skip the startup check only for development or simulated runs.

Founder-facing UI does not expose local runner records, capabilities, providers,
models, routing, leases, logs, or tool calls. Work only projects the plain
statuses `queued`, `working`, `needs review`, `needs approval`, `done`, and
`failed`.

## Worker defaults

The document, design, communications, generic, and builder workers read
`CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL` plus `FOUNDEROS_WORKER_TOKEN`. Poll
intervals, lease times, worker IDs, preview commands, builder isolation, and
Vercel settings are optional and documented in `.env.example`.

## Local run order

1. Run `npm install` if dependencies are missing.
2. Start Convex with `npx convex dev` and keep it running.
3. In another terminal, run `npm run dev`.
4. For real opencode work, install and sign in to opencode on this computer.
5. Set `BUILDER_PROVIDER=opencode`, `LOCAL_RUNNER_REQUIRE_OPENCODE=true`, and a stable `LOCAL_RUNNER_ID`.
6. Start the local runner with `npm run local-runner`.
7. Legacy worker-only runs remain available when needed, for example `npm run builder` or `npm run worker:documents:once`.

Direct chat-completions builder presets are manual compatibility paths only; do
not use them as routine fallback for normal chat or work.

The builder always works in an isolated workspace unless `BUILDER_ISOLATION_MODE=workspace`
is explicitly set. It saves review versions to Library, runs configured checks,
attempts a repair pass when checks fail, prepares private previews, and requires
approval before live publishing through Vercel.

Generate `FOUNDEROS_WORKER_TOKEN` as a long random value before using a hosted
workspace.
