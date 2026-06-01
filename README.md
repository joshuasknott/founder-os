# FounderOS

A private AI-native operating system for a non-technical founder running one business. One calm place to ask, decide, delegate, review, and reuse company knowledge.

## Surfaces

| Surface | Purpose |
| --- | --- |
| **Home** | Universal AI command surface — ask questions, give direction, start work |
| **Work** | Active / Review / Completed task flow |
| **Library** | Queryable business knowledge (not a folder system) |
| **Schedules** | Plain-language recurring work |
| **Settings** | Account, connections, and rules |

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Radix UI, shadcn
- **Backend**: Convex (real-time database, functions, crons)
- **Auth**: BetterAuth with Google OAuth
- **AI Workers**: Background workers for documents, design, communications, and generic tasks
- **Builder**: Multi-provider build system (Codex, OpenCode, DeepSeek, OpenRouter, and more)

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Environment

Copy the example env and fill in values:

```bash
cp .env.example .env.local
```

Key variables:

| Variable | Description |
| --- | --- |
| `CONVEX_DEPLOYMENT` | Convex deployment name |
| `NEXT_PUBLIC_CONVEX_URL` | Convex API URL |
| `BETTER_AUTH_SECRET` | Auth signing secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth for login |

See [.env.example](.env.example) for the full list including worker providers and connector credentials.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Workers

Background workers handle delegated work outside the main app:

```bash
npm run worker:documents       # Document processing
npm run worker:design          # Design generation
npm run worker:communications  # Communication tasks
npm run worker:generic         # Generic AI tasks
npm run builder                # Build runner (continuous)
npm run builder:once           # Build runner (single run)
```

## Testing

```bash
npm test
```

## Linting

```bash
npm run lint
```

## Project Structure

```
app/
  (app)/          # Main application shell
    context/      # Knowledge context views
    departments/  # Department views
    library/      # Library surface
    schedules/    # Schedules surface
    settings/     # Settings surface
    work/         # Work surface
    workflows/    # Workflow views
  (marketing)/    # Public marketing pages
components/       # Shared UI components
convex/           # Convex backend (schema, functions, crons)
docs/             # Architecture and product docs
hooks/            # React hooks
lib/              # Utility modules
workers/          # Background worker processes
tests/            # Test files
```

## Documentation

- [Frontend Architecture](docs/1_FRONTEND_ARCHITECTURE.md)
- [Product Vision](docs/2_PRODUCT_VISION.md)
- [Backend Schema](docs/3_BACKEND_SCHEMA.md)
- [AI Worker Protocols](docs/4_AGENT_PROTOCOLS.md)
- [Connector Runtime](docs/5_CONNECTOR_RUNTIME.md)
- [Stripe Connector Safety](docs/6_STRIPE_CONNECTOR_SAFETY.md)
- [Environment Setup](docs/7_ENVIRONMENT.md)
