import { requestConnectorJson, type ConnectorRequest } from "./connectorProviderRuntime";

const GOOGLE_API_BASE = "https://www.googleapis.com";
const MAX_CONTEXT_ITEMS = 8;

export type GoogleWorkspaceContext = {
  connectorId: string;
  source: string;
  status: "imported" | "empty" | "needs_attention";
  safeSummary: string;
  items: Array<{
    title: string;
    detail: string;
    href?: string;
    externalId?: string;
    receivedAt?: number;
  }>;
};

export type GoogleWorkspaceContextResult = {
  safeSummary: string;
  text: string;
  contexts: Record<string, GoogleWorkspaceContext>;
};

type GmailListResponse = {
  messages?: Array<{ id?: string; threadId?: string }>;
};

type GmailMessageResponse = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
  };
};

type GoogleHeader = { name?: string; value?: string };

type CalendarEventsResponse = {
  items?: Array<{
    id?: string;
    htmlLink?: string;
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: Array<{ email?: string; displayName?: string }>;
  }>;
};

type DriveFilesResponse = {
  files?: Array<{
    id?: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    modifiedTime?: string;
  }>;
};

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/https?:\/\/\S+/gi, "external link")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(ya29|sk|pk|rk|ghp|github_pat)[-_A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function header(headers: GoogleHeader[] | undefined, name: string) {
  return (Array.isArray(headers) ? headers : [])
    .find((candidate) => candidate?.name?.toLowerCase() === name.toLowerCase())
    ?.value;
}

function bearerHeaders(accessToken: string) {
  const token = accessToken.trim();
  if (!token) throw new Error("Reconnect this service from Settings.");
  return { Authorization: `Bearer ${token}` };
}

function apiUrl(pathname: string, params?: Record<string, string | number | Array<string | number> | undefined>) {
  const url = new URL(pathname, GOOGLE_API_BASE);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== "") url.searchParams.append(key, String(item));
      }
    } else if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function parseDays(text: string) {
  const explicit = text.match(/\b(?:last|past|previous)\s+(\d{1,2})\s+days?\b/i)?.[1];
  if (explicit) return Math.max(1, Math.min(30, Number(explicit)));
  if (/\btoday\b/i.test(text)) return 1;
  if (/\bthis week\b|\bweek\b/i.test(text)) return 7;
  return 14;
}

export function gmailSearchQuery(text: string) {
  const parts = [`newer_than:${parseDays(text)}d`];
  if (/\bimportant|priority|urgent|critical\b/i.test(text)) parts.push("is:important");
  if (/\bunread\b/i.test(text)) parts.push("is:unread");
  if (/\bfrom\s+([^\s]+@[^\s]+)/i.test(text)) parts.push(`from:${text.match(/\bfrom\s+([^\s]+@[^\s]+)/i)?.[1]}`);
  return parts.join(" ");
}

function calendarWindow(text: string, now = Date.now()) {
  const days = parseDays(text);
  return {
    timeMin: new Date(now - 60 * 60 * 1000).toISOString(),
    timeMax: new Date(now + days * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function driveSearchQuery(text: string, connectorId: string) {
  const terms = ["trashed = false"];
  if (connectorId === "google_docs") {
    terms.push("mimeType = 'application/vnd.google-apps.document'");
  } else if (connectorId === "google_sheets") {
    terms.push("mimeType = 'application/vnd.google-apps.spreadsheet'");
  }

  const quoted = text.match(/["']([^"']{3,80})["']/)?.[1];
  const simple = quoted ?? text
    .replace(/\b(find|search|import|open|show|recent|docs?|sheets?|drive|files?|spreadsheet|document)\b/gi, " ")
    .replace(/[^A-Za-z0-9 _.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  if (simple.length >= 3) terms.push(`name contains '${simple.replace(/'/g, "\\'")}'`);
  return terms.join(" and ");
}

function context(connectorId: string, source: string, items: GoogleWorkspaceContext["items"], emptyMessage: string): GoogleWorkspaceContext {
  const imported = items.length > 0;
  return {
    connectorId,
    source,
    status: imported ? "imported" : "empty",
    safeSummary: imported
      ? `${items.length} ${source} ${items.length === 1 ? "item" : "items"} found.`
      : emptyMessage,
    items,
  };
}

export async function fetchGmailContext(args: {
  accessToken: string;
  queryText: string;
  request: ConnectorRequest;
  maxResults?: number;
}): Promise<GoogleWorkspaceContext> {
  const maxResults = Math.max(1, Math.min(args.maxResults ?? 6, MAX_CONTEXT_ITEMS));
  const list = await requestConnectorJson<GmailListResponse>(
    args.request,
    apiUrl("/gmail/v1/users/me/messages", {
      q: gmailSearchQuery(args.queryText),
      maxResults,
    }),
    { method: "GET", headers: bearerHeaders(args.accessToken) },
  );
  const ids = (list.messages ?? []).map((message) => message.id).filter((id): id is string => Boolean(id)).slice(0, maxResults);
  const messages = await Promise.all(
    ids.map((id) =>
      requestConnectorJson<GmailMessageResponse>(
        args.request,
        apiUrl(`/gmail/v1/users/me/messages/${encodeURIComponent(id)}`, {
          format: "metadata",
          metadataHeaders: ["Subject", "From"],
        }),
        { method: "GET", headers: bearerHeaders(args.accessToken) },
      ),
    ),
  );

  return context(
    "gmail",
    "Gmail",
    messages.map((message) => ({
      title: cleanString(header(message.payload?.headers, "Subject"), 160) ?? "Relevant email",
      detail: [
        cleanString(header(message.payload?.headers, "From"), 160),
        cleanString(message.snippet, 260),
      ].filter(Boolean).join(" - "),
      externalId: message.id,
      receivedAt: message.internalDate ? Number(message.internalDate) : undefined,
    })).filter((item) => item.detail || item.title),
    "No matching Gmail messages were found.",
  );
}

export async function fetchCalendarContext(args: {
  accessToken: string;
  queryText: string;
  request: ConnectorRequest;
  maxResults?: number;
  now?: number;
}): Promise<GoogleWorkspaceContext> {
  const maxResults = Math.max(1, Math.min(args.maxResults ?? 8, MAX_CONTEXT_ITEMS));
  const window = calendarWindow(args.queryText, args.now);
  const events = await requestConnectorJson<CalendarEventsResponse>(
    args.request,
    apiUrl("/calendar/v3/calendars/primary/events", {
      timeMin: window.timeMin,
      timeMax: window.timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults,
    }),
    { method: "GET", headers: bearerHeaders(args.accessToken) },
  );

  return context(
    "google_calendar",
    "Google Calendar",
    (events.items ?? []).slice(0, maxResults).map((event) => {
      const start = event.start?.dateTime ?? event.start?.date;
      const end = event.end?.dateTime ?? event.end?.date;
      const attendees = (event.attendees ?? [])
        .map((attendee) => cleanString(attendee.displayName ?? attendee.email, 80))
        .filter(Boolean)
        .slice(0, 4)
        .join(", ");
      return {
        title: cleanString(event.summary, 160) ?? "Calendar event",
        detail: [start, end ? `to ${end}` : undefined, attendees ? `with ${attendees}` : undefined, cleanString(event.description, 220)]
          .filter(Boolean)
          .join(" - "),
        href: event.htmlLink,
        externalId: event.id,
        receivedAt: start ? Date.parse(start) : undefined,
      };
    }),
    "No matching calendar events were found.",
  );
}

export async function fetchDriveContext(args: {
  accessToken: string;
  queryText: string;
  connectorId: "google_drive" | "google_docs" | "google_sheets";
  request: ConnectorRequest;
  maxResults?: number;
}): Promise<GoogleWorkspaceContext> {
  const maxResults = Math.max(1, Math.min(args.maxResults ?? 8, MAX_CONTEXT_ITEMS));
  const files = await requestConnectorJson<DriveFilesResponse>(
    args.request,
    apiUrl("/drive/v3/files", {
      q: driveSearchQuery(args.queryText, args.connectorId),
      pageSize: maxResults,
      orderBy: "modifiedTime desc",
      fields: "files(id,name,mimeType,webViewLink,modifiedTime)",
    }),
    { method: "GET", headers: bearerHeaders(args.accessToken) },
  );
  const source = args.connectorId === "google_docs"
    ? "Google Docs"
    : args.connectorId === "google_sheets"
      ? "Google Sheets"
      : "Google Drive";

  return context(
    args.connectorId,
    source,
    (files.files ?? []).slice(0, maxResults).map((file) => ({
      title: cleanString(file.name, 180) ?? "Drive file",
      detail: [cleanString(file.mimeType, 120), file.modifiedTime ? `Modified ${file.modifiedTime}` : undefined].filter(Boolean).join(" - "),
      href: file.webViewLink,
      externalId: file.id,
      receivedAt: file.modifiedTime ? Date.parse(file.modifiedTime) : undefined,
    })),
    `No matching ${source} items were found.`,
  );
}

export function summarizeGoogleWorkspaceContext(contexts: GoogleWorkspaceContext[]): GoogleWorkspaceContextResult {
  const imported = contexts.filter((entry) => entry.items.length > 0);
  const lines = contexts.flatMap((entry) =>
    entry.items.map((item) => `- ${entry.source}: ${item.title}${item.detail ? ` - ${item.detail}` : ""}`),
  );
  const byId = Object.fromEntries(contexts.map((entry) => [entry.connectorId, entry]));

  return {
    safeSummary: imported.length > 0
      ? `${imported.reduce((count, entry) => count + entry.items.length, 0)} connected-service items found.`
      : "No matching connected-service context was found.",
    text: lines.length > 0
      ? `Connected service context:\n${lines.join("\n")}`
      : "No matching connected-service context was found.",
    contexts: byId,
  };
}

export function connectorsForGoogleContext(queryText: string, connectedIds: string[]) {
  const text = queryText.toLowerCase();
  const requested = new Set<string>();
  if (/\bgmail\b|\bemail|emails|mail|inbox|gmails\b/.test(text)) requested.add("gmail");
  if (/\bcalendar\b|\bschedule\b|\bmeeting|meetings|availability|available\b/.test(text)) requested.add("google_calendar");
  if (/\bdrive\b|\bfile|files|folder|folders\b/.test(text)) requested.add("google_drive");
  if (/\bdoc\b|\bdocs\b|\bdocument|documents\b/.test(text)) requested.add("google_docs");
  if (/\bsheet\b|\bsheets\b|\bspreadsheet|spreadsheets\b/.test(text)) requested.add("google_sheets");

  if (requested.size === 0) return [];
  return connectedIds.filter((id) => requested.has(id));
}
