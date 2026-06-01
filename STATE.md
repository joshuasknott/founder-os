# FounderOS State

This file is the working log for founder-facing capability status and agent to-dos. Keep it current when changing connectors, workers, approvals, or setup requirements.

## Current Goal

Make every visible connector work standalone before combining connectors into larger workflows. A connected service should either complete the promised action through the real provider or clearly say what is missing. It must not report success for a placeholder action.

## Live Capabilities

- Gmail: Google OAuth setup, read-only email context for chat/task context, draft preparation, and approved send through the Gmail API.
- Google Calendar: Google OAuth setup, read-only calendar context, scheduling suggestions, and approved event creation when the event has an exact date/time.
- Google Drive: Google OAuth setup and relevant file lookup for chat/task context; Google Docs and Sheets found through Drive include safe content previews when available.
- Google Docs: Google OAuth setup and safe document preview reads for chat/task context.
- Google Sheets: Google OAuth setup and safe spreadsheet preview reads for chat/task context.
- Stripe: restricted read-only key setup and finance sync into Library/facts. Money-moving actions are blocked by policy.
- OpenCode: local command setup for product-building work when the local OpenCode environment is configured.

## Not Live Yet

- GitHub: connection surface exists, but repository import, issue creation, and pull-request creation are not wired to live provider actions yet.
- Vercel connector card: Settings setup is not the active live path. Builder preview publishing currently uses worker environment variables.
- PostHog, Resend, Canva, Slack, Notion: not exposed as live standalone connectors.
- Google Drive/Docs/Sheets write/export actions: not live.

## Agent To-Dos

- Add provider-backed GitHub repository import before making GitHub available in Settings.
- Add a real Google Drive/Docs/Sheets Library import path if full file contents should be saved permanently, not only used as read-only context previews.
- Add a Settings-driven Vercel path or keep Vercel marked unavailable outside builder environment setup.
- Add integration tests around `executeConnectorAction` with mocked Google provider calls.
- Add end-to-end checks for: connect Google, ask chat for today's Gmail rundown, create email task, approve send, confirm Gmail provider id is saved.

## Manual Setup Blockers

- Google Workspace connectors require Google OAuth credentials in the environment: `GOOGLE_CONNECTOR_CLIENT_ID` and `GOOGLE_CONNECTOR_CLIENT_SECRET`, or the fallback Google sign-in client variables.
- Approved Gmail sends require the Google OAuth app to have Gmail send scope and the user to grant it.
- Approved calendar event creation requires Calendar write scope and an exact event date/time.
- Stripe sync requires `CONNECTOR_SECRET_ENCRYPTION_KEY` and a restricted Stripe key beginning with `rk_test_` or `rk_live_`.
- OpenCode work requires OpenCode installed/authenticated locally and the builder worker running with the expected local command.
- Background work requires `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL` plus `FOUNDEROS_WORKER_TOKEN` for the relevant worker process.
