# Environment

Copy `.env.example` to `.env.local` for the Next app and local workers. Convex
also needs the server-side variables below set on the active deployment with
`npx convex env set NAME value` before hosted actions, cron jobs, auth callbacks,
or AI calls can use them.

## Required for a local authenticated app

- `CONVEX_DEPLOYMENT`: Local Convex deployment name from `npx convex dev`.
- `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL used by Next and workers. Workers may use `CONVEX_URL` instead.
- `NEXT_PUBLIC_CONVEX_SITE_URL`: Convex HTTP actions site URL used by Better Auth routes.
- `NEXT_PUBLIC_SITE_URL`: Browser-facing app URL, normally `http://localhost:3000`.
- `BETTER_AUTH_SECRET`: Long random value for Better Auth sessions.
- `BETTER_AUTH_BASE_URL`: Auth callback base URL, normally `http://localhost:3000`.
- `FOUNDEROS_WORKER_TOKEN`: Long random shared secret for local workers that call worker-only mutations.

## Optional accounts by feature

- Google sign-in: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- AI reasoning and generation: `DEEPSEEK_API_KEY`; optional `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `DEEPSEEK_REASONING_MODEL`.
- Z.ai/GLM generation: `ZAI_API_KEY`.
- Embeddings and Gemini fallback: `GEMINI_API_KEY`; optional `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`.
- GitHub webhook ingestion: `GITHUB_WEBHOOK_SECRET`.
- Stripe read-only finance sync: `STRIPE_READ_ONLY_KEY`.
- Real builder runs with cheaper chat-completions models:
  - DeepSeek preset: `BUILDER_PROVIDER=deepseek` and `DEEPSEEK_API_KEY`.
  - Z.ai preset: `BUILDER_PROVIDER=zai` and `ZAI_API_KEY`.
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
4. For real product-building work with a cheaper model, set
   `BUILDER_PROVIDER=deepseek` and `DEEPSEEK_API_KEY` in `.env.local`, then run
   `npm run builder`. For Z.ai, use `BUILDER_PROVIDER=zai` and `ZAI_API_KEY`.
5. Start only the other workers you need, for example
   `npm run worker:documents:once`.

Generate `BETTER_AUTH_SECRET` and `FOUNDEROS_WORKER_TOKEN` as long random values
before using a hosted workspace.
