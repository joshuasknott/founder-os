export type DocumentContextSensitivity = "public" | "low" | "internal" | "confidential" | "restricted";

export type DocumentContextCandidate = {
  id: string;
  title: string;
  summary?: string;
  content: string;
  status: string;
  metadata?: unknown;
};

const SENSITIVITY_RANK: Record<DocumentContextSensitivity, number> = {
  public: 0,
  low: 1,
  internal: 2,
  confidential: 3,
  restricted: 4,
};

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "brief", "create", "draft", "document", "for",
  "from", "into", "memo", "plan", "proposal", "sop", "strategy", "that", "the",
  "this", "with", "write",
]);

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeSensitivity(value: unknown): DocumentContextSensitivity {
  return value === "public" || value === "low" || value === "internal" ||
    value === "confidential" || value === "restricted"
    ? value
    : "internal";
}

function inferSensitivity(value: string): DocumentContextSensitivity {
  const text = value.toLowerCase();
  if (/\b(api[_ -]?key|secret|password|bearer|private key|refresh token|access token)\b/.test(text)) return "restricted";
  if (/\b(bank|payroll|salary|tax|legal|contract|nda|cap table|investor|runway|revenue|invoice|customer list|health)\b/.test(text)) return "confidential";
  return "internal";
}

function maxSensitivity(left: DocumentContextSensitivity, right: DocumentContextSensitivity) {
  return SENSITIVITY_RANK[left] >= SENSITIVITY_RANK[right] ? left : right;
}

function tokens(value: string) {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  )];
}

export function contextSensitivity(candidate: DocumentContextCandidate) {
  const metadata = metadataObject(candidate.metadata);
  return maxSensitivity(
    normalizeSensitivity(metadata.sensitivity),
    inferSensitivity(`${candidate.title}\n${candidate.summary ?? ""}\n${candidate.content}`),
  );
}

export function canUseLibraryContext(
  candidate: DocumentContextCandidate,
  requestSensitivity: DocumentContextSensitivity,
) {
  const metadata = metadataObject(candidate.metadata);
  const explicitlyAllowed = metadata.documentContextAllowed === true;
  if (metadata.documentContextAllowed === false || metadata.private === true) return false;
  if (!explicitlyAllowed && candidate.status !== "approved" && candidate.status !== "finalized") return false;

  const sensitivity = contextSensitivity(candidate);
  if (sensitivity === "restricted") return false;
  return SENSITIVITY_RANK[sensitivity] <= SENSITIVITY_RANK[requestSensitivity];
}

export function contextRelevanceScore(queryText: string, candidate: DocumentContextCandidate) {
  const queryTokens = tokens(queryText);
  if (queryTokens.length === 0) return 0;
  const title = candidate.title.toLowerCase();
  const body = `${candidate.summary ?? ""}\n${candidate.content}`.toLowerCase();
  return queryTokens.reduce((score, token) => (
    score + (title.includes(token) ? 4 : 0) + (body.includes(token) ? 1 : 0)
  ), 0);
}

export function selectDocumentContextCandidates(args: {
  queryText: string;
  requestSensitivity: DocumentContextSensitivity;
  candidates: DocumentContextCandidate[];
  limit?: number;
  excerptLength?: number;
}) {
  const limit = args.limit ?? 4;
  const excerptLength = args.excerptLength ?? 1200;
  return args.candidates
    .filter((candidate) => canUseLibraryContext(candidate, args.requestSensitivity))
    .map((candidate) => ({
      ...candidate,
      score: contextRelevanceScore(args.queryText, candidate),
      sensitivity: contextSensitivity(candidate),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit)
    .map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      summary: candidate.summary,
      excerpt: candidate.content.slice(0, excerptLength),
      sensitivity: candidate.sensitivity,
  }));
}
