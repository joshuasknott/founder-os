# Hidden Builder Worker

This local worker handles queued preview-building work for FounderOS. It is intentionally not part of the founder-facing product surface.

Current behavior:

- finds queued `code_preview` work runs
- marks them in progress
- writes plain-language progress updates
- plans the opencode workflow before building
- uses a flexible hidden builder-agent adapter
- prefers opencode for real model-flexible builds when configured
- supports chat-completions adapters for DeepSeek, Z.ai, OpenRouter, and custom compatible endpoints
- keeps Codex available as an optional adapter
- runs the builder in an isolated branch/workspace or safe copied directory
- passes the builder a structured task spec
- captures changed files, configured checks, summary, and preview status
- attempts a repair pass when checks fail
- can create a shareable Vercel preview when the internal connector is configured
- stores the review result as a Website or Tool Library item
- records deployment history on the saved item
- falls back to a simulated review result for local development
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
- `BUILDER_PROVIDER`: `simulated`, `opencode`, `deepseek`, `zai`, `openrouter`, `llm`, or `codex`. Defaults to `simulated`.
- `BUILDER_AGENT`: optional alias for `BUILDER_PROVIDER`.
- `BUILDER_AGENT_TIMEOUT_MS`: timeout for real builder-agent calls. Defaults to `600000`.
- `BUILDER_REPAIR_ATTEMPTS`: number of repair passes after failed checks. Defaults to `1`.
- opencode preferred real adapter:
  - `BUILDER_PROVIDER=opencode`
  - `BUILDER_OPENCODE_COMMAND`: defaults to `opencode`
  - `BUILDER_OPENCODE_MODEL`: optional pinned model in opencode `provider/model` format. If omitted, hidden routing chooses `zai-coding-plan/glm-5.1` for coding/build work.
  - `BUILDER_OPENCODE_AGENT`: optional locked-down opencode agent name
  - `BUILDER_OPENCODE_ATTACH_URL`: optional headless opencode server URL
- Hidden opencode route defaults:
  - `FOUNDEROS_OPENCODE_BUSINESS_MODEL`: defaults to `zai-coding-plan/glm-4.7`
  - `FOUNDEROS_OPENCODE_PLANNING_MODEL`: defaults to `zai-coding-plan/glm-5-turbo`
  - `FOUNDEROS_OPENCODE_CODING_MODEL`: defaults to `zai-coding-plan/glm-5.1`
  - Free opencode models are allowed only for redacted public drafts and require a GLM verifier route. Private build work is automatically moved to the paid GLM route.
- Chat-completions adapters:
  - `BUILDER_PROVIDER=deepseek` with `DEEPSEEK_API_KEY`
  - `BUILDER_PROVIDER=zai` with `ZAI_API_KEY`
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
- `BUILDER_SKIP_TESTS`: set to `true` to skip checks.
- `BUILDER_TEST_TIMEOUT_MS`: per-check timeout. Defaults to `120000`.
- `BUILDER_PREVIEW_URL`: local preview URL to check. Defaults to `http://localhost:3000`.
- `BUILDER_PREVIEW_PROVIDER`: internal preview provider label. Defaults to `local`.
- `BUILDER_START_PREVIEW`: set to `true` to let the worker start a local preview if one is not already running.
- `BUILDER_PREVIEW_COMMAND`: command used when `BUILDER_START_PREVIEW=true`. Defaults to `npm run dev`.
- `BUILDER_PREVIEW_TIMEOUT_MS`: how long to wait for a local preview. Defaults to `30000`.
- `BUILDER_POLL_INTERVAL_MS`: optional polling interval. Defaults to `5000`.
- `BUILDER_VERCEL_PREVIEWS`: set to `true` to create shareable Vercel review links for Website and Tool outputs.
- `VERCEL_TOKEN` or `BUILDER_VERCEL_TOKEN`: Vercel access token used by the hidden connector.
- `VERCEL_PROJECT_ID` or `BUILDER_VERCEL_PROJECT_ID`: Vercel project used for preview deployments and approved live publishing.
- `VERCEL_PROJECT_NAME` or `BUILDER_VERCEL_PROJECT_NAME`: optional project name sent with deployments.
- `VERCEL_TEAM_ID` or `BUILDER_VERCEL_TEAM_ID`: optional team scope.
- `VERCEL_PRODUCTION_DOMAIN` or `BUILDER_VERCEL_PRODUCTION_DOMAIN`: optional domain used only after the founder approves publishing.
- `VERCEL_ROOT_DIRECTORY`, `VERCEL_FRAMEWORK`, `VERCEL_BUILD_COMMAND`, `VERCEL_INSTALL_COMMAND`, and `VERCEL_OUTPUT_DIRECTORY`: optional internal project settings for Vercel deployments.

The worker must only write plain-language updates to `workRunUpdates`. Internal logs, source metadata, deployment metadata, changed file metadata, command counts, usage, and thread ids stay in internal run notes. Shareable preview deployment can run without approval when configured. Live publishing must only run after the approval queue resumes the work.
