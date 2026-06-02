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

type DriveFileResponse = {
  id?: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
};

type GoogleDocResponse = {
  documentId?: string;
  title?: string;
  body?: {
    content?: Array<{
      endIndex?: number;
      paragraph?: {
        elements?: Array<{
          textRun?: { content?: string };
        }>;
      };
    }>;
  };
};

type GoogleDocBatchUpdateResponse = {
  documentId?: string;
};

type GoogleSpreadsheetResponse = {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  properties?: { title?: string };
  sheets?: Array<{
    properties?: { title?: string };
    data?: Array<{
      rowData?: Array<{
        values?: Array<{ formattedValue?: string }>;
      }>;
    }>;
  }>;
};

type GoogleSheetValuesResponse = {
  spreadsheetId?: string;
  updatedRange?: string;
  tableRange?: string;
  updates?: {
    spreadsheetId?: string;
    updatedRange?: string;
  };
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

export type GoogleWorkspaceFileActionInput = Record<string, unknown>;

export type GoogleWorkspaceLibraryOutput = {
  connectorId: "google_drive" | "google_docs" | "google_sheets";
  externalId: string;
  externalType: string;
  title: string;
  content: string;
  summary: string;
  sourceUrl?: string;
  mimeType: string;
  format: "plain_text" | "html" | "json" | "markdown";
  tags: string[];
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

function payloadRecord(value: unknown): GoogleWorkspaceFileActionInput {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as GoogleWorkspaceFileActionInput
    : {};
}

function firstPayloadString(payload: GoogleWorkspaceFileActionInput, keys: string[], maxLength = 20000) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, maxLength);
  }
  return undefined;
}

function optionalGoogleId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  if (!id) return undefined;
  if (!/^[A-Za-z0-9_-]{3,240}$/.test(id)) {
    throw new Error("Choose the Google file before FounderOS continues.");
  }
  return id;
}

function requiredGoogleId(payload: GoogleWorkspaceFileActionInput, keys: string[], message: string) {
  for (const key of keys) {
    const id = optionalGoogleId(payload[key]);
    if (id) return id;
  }
  throw new Error(message);
}

function optionalFolderId(payload: GoogleWorkspaceFileActionInput) {
  return optionalGoogleId(payload.folderId ?? payload.parentId);
}

function titleFromPayload(payload: GoogleWorkspaceFileActionInput, fallback = "FounderOS export") {
  return firstPayloadString(payload, ["title", "name", "fileName", "filename"], 220) ?? fallback;
}

function contentFromPayload(payload: GoogleWorkspaceFileActionInput, message: string) {
  const content = firstPayloadString(payload, ["content", "body", "text", "markdown", "csv", "json"], 200000);
  if (!content) throw new Error(message);
  return content;
}

function mimeTypeFromPayload(payload: GoogleWorkspaceFileActionInput, fallback = "text/plain") {
  const mimeType = firstPayloadString(payload, ["mimeType", "contentType"], 120) ?? fallback;
  if (!/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(mimeType)) {
    throw new Error("Choose a supported file type before FounderOS continues.");
  }
  return mimeType;
}

const writableDriveMimeTypes = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
]);

function ensureWritableDriveMimeType(mimeType: string) {
  if (!writableDriveMimeTypes.has(mimeType)) {
    throw new Error("FounderOS can upload text, Markdown, CSV, HTML, and JSON files to Drive right now.");
  }
}

const libraryExportFormats: Record<string, GoogleWorkspaceLibraryOutput["format"]> = {
  "text/plain": "plain_text",
  "text/csv": "plain_text",
  "text/html": "html",
  "application/json": "json",
  "text/markdown": "markdown",
};

function exportMimeTypeFromPayload(payload: GoogleWorkspaceFileActionInput, fallback: string) {
  const value = firstPayloadString(payload, ["exportMimeType", "mimeType", "format"], 120) ?? fallback;
  const aliases: Record<string, string> = {
    txt: "text/plain",
    text: "text/plain",
    csv: "text/csv",
    html: "text/html",
    json: "application/json",
    markdown: "text/markdown",
    md: "text/markdown",
  };
  return aliases[value.toLowerCase()] ?? value;
}

function ensureLibraryExportMimeType(mimeType: string) {
  if (!libraryExportFormats[mimeType]) {
    throw new Error("FounderOS can export text, CSV, HTML, Markdown, or JSON to Library from this connection right now.");
  }
}

function driveFileUrl(fileId: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

function googleDocUrl(documentId: string) {
  return `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit`;
}

function googleSheetUrl(spreadsheetId: string) {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`;
}

function googlePermissionMessage(serviceName: string, action: string) {
  return `${serviceName} needs updated access before FounderOS can ${action}.`;
}

function googleProviderError(status: number, serviceName: string, action: string) {
  if (status === 401 || status === 403) return new Error(googlePermissionMessage(serviceName, action));
  if (status === 404) return new Error(`${serviceName} could not find that file. Check the file ID and access.`);
  if (status === 400 || status === 409 || status === 422) return new Error(`Check the ${serviceName} details before trying again.`);
  return new Error(`${serviceName} could not finish that step.`);
}

async function requestGoogleJson<T>(args: {
  request: ConnectorRequest;
  input: string;
  init?: Parameters<ConnectorRequest>[1];
  serviceName: string;
  action: string;
}) {
  const response = await args.request(args.input, args.init);
  if (!response.ok) throw googleProviderError(response.status, args.serviceName, args.action);
  return await response.json() as T;
}

async function requestGoogleText(args: {
  request: ConnectorRequest;
  input: string;
  init?: Parameters<ConnectorRequest>[1];
  serviceName: string;
  action: string;
}) {
  const response = await args.request(args.input, args.init);
  if (!response.ok) throw googleProviderError(response.status, args.serviceName, args.action);
  if (!response.text) throw new Error(`${args.serviceName} did not return export content.`);
  const text = await response.text();
  if (!text.trim()) throw new Error(`${args.serviceName} returned an empty export.`);
  return text;
}

function multipartUploadBody(args: {
  metadata: Record<string, unknown>;
  content: string;
  mimeType: string;
}) {
  const boundary = `founderos_${Math.random().toString(36).slice(2)}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(args.metadata),
    `--${boundary}`,
    `Content-Type: ${args.mimeType}; charset=UTF-8`,
    "",
    args.content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

function normalizeSheetCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return String(value).replace(/\s+/g, " ").trim().slice(0, 500);
}

function rowsFromDelimitedText(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.includes("\t") ? line.split("\t") : line.split(","))
    .map((row) => row.map((cell) => normalizeSheetCell(cell)));
}

function sheetValuesFromPayload(payload: GoogleWorkspaceFileActionInput) {
  const rawValues = payload.values ?? payload.rows ?? payload.data;
  const rows = Array.isArray(rawValues)
    ? rawValues
    : typeof rawValues === "string"
      ? rowsFromDelimitedText(rawValues)
      : firstPayloadString(payload, ["content", "csv", "text"], 200000)
        ? rowsFromDelimitedText(firstPayloadString(payload, ["content", "csv", "text"], 200000)!)
        : [];

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Add spreadsheet rows before FounderOS creates or updates the sheet.");
  }

  const normalized = rows
    .slice(0, 1000)
    .map((row) => (Array.isArray(row) ? row : [row]).slice(0, 80).map(normalizeSheetCell))
    .filter((row) => row.some((cell) => cell !== ""));
  if (normalized.length === 0) {
    throw new Error("Add spreadsheet rows before FounderOS creates or updates the sheet.");
  }
  return normalized;
}

function rangeFromPayload(payload: GoogleWorkspaceFileActionInput, fallbackSheetName = "Sheet1") {
  return firstPayloadString(payload, ["range"], 120) ?? `${fallbackSheetName}!A1`;
}

function updateModeFromPayload(payload: GoogleWorkspaceFileActionInput) {
  const mode = firstPayloadString(payload, ["mode", "updateMode", "operation"], 40)?.toLowerCase();
  if (mode === "replace" || mode === "overwrite") return "replace";
  if (mode === "append") return "append";
  return "update";
}

async function maybeMoveDriveFile(args: {
  accessToken: string;
  fileId: string;
  folderId?: string;
  request: ConnectorRequest;
}) {
  if (!args.folderId) return;
  await requestGoogleJson<DriveFileResponse>({
    request: args.request,
    input: apiUrl(`/drive/v3/files/${encodeURIComponent(args.fileId)}`, {
      addParents: args.folderId,
      fields: "id,webViewLink",
    }),
    init: {
      method: "PATCH",
      headers: bearerHeaders(args.accessToken),
      body: JSON.stringify({}),
    },
    serviceName: "Google Drive",
    action: "place the file in that folder",
  });
}

function libraryOutput(args: {
  connectorId: GoogleWorkspaceLibraryOutput["connectorId"];
  externalId: string;
  externalType: string;
  title: string;
  content: string;
  sourceUrl?: string;
  mimeType: string;
}) {
  const format = libraryExportFormats[args.mimeType];
  ensureLibraryExportMimeType(args.mimeType);
  const cleanContent = rawString(args.content, 200000);
  if (!cleanContent) throw new Error("The exported file did not include content FounderOS can save.");
  const summary = `${args.title} was exported to Library.`;
  return {
    connectorId: args.connectorId,
    externalId: args.externalId,
    externalType: args.externalType,
    title: args.title,
    content: cleanContent,
    summary,
    sourceUrl: args.sourceUrl,
    mimeType: args.mimeType,
    format,
    tags: ["google workspace", "export"],
  };
}

export async function createGoogleDriveFile(args: {
  accessToken: string;
  file: GoogleWorkspaceFileActionInput;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult> {
  const payload = payloadRecord(args.file);
  const title = titleFromPayload(payload, "FounderOS file");
  const mimeType = mimeTypeFromPayload(payload, "text/plain");
  ensureWritableDriveMimeType(mimeType);
  const content = contentFromPayload(payload, "Add file content before FounderOS uploads it to Drive.");
  const metadata: Record<string, unknown> = {
    name: title,
    mimeType,
  };
  const folderId = optionalFolderId(payload);
  if (folderId) metadata.parents = [folderId];
  const upload = multipartUploadBody({ metadata, content, mimeType });
  const created = await requestGoogleJson<DriveFileResponse>({
    request: args.request,
    input: apiUrl("/upload/drive/v3/files", {
      uploadType: "multipart",
      fields: "id,name,mimeType,webViewLink",
    }),
    init: {
      method: "POST",
      headers: {
        ...bearerHeaders(args.accessToken),
        "Content-Type": upload.contentType,
      },
      body: upload.body,
    },
    serviceName: "Google Drive",
    action: "upload files",
  });
  if (!created.id) throw new Error("Google Drive did not confirm the uploaded file.");

  return {
    status: "completed",
    safeSummary: "The approved file was saved to Drive.",
    externalId: created.id,
    providerUrl: created.webViewLink ?? driveFileUrl(created.id),
    metadata: {
      connectorId: "google_drive",
      action: "write_record",
      externalType: "file",
      title: cleanString(created.name, 220) ?? title,
      mimeType: created.mimeType ?? mimeType,
      providerUrl: created.webViewLink ?? driveFileUrl(created.id),
    },
  };
}

export async function updateGoogleDriveFile(args: {
  accessToken: string;
  file: GoogleWorkspaceFileActionInput;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult> {
  const payload = payloadRecord(args.file);
  const fileId = requiredGoogleId(payload, ["fileId", "id"], "Choose the Drive file before FounderOS updates it.");
  const title = firstPayloadString(payload, ["title", "name", "fileName", "filename"], 220);
  const mimeType = mimeTypeFromPayload(payload, "text/plain");
  const content = firstPayloadString(payload, ["content", "body", "text", "markdown", "csv", "json"], 200000);
  const metadata: Record<string, unknown> = {};
  if (title) metadata.name = title;

  let updated: DriveFileResponse;
  if (content) {
    ensureWritableDriveMimeType(mimeType);
    const upload = multipartUploadBody({ metadata, content, mimeType });
    updated = await requestGoogleJson<DriveFileResponse>({
      request: args.request,
      input: apiUrl(`/upload/drive/v3/files/${encodeURIComponent(fileId)}`, {
        uploadType: "multipart",
        fields: "id,name,mimeType,webViewLink",
      }),
      init: {
        method: "PATCH",
        headers: {
          ...bearerHeaders(args.accessToken),
          "Content-Type": upload.contentType,
        },
        body: upload.body,
      },
      serviceName: "Google Drive",
      action: "update files",
    });
  } else if (Object.keys(metadata).length > 0) {
    updated = await requestGoogleJson<DriveFileResponse>({
      request: args.request,
      input: apiUrl(`/drive/v3/files/${encodeURIComponent(fileId)}`, {
        fields: "id,name,mimeType,webViewLink",
      }),
      init: {
        method: "PATCH",
        headers: {
          ...bearerHeaders(args.accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      },
      serviceName: "Google Drive",
      action: "update files",
    });
  } else {
    throw new Error("Add a new file name or file content before FounderOS updates Drive.");
  }
  if (!updated.id) throw new Error("Google Drive did not confirm the file update.");

  return {
    status: "completed",
    safeSummary: "The approved Drive file was updated.",
    externalId: updated.id,
    providerUrl: updated.webViewLink ?? driveFileUrl(updated.id),
    metadata: {
      connectorId: "google_drive",
      action: "update_external_record",
      externalType: "file",
      title: cleanString(updated.name, 220) ?? title,
      mimeType: updated.mimeType ?? mimeType,
      providerUrl: updated.webViewLink ?? driveFileUrl(updated.id),
    },
  };
}

export async function exportGoogleDriveFile(args: {
  accessToken: string;
  file: GoogleWorkspaceFileActionInput;
  request: ConnectorRequest;
  connectorId?: "google_drive" | "google_docs" | "google_sheets";
  defaultMimeType?: string;
}): Promise<GoogleWorkspaceActionResult> {
  const payload = payloadRecord(args.file);
  const fileId = requiredGoogleId(payload, ["fileId", "documentId", "spreadsheetId", "id"], "Choose the Google file before FounderOS exports it.");
  const exportMimeType = exportMimeTypeFromPayload(payload, args.defaultMimeType ?? "text/plain");
  ensureLibraryExportMimeType(exportMimeType);
  const metadata = await requestGoogleJson<DriveFileResponse>({
    request: args.request,
    input: apiUrl(`/drive/v3/files/${encodeURIComponent(fileId)}`, {
      fields: "id,name,mimeType,webViewLink",
    }),
    init: { method: "GET", headers: bearerHeaders(args.accessToken) },
    serviceName: "Google Drive",
    action: "export files",
  });
  if (!metadata.id) throw new Error("Google Drive did not confirm the file before export.");

  const isWorkspaceFile = metadata.mimeType?.startsWith("application/vnd.google-apps.");
  const savedMimeType = isWorkspaceFile ? exportMimeType : metadata.mimeType ?? exportMimeType;
  ensureLibraryExportMimeType(savedMimeType);
  const content = await requestGoogleText({
    request: args.request,
    input: isWorkspaceFile
      ? apiUrl(`/drive/v3/files/${encodeURIComponent(fileId)}/export`, { mimeType: exportMimeType })
      : apiUrl(`/drive/v3/files/${encodeURIComponent(fileId)}`, { alt: "media" }),
    init: { method: "GET", headers: bearerHeaders(args.accessToken) },
    serviceName: "Google Drive",
    action: "export files",
  });
  const connectorId = args.connectorId ?? "google_drive";
  const title = titleFromPayload(payload, cleanString(metadata.name, 220) ?? "Google export");
  const sourceUrl = metadata.webViewLink ?? driveFileUrl(fileId);
  const output = libraryOutput({
    connectorId,
    externalId: fileId,
    externalType: connectorId === "google_docs" ? "document_export" : connectorId === "google_sheets" ? "spreadsheet_export" : "file_export",
    title,
    content,
    sourceUrl,
    mimeType: savedMimeType,
  });

  return {
    status: "completed",
    safeSummary: `${title} was exported to Library.`,
    externalId: fileId,
    providerUrl: sourceUrl,
    metadata: {
      connectorId,
      action: "export_content",
      externalType: output.externalType,
      title,
      mimeType: savedMimeType,
      providerUrl: sourceUrl,
      libraryOutput: output,
    },
  };
}

export async function createGoogleDocument(args: {
  accessToken: string;
  document: GoogleWorkspaceFileActionInput;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult> {
  const payload = payloadRecord(args.document);
  const title = titleFromPayload(payload, "FounderOS document");
  const content = contentFromPayload(payload, "Add document text before FounderOS creates it in Google Docs.");
  const created = await requestGoogleJson<GoogleDocResponse>({
    request: args.request,
    input: apiUrl("/docs/v1/documents"),
    init: {
      method: "POST",
      headers: {
        ...bearerHeaders(args.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    },
    serviceName: "Google Docs",
    action: "create documents",
  });
  const documentId = created.documentId;
  if (!documentId) throw new Error("Google Docs did not confirm the created document.");

  await requestGoogleJson<GoogleDocBatchUpdateResponse>({
    request: args.request,
    input: apiUrl(`/docs/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`),
    init: {
      method: "POST",
      headers: {
        ...bearerHeaders(args.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text: content } }],
      }),
    },
    serviceName: "Google Docs",
    action: "create documents",
  });
  await maybeMoveDriveFile({
    accessToken: args.accessToken,
    fileId: documentId,
    folderId: optionalFolderId(payload),
    request: args.request,
  });

  return {
    status: "completed",
    safeSummary: "The approved document was created in Google Docs.",
    externalId: documentId,
    providerUrl: googleDocUrl(documentId),
    metadata: {
      connectorId: "google_docs",
      action: "write_record",
      externalType: "document",
      title,
      mimeType: "application/vnd.google-apps.document",
      providerUrl: googleDocUrl(documentId),
    },
  };
}

function docEndIndex(document: GoogleDocResponse) {
  const endIndexes = (document.body?.content ?? [])
    .map((block) => block.endIndex)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return Math.max(1, ...endIndexes);
}

export async function updateGoogleDocument(args: {
  accessToken: string;
  document: GoogleWorkspaceFileActionInput;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult> {
  const payload = payloadRecord(args.document);
  const documentId = requiredGoogleId(payload, ["documentId", "fileId", "id"], "Choose the Google document before FounderOS updates it.");
  const content = contentFromPayload(payload, "Add document text before FounderOS updates Google Docs.");
  const mode = updateModeFromPayload(payload);
  const existing = await requestGoogleJson<GoogleDocResponse>({
    request: args.request,
    input: apiUrl(`/docs/v1/documents/${encodeURIComponent(documentId)}`, {
      fields: "title,body/content/endIndex",
    }),
    init: { method: "GET", headers: bearerHeaders(args.accessToken) },
    serviceName: "Google Docs",
    action: "update documents",
  });
  const endIndex = docEndIndex(existing);
  const insertIndex = Math.max(1, endIndex - 1);
  const requests = mode === "replace"
    ? [
        ...(insertIndex > 1 ? [{ deleteContentRange: { range: { startIndex: 1, endIndex: insertIndex } } }] : []),
        { insertText: { location: { index: 1 }, text: content } },
      ]
    : [{ insertText: { location: { index: insertIndex }, text: content.startsWith("\n") ? content : `\n${content}` } }];

  const result = await requestGoogleJson<GoogleDocBatchUpdateResponse>({
    request: args.request,
    input: apiUrl(`/docs/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`),
    init: {
      method: "POST",
      headers: {
        ...bearerHeaders(args.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    },
    serviceName: "Google Docs",
    action: "update documents",
  });
  if (result.documentId === undefined && !documentId) {
    throw new Error("Google Docs did not confirm the document update.");
  }

  return {
    status: "completed",
    safeSummary: "The approved Google document was updated.",
    externalId: documentId,
    providerUrl: googleDocUrl(documentId),
    metadata: {
      connectorId: "google_docs",
      action: "update_external_record",
      externalType: "document",
      title: cleanString(existing.title, 220) ?? titleFromPayload(payload, "Google document"),
      providerUrl: googleDocUrl(documentId),
      mode,
    },
  };
}

export async function exportGoogleDocument(args: {
  accessToken: string;
  document: GoogleWorkspaceFileActionInput;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult> {
  return await exportGoogleDriveFile({
    accessToken: args.accessToken,
    file: args.document,
    request: args.request,
    connectorId: "google_docs",
    defaultMimeType: "text/plain",
  });
}

export async function createGoogleSpreadsheet(args: {
  accessToken: string;
  spreadsheet: GoogleWorkspaceFileActionInput;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult> {
  const payload = payloadRecord(args.spreadsheet);
  const title = titleFromPayload(payload, "FounderOS spreadsheet");
  const sheetName = firstPayloadString(payload, ["sheetName", "tabName"], 80) ?? "Sheet1";
  const values = sheetValuesFromPayload(payload);
  const created = await requestGoogleJson<GoogleSpreadsheetResponse>({
    request: args.request,
    input: apiUrl("/sheets/v4/spreadsheets"),
    init: {
      method: "POST",
      headers: {
        ...bearerHeaders(args.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: sheetName } }],
      }),
    },
    serviceName: "Google Sheets",
    action: "create spreadsheets",
  });
  const spreadsheetId = created.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets did not confirm the created spreadsheet.");

  await requestGoogleJson<GoogleSheetValuesResponse>({
    request: args.request,
    input: apiUrl(`/sheets/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeFromPayload(payload, sheetName))}`, {
      valueInputOption: "USER_ENTERED",
    }),
    init: {
      method: "PUT",
      headers: {
        ...bearerHeaders(args.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    },
    serviceName: "Google Sheets",
    action: "create spreadsheets",
  });
  await maybeMoveDriveFile({
    accessToken: args.accessToken,
    fileId: spreadsheetId,
    folderId: optionalFolderId(payload),
    request: args.request,
  });

  return {
    status: "completed",
    safeSummary: "The approved spreadsheet was created in Google Sheets.",
    externalId: spreadsheetId,
    providerUrl: created.spreadsheetUrl ?? googleSheetUrl(spreadsheetId),
    metadata: {
      connectorId: "google_sheets",
      action: "write_record",
      externalType: "spreadsheet",
      title,
      providerUrl: created.spreadsheetUrl ?? googleSheetUrl(spreadsheetId),
      updatedRange: rangeFromPayload(payload, sheetName),
    },
  };
}

export async function updateGoogleSpreadsheet(args: {
  accessToken: string;
  spreadsheet: GoogleWorkspaceFileActionInput;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult> {
  const payload = payloadRecord(args.spreadsheet);
  const spreadsheetId = requiredGoogleId(payload, ["spreadsheetId", "sheetId", "fileId", "id"], "Choose the Google spreadsheet before FounderOS updates it.");
  const values = sheetValuesFromPayload(payload);
  const mode = updateModeFromPayload(payload);
  const range = rangeFromPayload(payload);
  const method = mode === "append" ? "POST" : "PUT";
  const suffix = mode === "append" ? `${encodeURIComponent(range)}:append` : encodeURIComponent(range);
  const result = await requestGoogleJson<GoogleSheetValuesResponse>({
    request: args.request,
    input: apiUrl(`/sheets/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${suffix}`, {
      valueInputOption: "USER_ENTERED",
      insertDataOption: mode === "append" ? "INSERT_ROWS" : undefined,
    }),
    init: {
      method,
      headers: {
        ...bearerHeaders(args.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    },
    serviceName: "Google Sheets",
    action: "update spreadsheets",
  });
  const updatedRange = result.updatedRange ?? result.updates?.updatedRange ?? result.tableRange ?? range;

  return {
    status: "completed",
    safeSummary: "The approved Google spreadsheet was updated.",
    externalId: spreadsheetId,
    providerUrl: googleSheetUrl(spreadsheetId),
    metadata: {
      connectorId: "google_sheets",
      action: "update_external_record",
      externalType: "spreadsheet",
      providerUrl: googleSheetUrl(spreadsheetId),
      updatedRange,
      mode,
    },
  };
}

export async function exportGoogleSpreadsheet(args: {
  accessToken: string;
  spreadsheet: GoogleWorkspaceFileActionInput;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult> {
  return await exportGoogleDriveFile({
    accessToken: args.accessToken,
    file: args.spreadsheet,
    request: args.request,
    connectorId: "google_sheets",
    defaultMimeType: "text/csv",
  });
}

export async function executeGoogleWorkspaceFileAction(args: {
  accessToken: string;
  connectorId: "google_drive" | "google_docs" | "google_sheets";
  actionType: string;
  payload: unknown;
  request: ConnectorRequest;
}): Promise<GoogleWorkspaceActionResult | null> {
  const payload = payloadRecord(args.payload);

  if (args.connectorId === "google_drive") {
    if (args.actionType === "write_record") {
      return await createGoogleDriveFile({ accessToken: args.accessToken, file: payload, request: args.request });
    }
    if (args.actionType === "export_content") {
      return await exportGoogleDriveFile({ accessToken: args.accessToken, file: payload, request: args.request });
    }
    if (args.actionType === "update_external_record") {
      return await updateGoogleDriveFile({ accessToken: args.accessToken, file: payload, request: args.request });
    }
  }

  if (args.connectorId === "google_docs") {
    if (args.actionType === "write_record") {
      return await createGoogleDocument({ accessToken: args.accessToken, document: payload, request: args.request });
    }
    if (args.actionType === "export_content") {
      return await exportGoogleDocument({ accessToken: args.accessToken, document: payload, request: args.request });
    }
    if (args.actionType === "update_external_record") {
      return await updateGoogleDocument({ accessToken: args.accessToken, document: payload, request: args.request });
    }
  }

  if (args.connectorId === "google_sheets") {
    if (args.actionType === "write_record") {
      return await createGoogleSpreadsheet({ accessToken: args.accessToken, spreadsheet: payload, request: args.request });
    }
    if (args.actionType === "export_content") {
      return await exportGoogleSpreadsheet({ accessToken: args.accessToken, spreadsheet: payload, request: args.request });
    }
    if (args.actionType === "update_external_record") {
      return await updateGoogleSpreadsheet({ accessToken: args.accessToken, spreadsheet: payload, request: args.request });
    }
  }

  return null;
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
