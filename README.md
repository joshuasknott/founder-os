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
- **Auth**: Clerk with Convex JWT authentication
- **AI Workers**: Background workers for documents, design, communications, and generic tasks
- **Builder**: hidden opencode/GLM system for previews and review
- **Model Orchestration**: hidden backend routing by capability, sensitivity, and output type

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
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser key |
| `CLERK_SECRET_KEY` | Clerk server key |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk issuer domain configured for Convex |

Create a Clerk JWT template named `convex`, then set the same issuer domain on
the Convex deployment with `npx convex env set CLERK_JWT_ISSUER_DOMAIN <issuer>`.

See [.env.example](.env.example) and [Environment Setup](docs/7_ENVIRONMENT.md) for the full list including hidden model routes, worker providers, and connector credentials.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Workers

The local runner is the preferred path for Home chat intake and delegated work
on a founder's computer. It registers with Convex, heartbeats while running,
leases hidden Home chat jobs first, leases hidden Work items next, then writes
plain progress and results back:

```bash
npm run local-runner       # Local runner (continuous)
npm run local-runner:once  # Local runner (single lease)
```

For real Home chat, install and sign in to `opencode`, set
`LOCAL_RUNNER_REQUIRE_OPENCODE=true`, and keep routine chat on the default paid
GLM business route (`zai-coding-plan/glm-4.7`). Do not set `ZAI_API_KEY` for the
normal path; DeepSeek is escalation/review only.

The legacy individual workers are still supported for compatibility:

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
- [Environment Setup](docs/7_ENVIRONMENT.md)
