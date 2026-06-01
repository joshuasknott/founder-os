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
    useCase: "Read relevant email context, prepare drafts, and send approved messages.",
    detail: "FounderOS can read relevant threads, prepare drafts, and only send after approval.",
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
    useCase: "Find useful business files for answers and task context.",
    detail: "FounderOS can find relevant Drive files and use their metadata as context for chat and work.",
  },
  google_docs: {
    label: "Google Docs",
    group: "Google Workspace",
    setup: "Sign in with Google",
    useCase: "Find relevant documents for answers and task context.",
    detail: "FounderOS can find relevant Docs and use their metadata as context for chat and work.",
  },
  google_sheets: {
    label: "Google Sheets",
    group: "Google Workspace",
    setup: "Sign in with Google",
    useCase: "Find relevant spreadsheets for answers and task context.",
    detail: "FounderOS can find relevant Sheets and use their metadata as context for chat and work.",
  },
  github: {
    label: "GitHub",
    group: "Product work",
    setup: "Install GitHub App",
    useCase: "Read repository context and prepare approved code changes.",
    detail: "FounderOS can use repository context for product work and prepare pull requests after approval.",
  },
  opencode: {
    label: "OpenCode",
    group: "Product work",
    setup: "Check local setup",
    useCase: "Let FounderOS prepare product-building work using your local OpenCode setup.",
    detail: "FounderOS checks that OpenCode is ready on this computer, then uses it privately for product-building work.",
  },
  vercel: {
    label: "Website previews",
    group: "Website previews",
    setup: "Access token and project",
    useCase: "Create private review links and publish only after approval.",
    detail: "FounderOS can prepare preview deployments and wait before touching live sites.",
  },
};

export const onboardingConnectorIds = [
  "gmail",
  "google_calendar",
  "google_drive",
  "google_docs",
  "google_sheets",
  "opencode",
  "github",
  "vercel",
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
