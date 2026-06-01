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
- AI reasoning and generation: `DEEPSEEK_API_KEY`; optional `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `DEEPSEEK_REASONING_MODEL`.
- Z.ai/GLM generation: `ZAI_API_KEY`.
- Embeddings and Gemini fallback: `GEMINI_API_KEY`; optional `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`.
- Connector credential encryption: `CONNECTOR_SECRET_ENCRYPTION_KEY`; optional `CONNECTOR_OAUTH_STATE_SECRET`.
- Google Workspace connector OAuth: `GOOGLE_CONNECTOR_CLIENT_ID`, `GOOGLE_CONNECTOR_CLIENT_SECRET`.
- GitHub App install flow and webhook ingestion: `GITHUB_APP_NAME`, `GITHUB_WEBHOOK_SECRET`; optional app variables `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`.
- Vercel private keys are entered in Settings and stored through the encrypted connector credential path.
- Preferred real product-building runs with OpenCode:
  - Install and sign in to OpenCode on the computer running FounderOS.
  - FounderOS uses `opencode` by default. In Settings, use **Check local setup** to confirm it is ready.
  - Advanced builder environment variables are still supported for hosted worker runs when needed: `BUILDER_PROVIDER=opencode`, `BUILDER_OPENCODE_MODEL`, `BUILDER_OPENCODE_AGENT`, and `BUILDER_OPENCODE_ATTACH_URL`.
- Real builder runs with cheaper chat-completions models when OpenCode is not used:
  - DeepSeek preset: `BUILDER_PROVIDER=deepseek` and `DEEPSEEK_API_KEY`.
  - Z.ai preset: `BUILDER_PROVIDER=zai` and `ZAI_API_KEY`.
  - OpenRouter preset: `BUILDER_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL`.
  - Any compatible endpoint: `BUILDER_PROVIDER=llm`, `BUILDER_LLM_API_KEY`, `BUILDER_LLM_CHAT_COMPLETIONS_URL`, and `BUILDER_LLM_MODEL`.
- Real builder runs with the OpenAI Codex SDK: `BUILDER_PROVIDER=codex`, `BUILDER_USE_CODEX=true`, and `OPENAI_API_KEY`.
- Vercel preview publishing: `BUILDER_VERCEL_PREVIEWS=true` plus `VERCEL_TOKEN` or `BUILDER_VERCEL_TOKEN`, and `VERCEL_PROJECT_ID` or `BUILDER_VERCEL_PROJECT_ID`. Add `VERCEL_TEAM_ID` or `BUILDER_VERCEL_TEAM_ID` for team-scoped projects.

## Worker defaults

The document, design, communications, generic, and builder workers read
`CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL` plus `FOUNDEROS_WORKER_TOKEN`. Poll
intervals, lease times, worker IDs, preview commands, builder isolation, and
Vercel settings are optional and documented in `.env.example`.

## Local run order

1. Run `npm install` if dependencies are missing.
2. Start Convex with `npx convex dev` and keep it running.
3. In another terminal, run `npm run dev`.
4. For real product-building work, prefer OpenCode:
   install and sign in to OpenCode, then use **Check local setup** in Settings.
   Worker-only runs can still use `BUILDER_PROVIDER=opencode`, then run `npm run builder`.
   For direct chat-completions fallback, use `BUILDER_PROVIDER=deepseek`,
   `BUILDER_PROVIDER=zai`, or `BUILDER_PROVIDER=openrouter` with the matching API key.
5. Start only the other workers you need, for example
   `npm run worker:documents:once`.

The builder always works in an isolated workspace unless `BUILDER_ISOLATION_MODE=workspace`
is explicitly set. It saves review versions to Library, runs configured checks,
attempts a repair pass when checks fail, prepares private previews, and requires
approval before live publishing through Vercel.

Generate `FOUNDEROS_WORKER_TOKEN` as a long random value before using a hosted
workspace.
