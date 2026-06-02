# FounderOS State

This file is the working log for founder-facing capability status and agent to-dos. Keep it current when changing connectors, workers, approvals, or setup requirements.

## Current Goal

Make every visible connector work standalone before combining connectors into larger workflows. A connected service should either complete the promised action through the real provider or clearly say what is missing. It must not report success for a placeholder action.

## Live Capabilities

- Gmail: Google OAuth setup, read-only email context for chat/task context, draft preparation, and approved send through the Gmail API.
- Google Calendar: Google OAuth setup, read-only calendar context, scheduling suggestions, and approved event creation when the event has an exact date/time.
- Google Drive: Google OAuth setup and relevant file lookup for chat/task context; Docs and Sheets found through Drive include safe content previews when available.
- Google Docs: Google OAuth setup, document lookup through Drive, and safe document preview reads for chat/task context.
- Google Sheets: Google OAuth setup, spreadsheet lookup through Drive, and safe spreadsheet preview reads for chat/task context.
- GitHub: GitHub App install, repository selection, and provider-backed repository context import into Library when `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` are configured.
- Stripe: restricted read-only key setup and finance sync into Library/facts. Money-moving actions are blocked by policy.
- opencode: local command setup for opencode work when the local build environment is configured.
- Hidden model orchestration: GLM route policy for classification, business reasoning, planning, and opencode build work; free/Gemini routes are privacy-gated.

## Not Live Yet

- GitHub issue creation and pull-request creation: not live yet and explicitly blocked by connector action evaluation.
- Vercel connector card: Settings setup stores project details only. Builder preview publishing currently uses worker environment variables; Settings connector actions are explicitly not live yet.
- PostHog, Resend, Canva, Slack, Notion: not exposed as live standalone connectors.
- Google Drive/Docs/Sheets write/export actions: not live and explicitly blocked by connector action evaluation.

## Agent To-Dos

- Add approved GitHub issue and pull-request creation only when they call the GitHub provider end to end.
- Add a real Google Drive/Docs/Sheets Library import path if full file contents should be saved permanently, not only used as read-only context previews.
- Add a Settings-driven Vercel path or keep Vercel marked unavailable outside builder environment setup.
- Add integration tests around `executeConnectorAction` with mocked Google provider calls.
- Add end-to-end checks for: connect Google, ask chat for today's Gmail rundown, create email task, approve send, confirm Gmail provider id is saved.

## Manual Setup Blockers

- Google Workspace connectors require Google OAuth credentials in the environment: `GOOGLE_CONNECTOR_CLIENT_ID` and `GOOGLE_CONNECTOR_CLIENT_SECRET`, or the fallback Google sign-in client variables.
- Approved Gmail sends require the Google OAuth app to have Gmail send scope and the user to grant it.
- Approved calendar event creation requires Calendar write scope and an exact event date/time.
- GitHub repository context import requires a GitHub App installation, chosen repository, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and the app to have repository metadata and contents read access.
- Stripe sync requires `CONNECTOR_SECRET_ENCRYPTION_KEY` and a restricted Stripe key beginning with `rk_test_` or `rk_live_`.
- opencode through the local build engine requires opencode installed/authenticated locally and the builder worker running with the expected local command.
- Default GLM routing uses the opencode subscription routes configured in opencode; it does not require a separate `ZAI_API_KEY`.
- opencode routing expects the working `zai-coding-plan/glm-4.7`, `zai-coding-plan/glm-5-turbo`, and `zai-coding-plan/glm-5.1` routes.
- Gemini requires `GEMINI_API_KEY` only for low-sensitive redacted vision work. DeepSeek V4 Pro requires `DEEPSEEK_API_KEY` only when optional escalation or verification is enabled.
- Background work requires `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL` plus `FOUNDEROS_WORKER_TOKEN` for the relevant worker process.
