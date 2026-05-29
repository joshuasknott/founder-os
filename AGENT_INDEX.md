# FounderOS: Agent Context

## System Abstract

FounderOS is a private AI-native operating system for a non-technical founder running one business. It combines a universal AI command surface, delegated work, recurring schedules, and queryable business knowledge.

Core stack: Next.js App Router, Convex, BetterAuth, Tailwind CSS.

## Product Rules

1. **One founder, one business for now**: keep workspace switching out of the primary UI.
2. **Home is the command surface**: the founder can ask, decide, find knowledge, shape work, and start action from one prompt.
3. **Work is the task flow**: organize visible work around Active, Review, and Completed.
4. **Library is queryable knowledge**: it is business memory FounderOS can search, summarize, compare, and reuse, not a folder system.
5. **Schedules are recurring work**: recurring requests stay plain-language and manageable without cron syntax.
6. **Settings are account, connections, and rules**: keep controls practical and founder-facing.
7. **No fake data**: starter examples belong in prompt suggestions, not seeded records.
8. **Plain language**: hide provider choices, internal planning, raw logs, model tiers, graph mechanics, and backend state names.
9. **Do not overbuild UI yet**: align navigation, copy, and data behavior before adding rich new surfaces.

## Documentation Map

- [Frontend Architecture](./docs/1_FRONTEND_ARCHITECTURE.md): app shell, Home, Work, Library, Schedules, Settings, contextual sidebar, pinned views, and UI language rules.
- [Product Direction](./docs/2_PRODUCT_VISION.md): five-surface product model, AI worker framing, hidden context graph, and approvals.
- [Backend Schema](./docs/3_BACKEND_SCHEMA.md): Convex table mapping and minimal initialization rules.
- [AI Worker Protocols](./docs/4_AGENT_PROTOCOLS.md): worker roles, surface behavior, language rules, and approval boundaries.
- [Hidden Runtime](./docs/5_CONNECTOR_RUNTIME.md): hidden work runtime, connector visibility, Library knowledge, Schedules, and current implementation boundary.

## Implementation Notes

- Prefer Convex-backed data over local mock arrays.
- Preserve backend foundations where useful, but hide or demote confusing concepts in the UI.
- Keep docs in sync when product behavior changes.
