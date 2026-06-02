# Hidden Builder Worker

This local worker handles queued preview-building work for FounderOS. It is intentionally not part of the founder-facing product surface.

Current behavior:

- finds queued `code_preview` work runs
- marks them in progress
- writes plain-language progress updates
- plans the opencode workflow before building
- uses a flexible hidden builder-agent adapter
- uses opencode subscription routing by default for build, code, and debug work
- keeps legacy/manual chat-completions adapters for DeepSeek, Z.ai, OpenRouter, and custom compatible endpoints
- keeps Codex available as an optional adapter
- runs the builder in an isolated branch/workspace or safe copied directory
- passes the builder a structured task spec
- captures changed files, configured checks, summary, and preview status
- attempts a repair pass when checks fail
- starts or checks a local review preview and records browser QA metadata
- queues approval before any external preview deployment or live publishing step
- stores the review result as a Website or Tool Library item
- records deployment history on the saved item
- can fall back to a simulated review result when explicitly configured for local development
- marks the run ready for review
- asks for approval before any live publish or live-change step

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
- `BUILDER_PROVIDER`: `opencode`, `simulated`, `deepseek`, `zai`, `openrouter`, `llm`, or `codex`. Defaults to `opencode`.
- `BUILDER_AGENT`: optional alias for `BUILDER_PROVIDER`.
- `BUILDER_AGENT_TIMEOUT_MS`: timeout for real builder-agent calls. Defaults to `600000`.
- `BUILDER_REPAIR_ATTEMPTS`: number of repair passes after failed checks. Defaults to `1`.
- opencode default adapter:
  - `BUILDER_PROVIDER=opencode`
  - `BUILDER_OPENCODE_COMMAND`: defaults to `opencode`
  - `BUILDER_OPENCODE_MODEL`: optional pinned model in opencode `provider/model` format. If omitted, hidden routing chooses `zai-coding-plan/glm-5.1` for coding/build work.
  - `BUILDER_OPENCODE_AGENT`: optional locked-down opencode agent name
  - `BUILDER_OPENCODE_ATTACH_URL`: optional headless opencode server URL
- Hidden opencode route defaults:
  - `FOUNDEROS_OPENCODE_CLASSIFICATION_MODEL`: defaults to `zai-coding-plan/glm-4.5-air`
  - `FOUNDEROS_OPENCODE_BUSINESS_MODEL`: defaults to `zai-coding-plan/glm-4.7`
  - `FOUNDEROS_OPENCODE_PLANNING_MODEL`: defaults to `zai-coding-plan/glm-5-turbo`
  - `FOUNDEROS_OPENCODE_CODING_MODEL`: defaults to `zai-coding-plan/glm-5.1`
  - Free opencode models are allowed only for redacted public drafts and require a GLM verifier route. Private build work is automatically moved to the paid GLM route.
- Optional manual chat-completions adapters:
  - `BUILDER_PROVIDER=deepseek` with `DEEPSEEK_API_KEY`; use only for manual escalation/review or hard rescue work.
  - `BUILDER_PROVIDER=zai` with `FOUNDEROS_ENABLE_DIRECT_ZAI=true` and `ZAI_API_KEY`; this is a direct-billing compatibility path, not normal GLM/OpenCode routing.
  - `BUILDER_PROVIDER=openrouter` with `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`
  - `BUILDER_PROVIDER=llm` with `BUILDER_LLM_API_KEY`, `BUILDER_LLM_CHAT_COMPLETIONS_URL`, and `BUILDER_LLM_MODEL`
- Codex optional adapter:
  - `BUILDER_PROVIDER=codex`
  - `OPENAI_API_KEY`
- `BUILDER_WORKSPACE_DIR`: optional project workspace for the builder. Defaults to the current directory.
- `BUILDER_ISOLATION_MODE`: `auto`, `worktree`, `copy`, or `workspace`. Defaults to `auto`.
- `BUILDER_RUNS_DIR`: optional directory for isolated build workspaces. Defaults to a system temp directory.
- `BUILDER_BRANCH_PREFIX`: branch prefix for isolated git worktrees. Defaults to `codex/founderos-build`.
- `BUILDER_CLEAN_WORKSPACE_AFTER_RUN`: set to `true` to remove isolated workspaces after capture.
- `BUILDER_CODEX_MODEL`: optional Codex model override.
- `BUILDER_CODEX_REASONING_EFFORT`: optional reasoning effort. Defaults to `medium`.
- `BUILDER_TEST_COMMANDS`: optional JSON array or newline/semicolon-separated list of checks. Defaults to `npm test` when available.
- `BUILDER_INSTALL_COMMANDS`: optional JSON array or newline/semicolon-separated install command list. Defaults to `npm ci --ignore-scripts` or `npm install --ignore-scripts` only when no `node_modules` is available.
- `BUILDER_SKIP_INSTALL`: set to `true` to skip install preparation.
- `BUILDER_INSTALL_TIMEOUT_MS`: per-install timeout. Defaults to `180000`.
- Default checks run configured commands, otherwise available `npm test`, `npm run lint`, and `npm run build`.
- `BUILDER_SKIP_TESTS`: set to `true` to skip checks.
- `BUILDER_TEST_TIMEOUT_MS`: per-check timeout. Defaults to `120000`.
- `BUILDER_PREVIEW_URL`: explicit local preview URL to check. When unset, the worker starts an isolated preview on an available local port beginning at `BUILDER_PREVIEW_PORT`.
- `BUILDER_PREVIEW_PORT`: first local preview port to try when starting a preview. Defaults to `3100`.
- `BUILDER_PREVIEW_PROVIDER`: internal preview provider label. Defaults to `local`.
- `BUILDER_START_PREVIEW`: set to `false` to prevent the worker from starting a local preview. Defaults to `true`.
- `BUILDER_PREVIEW_COMMAND`: command used when `BUILDER_START_PREVIEW=true`. Defaults to `npm run dev`.
- `BUILDER_PREVIEW_TIMEOUT_MS`: how long to wait for a local preview. Defaults to `30000`.
- `BUILDER_BROWSER_QA_MODE`: `http` for lightweight preview QA, or leave unset to use Playwright when installed and fall back to HTTP QA.
- `BUILDER_SKIP_BROWSER_QA`: set to `true` to skip preview QA.
- `BUILDER_POLL_INTERVAL_MS`: optional polling interval. Defaults to `5000`.
- `BUILDER_VERCEL_PREVIEWS`: set to `true` to create shareable Vercel review links for Website and Tool outputs.
- `VERCEL_TOKEN` or `BUILDER_VERCEL_TOKEN`: Vercel access token used by the hidden connector.
- `VERCEL_PROJECT_ID` or `BUILDER_VERCEL_PROJECT_ID`: Vercel project used for preview deployments and approved live publishing.
- `VERCEL_PROJECT_NAME` or `BUILDER_VERCEL_PROJECT_NAME`: optional project name sent with deployments.
- `VERCEL_TEAM_ID` or `BUILDER_VERCEL_TEAM_ID`: optional team scope.
- `VERCEL_PRODUCTION_DOMAIN` or `BUILDER_VERCEL_PRODUCTION_DOMAIN`: optional domain used only after the founder approves publishing.
- `VERCEL_ROOT_DIRECTORY`, `VERCEL_FRAMEWORK`, `VERCEL_BUILD_COMMAND`, `VERCEL_INSTALL_COMMAND`, and `VERCEL_OUTPUT_DIRECTORY`: optional internal project settings for Vercel deployments.

The worker must only write plain-language updates to `workRunUpdates`. Internal logs, source metadata, deployment metadata, changed file metadata, command counts, usage, and thread ids stay in internal run notes. Local previews can run for review. External preview deployment and live publishing must only run after the approval queue resumes the work.
