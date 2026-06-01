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

type GmailSendResponse = {
  id?: string;
  threadId?: string;
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

type CalendarEventResponse = {
  id?: string;
  htmlLink?: string;
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

type GoogleDocResponse = {
  body?: {
    content?: Array<{
      paragraph?: {
        elements?: Array<{
          textRun?: { content?: string };
        }>;
      };
    }>;
  };
};

type GoogleSpreadsheetResponse = {
  sheets?: Array<{
    properties?: { title?: string };
    data?: Array<{
      rowData?: Array<{
        values?: Array<{ formattedValue?: string }>;
      }>;
    }>;
  }>;
};

export type GoogleEmailDraftInput = {
  to?: unknown;
  subject?: unknown;
  body?: unknown;
};

export type GoogleCalendarEventInput = {
  title?: unknown;
  summary?: unknown;
  when?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  attendees?: unknown;
  description?: unknown;
  timeZone?: unknown;
};

export type GoogleWorkspaceActionResult = {
  status: "completed";
  safeSummary: string;
  externalId?: string;
  providerUrl?: string;
  metadata?: Record<string, unknown>;
};

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/https?:\/\/\S+/gi, "external link")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(ya29|sk|pk|rk|ghp|github_pat)[-._A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function cleanPreviewText(value: unknown, maxLength = 1000) {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/https?:\/\/\S+/gi, "external link")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(ya29|sk|pk|rk|ghp|github_pat)[-._A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, "private detail")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function rawString(value: unknown, maxLength = 20000) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, maxLength);
}

function headerString(value: unknown, maxLength = 400) {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function utf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function utf8Base64Url(value: string) {
  return utf8Base64(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function mimeHeader(value: string) {
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${utf8Base64(value)}?=`;
}

function normalizeEmailList(value: unknown) {
  const raw = Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : "";
  const emails = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(emails.map((email) => email.toLowerCase()))].slice(0, 20);
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

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function parseClock(text: string) {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const suffix = match[3]?.toLowerCase();
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function dateWithTime(base: Date, clock: { hour: number; minute: number }) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), clock.hour, clock.minute, 0, 0);
}

function parseDateTimeText(value: string, now = Date.now()) {
  const text = value.trim();
  const explicit = text.match(/\b(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})\b/);
  if (explicit) {
    const parsed = new Date(`${explicit[1]}T${explicit[2].padStart(2, "0")}:${explicit[3]}:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parsedText = Date.parse(text);
  if (!Number.isNaN(parsedText) && /\d{4}|gmt|utc|[+-]\d{2}:?\d{2}|t\d{1,2}:/i.test(text)) {
    return new Date(parsedText);
  }

  const clock = parseClock(text);
  if (!clock) return null;

  const base = new Date(now);
  if (/\btomorrow\b/i.test(text)) {
    return dateWithTime(addMinutes(base, 24 * 60), clock);
  }
  if (/\btoday\b/i.test(text)) {
    return dateWithTime(base, clock);
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weekdayIndex = weekdays.findIndex((day) => new RegExp(`\\b(?:next\\s+)?${day}\\b`, "i").test(text));
  if (weekdayIndex >= 0) {
    const daysAhead = (weekdayIndex - base.getDay() + 7) % 7 || 7;
    return dateWithTime(addMinutes(base, daysAhead * 24 * 60), clock);
  }

  return null;
}

function normalizeCalendarTimes(event: GoogleCalendarEventInput, now = Date.now()) {
  const explicitStart = typeof event.startAt === "string" ? parseDateTimeText(event.startAt, now) : null;
  const explicitEnd = typeof event.endAt === "string" ? parseDateTimeText(event.endAt, now) : null;
  const inferredStart = explicitStart ?? (typeof event.when === "string" ? parseDateTimeText(event.when, now) : null);
  if (!inferredStart) {
    throw new Error("Add an exact date and time before FounderOS creates the calendar event.");
  }
  const inferredEnd = explicitEnd && explicitEnd > inferredStart ? explicitEnd : addMinutes(inferredStart, 30);
  return {
    startAt: inferredStart.toISOString(),
    endAt: inferredEnd.toISOString(),
  };
}

export function buildGmailRawMessage(draft: GoogleEmailDraftInput) {
  const to = normalizeEmailList(draft.to);
  const subject = headerString(draft.subject, 260);
  const body = rawString(draft.body);

  if (to.length === 0) throw new Error("Add a recipient email address before FounderOS sends this.");
  if (!subject) throw new Error("Add a subject before FounderOS sends this.");
  if (!body) throw new Error("Add message text before FounderOS sends this.");

  return [
    `To: ${to.join(", ")}`,
    `Subject: ${mimeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");
}

export async function sendGmailMessage(args: {
  accessToken: string;
  draft: GoogleEmailDraftInput;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult> {
  const raw = utf8Base64Url(buildGmailRawMessage(args.draft));
  const result = await requestConnectorJson<GmailSendResponse>(
    args.request,
    apiUrl("/gmail/v1/users/me/messages/send"),
    {
      method: "POST",
      headers: {
        ...bearerHeaders(args.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );
  if (!result.id) throw new Error("The connected service did not confirm the sent email.");

  return {
    status: "completed",
    safeSummary: "The approved email was sent.",
    externalId: result.id,
    metadata: { threadId: result.threadId },
  };
}

export function buildGoogleCalendarEvent(event: GoogleCalendarEventInput, now = Date.now()) {
  const title = headerString(event.title ?? event.summary, 220);
  const description = rawString(event.description, 4000);
  const attendees = normalizeEmailList(event.attendees);
  const timeZone = headerString(event.timeZone, 80) || "UTC";
  const times = normalizeCalendarTimes(event, now);

  if (!title) throw new Error("Add an event title before FounderOS creates this.");

  return {
    summary: title,
    description,
    start: { dateTime: times.startAt, timeZone },
    end: { dateTime: times.endAt, timeZone },
    attendees: attendees.map((email) => ({ email })),
  };
}

export async function createGoogleCalendarEvent(args: {
  accessToken: string;
  event: GoogleCalendarEventInput;
  request: ConnectorRequest;
  now?: number;
}): Promise<GoogleWorkspaceActionResult> {
  const event = buildGoogleCalendarEvent(args.event, args.now);
  const result = await requestConnectorJson<CalendarEventResponse>(
    args.request,
    apiUrl("/calendar/v3/calendars/primary/events", { sendUpdates: "all" }),
    {
      method: "POST",
      headers: {
        ...bearerHeaders(args.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );
  if (!result.id) throw new Error("The connected service did not confirm the calendar event.");

  return {
    status: "completed",
    safeSummary: "The approved calendar event was created.",
    externalId: result.id,
    providerUrl: result.htmlLink,
  };
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

function extractGoogleDocText(document: GoogleDocResponse) {
  const text = (document.body?.content ?? [])
    .flatMap((block) => block.paragraph?.elements ?? [])
    .map((element) => element.textRun?.content ?? "")
    .join(" ");
  return cleanPreviewText(text, 1200);
}

function extractGoogleSheetText(spreadsheet: GoogleSpreadsheetResponse) {
  const rows: string[] = [];
  for (const sheet of spreadsheet.sheets ?? []) {
    const title = cleanPreviewText(sheet.properties?.title, 80);
    if (title) rows.push(`${title}:`);
    for (const data of sheet.data ?? []) {
      for (const row of data.rowData ?? []) {
        const cells = (row.values ?? [])
          .map((cell) => cleanPreviewText(cell.formattedValue, 120))
          .filter(Boolean);
        if (cells.length > 0) rows.push(cells.join(" | "));
        if (rows.length >= 12) break;
      }
      if (rows.length >= 12) break;
    }
    if (rows.length >= 12) break;
  }
  return cleanPreviewText(rows.join(" "), 1200);
}

async function googleWorkspaceFilePreview(args: {
  accessToken: string;
  connectorId: "google_drive" | "google_docs" | "google_sheets";
  file: NonNullable<DriveFilesResponse["files"]>[number];
  request: ConnectorRequest;
}) {
  if (!args.file.id) return undefined;

  try {
    if (
      args.connectorId === "google_docs" ||
      args.file.mimeType === "application/vnd.google-apps.document"
    ) {
      const document = await requestConnectorJson<GoogleDocResponse>(
        args.request,
        apiUrl(`/docs/v1/documents/${encodeURIComponent(args.file.id)}`, {
          fields: "body/content/paragraph/elements/textRun/content",
        }),
        { method: "GET", headers: bearerHeaders(args.accessToken) },
      );
      return extractGoogleDocText(document);
    }

    if (
      args.connectorId === "google_sheets" ||
      args.file.mimeType === "application/vnd.google-apps.spreadsheet"
    ) {
      const spreadsheet = await requestConnectorJson<GoogleSpreadsheetResponse>(
        args.request,
        apiUrl(`/sheets/v4/spreadsheets/${encodeURIComponent(args.file.id)}`, {
          includeGridData: "true",
          ranges: "A1:Z50",
          fields: "sheets(properties/title,data/rowData/values/formattedValue)",
        }),
        { method: "GET", headers: bearerHeaders(args.accessToken) },
      );
      return extractGoogleSheetText(spreadsheet);
    }
  } catch {
    return undefined;
  }

  return undefined;
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

  const items = await Promise.all(
    (files.files ?? []).slice(0, maxResults).map(async (file) => {
      const preview = await googleWorkspaceFilePreview({
        accessToken: args.accessToken,
        connectorId: args.connectorId,
        file,
        request: args.request,
      });
      return {
        title: cleanString(file.name, 180) ?? "Drive file",
        detail: [
          preview ? `Preview: ${preview}` : cleanString(file.mimeType, 120),
          file.modifiedTime ? `Modified ${file.modifiedTime}` : undefined,
        ].filter(Boolean).join(" - "),
        href: file.webViewLink,
        externalId: file.id,
        receivedAt: file.modifiedTime ? Date.parse(file.modifiedTime) : undefined,
      };
    }),
  );

  return context(
    args.connectorId,
    source,
    items,
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
