export type ConnectorCopy = {
  label: string;
  group: string;
  setup: string;
  useCase: string;
  detail: string;
  comingSoon?: boolean;
};

export const connectorCopy: Record<string, ConnectorCopy> = {
  gmail: {
    label: "Gmail",
    group: "Google Workspace",
    setup: "Sign in with Google",
    useCase: "Draft replies, find useful email context, and prepare outbound messages.",
    detail: "FounderOS can read relevant threads, prepare drafts, and pause before anything is sent.",
  },
  google_calendar: {
    label: "Google Calendar",
    group: "Google Workspace",
    setup: "Sign in with Google",
    useCase: "Read your schedule and prepare meeting changes.",
    detail: "FounderOS can check availability and prepare calendar events. Creating events still waits for approval.",
  },
  google_drive: {
    label: "Google Drive",
    group: "Google Workspace",
    setup: "Sign in with Google",
    useCase: "Import useful files into Library context.",
    detail: "FounderOS can find and import business files so future work can use the right context.",
  },
  google_docs: {
    label: "Google Docs",
    group: "Google Workspace",
    setup: "Sign in with Google",
    useCase: "Import documents and export approved drafts.",
    detail: "FounderOS can use Docs as source material and prepare document updates for review.",
  },
  github: {
    label: "GitHub",
    group: "Code",
    setup: "Install GitHub App",
    useCase: "Read repository context and prepare approved code changes.",
    detail: "FounderOS can use repository context for product work and prepare pull requests after approval.",
  },
  opencode: {
    label: "OpenCode",
    group: "Code",
    setup: "Configure local bridge",
    useCase: "Route product-building work through your OpenCode subscriptions.",
    detail: "FounderOS stores the OpenCode command/model setup and the builder worker runs OpenCode in an isolated workspace.",
  },
  stripe: {
    label: "Stripe",
    group: "Payments",
    setup: "Restricted read-only key",
    useCase: "Sync customers, subscriptions, invoices, products, and revenue context.",
    detail: "FounderOS only accepts restricted read-only Stripe keys and blocks money-moving actions.",
    comingSoon: true,
  },
  vercel: {
    label: "Vercel",
    group: "Hosting",
    setup: "Access token and project",
    useCase: "Create private review links and publish only after approval.",
    detail: "FounderOS can prepare preview deployments and wait before touching live sites.",
    comingSoon: true,
  },
  posthog: {
    label: "PostHog",
    group: "Analytics",
    setup: "Project key",
    useCase: "Use product analytics as business context.",
    detail: "FounderOS can query analytics signals to inform decisions, reports, and product work.",
    comingSoon: true,
  },
  resend: {
    label: "Resend",
    group: "Communication",
    setup: "API key and sender",
    useCase: "Prepare transactional email work.",
    detail: "FounderOS can prepare email sends and keep approval gates around outbound messages.",
    comingSoon: true,
  },
  canva: {
    label: "Canva",
    group: "Design",
    setup: "Sign in with Canva",
    useCase: "Use design assets and prepare approved creative outputs.",
    detail: "FounderOS can read design context and prepare brand-safe assets for review.",
    comingSoon: true,
  },
};

export const onboardingConnectorIds = [
  "gmail",
  "google_calendar",
  "google_drive",
  "google_docs",
  "google_sheets",
  "github",
  "opencode",
];

export function copyForConnector(id: string) {
  return connectorCopy[id] ?? {
    label: id.replace(/_/g, " "),
    group: "Connection",
    setup: "Connect in FounderOS",
    useCase: "Connect this service for FounderOS work.",
    detail: "FounderOS stores connection details securely and keeps sensitive actions approval-protected.",
  };
}
