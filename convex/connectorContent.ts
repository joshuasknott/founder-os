export type ConnectorImportKind =
  | "doc"
  | "email"
  | "record"
  | "conversation"
  | "brief"
  | "plan"
  | "research"
  | "upload";

export type ConnectorContentFormat = "markdown" | "plain_text" | "html" | "json" | "external";

export type ConnectorImportInput = {
  connectorId: string;
  connectorName: string;
  workspaceId?: unknown;
  departmentId?: unknown;
  externalId: string;
  externalType?: string;
  title?: string;
  content?: string;
  summary?: string;
  sourceUrl?: string;
  authorName?: string;
  mimeType?: string;
  kind?: ConnectorImportKind;
  format?: ConnectorContentFormat;
  tags?: string[];
  sourceName?: string;
  externalCreatedAt?: number;
  externalUpdatedAt?: number;
  importedAt: number;
};

function cleanString(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return cleaned || undefined;
}

function cleanContent(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim();
}

function cleanUrl(value: unknown) {
  const cleaned = cleanString(value, 500);
  if (!cleaned) return undefined;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function safeExternalId(connectorId: string, externalId: string) {
  const cleanId = cleanString(externalId, 180);
  if (!cleanId) throw new Error("Imported content needs a source id.");
  return `${connectorId}:${cleanId}`;
}

function summarizeContent(content: string, fallback?: string) {
  const explicit = cleanString(fallback, 280);
  if (explicit) return explicit;
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "Imported into Library.";
  const sentence = normalized.match(/^.{40,220}?[.!?](?:\s|$)/)?.[0]?.trim();
  if (sentence) return sentence;
  const summary = normalized.slice(0, 180).trim();
  return summary.length < normalized.length ? `${summary.replace(/[,\s]+$/, "")}...` : summary;
}

function inferTitle(args: { title?: string; sourceName?: string; sourceUrl?: string; externalId: string }) {
  const explicit = cleanString(args.title);
  if (explicit) return explicit;
  const sourceName = cleanString(args.sourceName);
  if (sourceName) return sourceName;
  if (args.sourceUrl) {
    try {
      const url = new URL(args.sourceUrl);
      const lastPath = url.pathname.split("/").filter(Boolean).pop();
      return lastPath?.replace(/[-_]+/g, " ") || url.hostname.replace(/^www\./, "");
    } catch {
      return args.sourceUrl;
    }
  }
  return cleanString(args.externalId, 80) ?? "Imported item";
}

function inferKind(connectorId: string, externalType?: string): ConnectorImportKind {
  const type = `${connectorId} ${externalType ?? ""}`.toLowerCase();
  if (type.includes("slack") || type.includes("message") || type.includes("channel")) return "conversation";
  if (type.includes("notion") || type.includes("page") || type.includes("database")) return "record";
  if (type.includes("brief")) return "brief";
  if (type.includes("plan")) return "plan";
  if (type.includes("research")) return "research";
  if (type.includes("file") || type.includes("pdf") || type.includes("sheet") || type.includes("slide")) return "upload";
  return "doc";
}

function uniqueTags(tags: Array<string | undefined>) {
  return Array.from(
    new Set(
      tags
        .map((tag) => cleanString(tag, 40)?.toLowerCase())
        .filter((tag): tag is string => Boolean(tag)),
    ),
  ).slice(0, 10);
}

export function buildConnectorSearchText(args: {
  title: string;
  summary: string;
  content: string;
  connectorName: string;
  sourceName?: string;
  sourceUrl?: string;
  tags?: string[];
}) {
  return [
    args.title,
    args.summary,
    args.content,
    args.connectorName,
    args.sourceName,
    args.sourceUrl,
    ...(args.tags ?? []),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function buildConnectorImport(args: ConnectorImportInput) {
  const content = cleanContent(args.content);
  const sourceUrl = cleanUrl(args.sourceUrl);
  const sourceName = cleanString(args.sourceName);
  const connectorName = cleanString(args.connectorName, 80) ?? "Connected service";
  const title = inferTitle({
    title: args.title,
    sourceName,
    sourceUrl,
    externalId: args.externalId,
  });
  const summary = summarizeContent(content, args.summary);
  const kind = args.kind ?? inferKind(args.connectorId, args.externalType);
  const externalId = safeExternalId(args.connectorId, args.externalId);
  const tags = uniqueTags([
    "connected",
    args.connectorId.replace(/_/g, " "),
    args.externalType,
    ...(args.tags ?? []),
  ]);
  const searchText = buildConnectorSearchText({
    title,
    summary,
    content,
    connectorName,
    sourceName,
    sourceUrl,
    tags,
  });

  return {
    title,
    kind,
    status: "active" as const,
    source: "connector" as const,
    author: cleanString(args.authorName, 120) ?? connectorName,
    summary,
    content,
    format: args.format ?? (content ? "markdown" as const : "external" as const),
    sourceUrl,
    externalId,
    mimeType: cleanString(args.mimeType, 120),
    tags,
    metadata: {
      connector: {
        connectorId: args.connectorId,
        name: connectorName,
        externalId: cleanString(args.externalId, 180),
        externalType: cleanString(args.externalType, 80),
        sourceName,
        importedAt: args.importedAt,
        lastSyncedAt: args.importedAt,
        externalCreatedAt: args.externalCreatedAt,
        externalUpdatedAt: args.externalUpdatedAt,
      },
      searchText,
    },
  };
}
