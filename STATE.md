# FounderOS State

This file is the working log for founder-facing capability status and agent to-dos. Keep it current when changing connectors, workers, approvals, or setup requirements.

## Current Goal

Make every visible connector work standalone before combining connectors into larger workflows. A connected service should either complete the promised action through the real provider or clearly say what is missing. It must not report success for a placeholder action.

## Live Capabilities

- Gmail: Google OAuth setup, read-only email context for chat/task context, draft preparation, and approved send through the Gmail API.
- Google Calendar: Google OAuth setup, read-only calendar context, scheduling suggestions, and approved event creation when the event has an exact date/time.
- Google Drive: Google OAuth setup and relevant file lookup for chat/task context; Docs and Sheets found through Drive include safe content previews when available.
- Google Docs: Google OAuth setup, document lookup through Drive, safe document preview reads for chat/task context, and approved document creation/update/export through Google when the user has granted the required scopes.
- Google Sheets: Google OAuth setup, spreadsheet lookup through Drive, safe spreadsheet preview reads for chat/task context, and approved spreadsheet creation/update/export through Google when the user has granted the required scopes.
- GitHub: GitHub App install, repository selection, provider-backed repository context import into Library, and approved issue or pull-request creation when the app credentials and repository permissions are configured.
- Vercel: Settings setup validates saved token/project values; builder preview work can use saved Settings credentials before falling back to worker environment values, and live/public publishing remains approval-gated.
- opencode: local command setup for opencode work when the local build environment is configured.
- Hidden model orchestration: GLM route policy for classification, business reasoning, planning, and opencode build work; free/Gemini routes are privacy-gated.

## Not Live Yet

- Stripe: not currently exposed as an active founder-facing connector. Any old finance-sync references are stale until a real Stripe connector is reintroduced.
- PostHog, Resend, Canva, Slack, Notion: not exposed as live standalone connectors.

## Agent To-Dos

- Add a real Google Drive/Docs/Sheets Library import path if full file contents should be saved permanently, not only used as read-only context previews.
- Keep Vercel preview/live publishing tests aligned with the Settings credential path and the approval boundary for live changes.
- Expand live staging Playwright acceptance beyond the current authenticated Settings smoke check once test provider resources are available.

## Manual Setup Blockers

- Google Workspace connectors require Google OAuth credentials in the environment: `GOOGLE_CONNECTOR_CLIENT_ID` and `GOOGLE_CONNECTOR_CLIENT_SECRET`, or the fallback Google sign-in client variables.
- Approved Gmail sends require the Google OAuth app to have Gmail send scope and the user to grant it.
- Approved calendar event creation requires Calendar write scope and an exact event date/time.
- GitHub repository context import, issue creation, and pull-request creation require a GitHub App installation, chosen repository, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and the app to have repository metadata read, contents read, issues write, and pull requests write access.
- Stripe is not currently active; no Stripe key is required for current connector acceptance.
- opencode through the local build engine requires opencode installed/authenticated locally and the builder worker running with the expected local command.
- Local runner acceptance should set `LOCAL_RUNNER_ID`, `LOCAL_RUNNER_REQUIRE_OPENCODE=true`, and normally `LOCAL_RUNNER_SKIP_OPENCODE_CHECK=false`.
- Default GLM routing uses the opencode subscription routes configured in opencode; it does not require a separate `ZAI_API_KEY`.
- opencode routing expects the working `zai-coding-plan/glm-4.7`, `zai-coding-plan/glm-5-turbo`, and `zai-coding-plan/glm-5.1` routes.
- Gemini requires `GEMINI_API_KEY` only for low-sensitive redacted vision work. DeepSeek V4 Pro requires `DEEPSEEK_API_KEY` only when optional escalation or verification is enabled.
- Background work requires `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL` plus `FOUNDEROS_WORKER_TOKEN` for the relevant worker process.
