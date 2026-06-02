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
    detail: "FounderOS can find relevant Drive files and read safe previews where Google allows it. Export and file updates are not live yet.",
  },
  google_docs: {
    label: "Google Docs",
    group: "Google Workspace",
    setup: "Sign in with Google",
    useCase: "Find relevant documents for answers and task context.",
    detail: "FounderOS can find relevant Docs and read safe previews for chat and work. Export and document updates are not live yet.",
  },
  google_sheets: {
    label: "Google Sheets",
    group: "Google Workspace",
    setup: "Sign in with Google",
    useCase: "Find relevant spreadsheets for answers and task context.",
    detail: "FounderOS can find relevant Sheets and read safe previews for chat and work. Export and spreadsheet updates are not live yet.",
  },
  github: {
    label: "GitHub",
    group: "opencode",
    setup: "Install GitHub App",
    useCase: "Import repository context and create approved issues.",
    detail: "FounderOS can save repository context to Library and create approved issues when the GitHub App is installed and a repository is chosen. Pull requests are not live yet.",
  },
  opencode: {
    label: "opencode",
    group: "opencode",
    setup: "Check this computer",
    useCase: "Let FounderOS use opencode privately on this computer.",
    detail: "FounderOS checks that opencode is ready, then keeps opencode work inside FounderOS with review before anything goes live.",
  },
  vercel: {
    label: "Website previews",
    group: "Website previews",
    setup: "Access token and project",
    useCase: "Save preview project details for builder-run previews.",
    detail: "The builder can publish previews from its environment. The Settings connection does not run Vercel actions yet.",
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
