# State of the Union: Codebase Audit
**Date:** March 15, 2026
**Role:** Lead System Architect

This document serves as a zero-hallucination, precise snapshot of the FounderOS project.

---

## 1. Frontend UI Audit
The frontend has established a cohesive "Executive Minimalism" aesthetic with advanced, deeply interactive components. 

### Core Pages & Components Visualized:
- **`app/page.tsx` (Boardroom):** The primary workspace. Implements the complex floating dock for directives, Mode/Agent/Blueprint selector dropdowns, and an empty state view.
- **`app/intelligence/page.tsx`:** A highly detailed 3-tab hub (Knowledge, Blueprints, History). Includes simulated folder navigation, file preview overlays, and an interaction layer for creating mock blueprints or files.
- **`app/team/page.tsx`:** Displays the roster of AI agents (Orion, Atlas, Cipher, Nova, Sentinel) with status indicators. Includes a comprehensive "HR File Modal" for modifying agent system prompts.
- **`components/layout/Rightnav.tsx`:** Features the Inbox/Logs split view. Contains the **Review Modal** representing complex "L3 Gate" approvals, featuring a split-pane JSON spec editor and an agent iteration chat interface.
- **`components/auth/LoginCard.tsx`:** A minimalist, hardcoded login form utilizing the BetterAuth client.

---

## 2. Mock Data Mapping
Currently, the application relies heavily on local React state (`useState`) and hardcoded arrays to simulate database interactions. 

### Files Acting as Database Placeholders:
- **`app/page.tsx`**: `[attachments]` array.
- **`app/intelligence/page.tsx`**: 
  - `folders` array ("Marketing", "Engineering", etc.)
  - `files` dictionary mapping folders to mock document arrays.
  - `blueprints` array containing hardcoded workflow templates.
  - `history` array containing mock audit logs and JSON output artifacts.
- **`app/team/page.tsx`**: `AGENTS` array containing core identities, statuses, and fallback system instructions.
- **`components/layout/Rightnav.tsx`**: `mockApprovals` (simulating pending JSON payloads) and `mockLogs` arrays.

---

## 3. Backend & Auth Verification
**Status: PARTIALLY CONFIGURED (Scaffolded but Disconnected)**

There is no hallucination: a robust backend is *partially scaffolded*, but it is not currently driving the frontend UI or enforcing standard security protocols.

- **Convex (Database):** The `convex/` directory exists. It contains initialization files (`auth.config.ts`, `auth.ts`, `convex.config.ts`). However, **no data schema or mutations** are defined yet to replace the mocked state.
- **BetterAuth (Identity):** Heavy packages are installed (`better-auth`, `@convex-dev/better-auth`). The client initializer (`lib/auth-client.ts`) and the server initialization (`convex/auth.ts`) are present. The UI form `LoginCard.tsx` calls `authClient.signIn.email`.
- **Missing Elements:** There is no Next.js `middleware.ts` to protect routes, and the `ConvexClientProvider` is not fully wrapped around the mocked pages to hydrate them with real data.

---

## 4. The Action Plan
Based on this exact snapshot, here are the immediate next 3 steps required to move from a visual prototype to a functional, data-driven OS:

1. **Draft `docs/3_BACKEND_SCHEMA.md`:** Map the existing mock data arrays (Agents, Blueprints, Intelligence Files, Approvals) into concrete Convex table schemas.
2. **Draft `docs/4_AGENT_PROTOCOLS.md`:** Define how the agentic layer will interact with both the Convex instance (read/write access) and BetterAuth sessions.
3. **Execute "The Great Wiring":** Replace the hardcoded `useState` arrays in `app/page.tsx`, `app/team/page.tsx`, and `app/intelligence/page.tsx` with live `useQuery` and `useMutation` hooks attached to the Convex backend, and enforce route protection via middleware.
