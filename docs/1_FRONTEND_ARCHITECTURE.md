# FounderOS Frontend Architecture

## Overview

The FounderOS frontend is built as a single-page, rich-client application using Next.js (App Router). It is designed as an "Executive Workspace," hiding complex multi-agent orchestration behind a highly premium, intuitive, and deterministic interface.

The application strictly adheres to the **"Executive Minimalism"** design system.

---

## 1. Design System: Executive Minimalism

The UI is stripped of unnecessary gradients, drop shadows, and primary colors (no blue/purple SaaS aesthetics). It relies entirely on layout, high-contrast typography, and sharp geometry.

### Core Principles

- **Palette**: White-dominant. Backgrounds are strictly `bg-white` or `bg-zinc-50`. All contrast is achieved through pure black (`text-black`, `bg-black`, `border-black`) and zinc grays (e.g., `text-zinc-500`, `border-zinc-200`).
- **Geometry**: Sharp and architectural. We use `rounded-none` or `rounded-sm`. Never use heavy, bubbly rounded corners (e.g., no `rounded-2xl` or `rounded-full` for standard containers, except carefully isolated components like floating docks).
- **Typography**:
  - **Standard UI & Prose**: Inter (or Geist). Clean, legible, and professional.
  - **Telemetry & Artifacts**: JetBrains Mono. Used exclusively for code blocks, JSON payloads, agent logs, and system states.

---

## 2. The 3-Pane App Shell

The application utilizes a fixed-height (`h-screen`), flex-row layout implemented directly in `app/layout.tsx`. All scrolling happens _within_ the individual panes, not the `<body>`.

### Pane 1: Leftnav (Navigation & Context)

- **Dimensions**: Fixed width (`w-64`), bordered on the right (`border-r border-zinc-200`).
- **Header**: High-contrast FounderOS branding (logo + bold text).
  - **Global Context Switcher**: A headless dropdown at the very top left (above the routing zones) used to switch between isolated Workspaces (e.g., "FounderOS Meta" vs "Memvella").
- **Zones**:
  - **Zone 1 (Top)**: Primary routing (Boardroom, Intelligence, Team, Settings). Active states use `bg-zinc-100`, `font-semibold`, and a solid black left-border (`border-l-4 border-black`).
  - **Zone 2 (Middle)**: "Recent Sessions" feed. A scrolling list of active or past chat/task states.
  - **Zone 3 (Bottom)**: Settings/Profile access.

### Pane 2: Center Stage (The Active Workspace)

- **Dimensions**: Fluid width (`flex-1`), independent vertical scrolling (`overflow-y-auto`).
- **Behavior**: This pane hydrates dynamically based on the current Next.js route (`app/page.tsx`, `app/intelligence/page.tsx`, etc.).

### Pane 3: Rightnav (Operations Drawer)

- **Dimensions**: Fixed width (`w-80`), bordered on the left (`border-l border-zinc-200`).
- **Core Functionality**: The persistent control center for monitoring agent activity and approving actions.
- **Tabs**:
  - **Inbox**: Displays `ApprovalCard` components representing pending Level 2/3 tasks that require human authorization.
  - **Logs**: A terminal-style scrolling feed (`font-mono text-zinc-600`) of real-time system events and agent telemetry.

---

## 3. Core Pages & Components

### The Boardroom (`app/page.tsx`)

The primary interface for issuing directives. It is designed around a single, powerful input mechanism to avoid UI fragmentation.

- **Floating Input Dock**: A highly polished, Gemini-style floating dock at the bottom of the screen. It features an auto-expanding borderless textarea.
- **Mode Toggle**: Users can switch between "Chat" (brainstorming, no system execution) and "Task" (delegating executable workflows). A dynamic status banner under the central greeting indicates the active mode.
- **Universal Selection Pattern**:
  - Reusable, searchable modals (`max-w-2xl` overlays) for browsing the full Agent Roster and available Blueprints (SOPs).
  - Dropdowns on the dock offer quick-select defaults or trigger the deep-dive modals via "Browse Agents" or "Browse Blueprints".

### Intelligence Hub (`app/intelligence/page.tsx`)

The digital brain and repository for all system knowledge and past executions.

- **Knowledge Tab**: A stateful file explorer structure. Features grid lists of Folders and Files. Clicking a file opens a full-screen, typography-rich **Document Viewer** overlay (markdown/prose format).
- **Blueprints Tab**: A grid of operational SOPs (Standard Operating Procedures) used by agents.
- **History Tab**: A tabular ledger of all executed tasks. Clicking a row opens an **In-Depth Artifact Modal** to review exactly what the agent did, complete with time, agent identity, and the raw code/output payload.
- **Codebase Map Tab**: A visual explorer showing the extracted skeleton (file paths and exported functions) of connected GitHub repositories, allowing the user to see what context the agents have access to.
- **Universal Actions**: Every item utilizes a normalized `⋮` context menu for Edit/Download/Delete functions.

### Corporate Settings (`app/settings/page.tsx`)

A dense, form-heavy interface for system governance.

- **Human Workspace Members**: A dedicated table and invite interface for managing human collaborators and their BetterAuth RBAC roles (Owner/Contributor), parallel to the Agent Team roster.
- **Cost Controls**: Hard inputs for GBP (£) daily spending limits and warning thresholds.
- **External Connections**: Inputs for API keys (OpenAI, Anthropic, GitHub) with inline `Copy` and `Trash` actions.
- **Danger Zone**: High-contrast, red-accented area for emergency system halts (circuit breakers).

---

## 4. The Review Overlay (Massive Split-View Modal)

The most sophisticated component in the application, triggered by clicking an `ApprovalCard` in the Rightnav Inbox. It allows the CEO to deeply review and iterate on an agent's proposed action before executing it.

- **Layout**: `max-w-5xl`, 60/40 visual split.
- **Left Column (60% - The Spec Editor)**: A full web-IDE integration using `@monaco-editor/react`. It acts as a manual intervention layer, allowing the CEO to physically rewrite the agent's proposed code/JSON payload before executing it.
- **Right Column (40% - Agent Iteration Chat)**: A mini chat interface bound specifically to the agent proposing the action. It features the agent's avatar, a history of why they proposed the spec, and its own context-bound Input Dock (mirroring the Boardroom's Gemini dock).
- **Absolute Footer Actions**: Locked to the bottom-right are massive, definitive "Deny" (outline) and "Approve" (solid black) buttons for final authorization.

---

## 5. State Management & Data Flow Architecture (V1)

Currently, the UI shell heavily utilizes isolated React State (`useState`) localized to top-level page components and passed down via props to children.

- Modals, dropdowns, and temporary active states (e.g., active folder, viewing file) are managed locally.
- In production, this architecture is designed to map seamlessly to Convex queries and mutations. The "mock arrays" (e.g., `history`, `blueprints`, `approvals`) are structured explicitly to be replaced by `useQuery(api.table.get)` without requiring a UI rewrite.
- All actions (Creates, Deletes) are simulated via local array filtering/appending to prove out the UX flow prior to backend wiring.