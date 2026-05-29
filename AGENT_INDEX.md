# FounderOS: Agent Context

## System Abstract

FounderOS is a private AI-native company workspace for a non-technical founder running one business. It combines chat, delegated tasks, and a Library of saved business context.

Core stack: Next.js App Router, Convex, BetterAuth, Tailwind CSS.

## Product Rules

1. **One founder, one business for now**: keep workspace switching out of the primary UI.
2. **Prompt-first Home**: Home centers on a floating prompt with Chat and Task modes.
3. **Chat is read-only**: it helps think, plan, ask, and shape tasks. It does not create outputs or make business changes.
4. **Task creates visible work**: every task creates a work item, shows progress, and records finished outputs in Library when outputs exist.
5. **Library is the business context layer**: documents, websites, presentations, tools, automations, history, conversations, and useful records should all feel first-class.
6. **No fake data**: starter examples belong in prompt suggestions, not seeded records.
7. **Plain language**: hide provider choices, internal planning, raw logs, model tiers, and backend state names.

## Documentation Map

- [Frontend Architecture](./docs/1_FRONTEND_ARCHITECTURE.md): app shell, Home loop, Library, Settings, and UI language rules.
- [Product Direction](./docs/2_PRODUCT_VISION.md): product model, Chat/Task split, AI worker framing, and approvals.
- [Backend Schema](./docs/3_BACKEND_SCHEMA.md): Convex table mapping and minimal initialization rules.
- [AI Worker Protocols](./docs/4_AGENT_PROTOCOLS.md): worker roles, mode behavior, language rules, and approval boundaries.

## Implementation Notes

- Prefer Convex-backed data over local mock arrays.
- Preserve backend foundations where useful, but hide or demote confusing concepts in the UI.
- Keep docs in sync when product behavior changes.
