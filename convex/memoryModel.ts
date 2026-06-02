export type MemoryType =
  | "founder_preference"
  | "business_fact"
  | "decision"
  | "recurring_workflow"
  | "person"
  | "company"
  | "product"
  | "reusable_context";

export type MemorySensitivity = "public" | "internal" | "confidential" | "sensitive";
export type MemoryPurpose = "chat" | "document" | "workflow" | "builder";

export type MemoryCandidate = {
  type: MemoryType;
  label: string;
  value: string;
  sensitivity: MemorySensitivity;
  canonicalKey: string;
  searchText: string;
};

export type MemoryRecord = MemoryCandidate & {
  _id?: string;
  status?: "active" | "deleted";
  updatedAt?: number;
  sourceAllowed?: boolean;
};

const SENSITIVITY_RANK: Record<MemorySensitivity, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  sensitive: 3,
};

const STOP_WORDS = new Set([
  "about", "after", "always", "and", "are", "business", "company", "context",
  "create", "decided", "details", "for", "founder", "from", "into", "our",
  "remember", "should", "that", "the", "this", "use", "we", "with",
]);

const SECRET_PATTERNS = [
  /\b(?:api[_ -]?key|secret|password|passwd|token|client[_ -]?secret|private[_ -]?key|access[_ -]?token|refresh[_ -]?token|auth(?:orization)?[_ -]?token)\b\s*[:=]\s*(?:"[^"]+"|'[^']+'|[^\s,;]+)/gi,
  /\bbearer\s+[a-z0-9._~+/=-]{12,}/gi,
  /\b(?:sk|pk)_(?:live|test)_[a-z0-9]{12,}\b/gi,
  /\bsk-[a-z0-9_-]{12,}\b/gi,
  /\bgh[pousr]_[a-z0-9]{20,}\b/gi,
  /\bgithub_pat_[a-z0-9_]{20,}\b/gi,
  /\beyj[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/gi,
  /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s/]+@/gi,
];

const CONFIDENTIAL_PATTERN =
  /\b(bank|banking|payroll|salary|compensation|tax|legal|contract|nda|cap table|investor|fundraising|runway|revenue|invoice|customer list|customer data|personal data|health|medical)\b/i;
const SENSITIVE_PATTERN =
  /\b(ssn|social security|passport|driver'?s license|date of birth|dob|home address|credit card|card number|bank account|routing number)\b/i;

const MEMORY_RULES: Array<{
  type: MemoryType;
  pattern: RegExp;
  label: string;
}> = [
  {
    type: "founder_preference",
    pattern: /\b(?:i|we)\s+prefer\b|\bplease\s+always\b|\balways\s+use\b|\bdefault\s+to\b|\bavoid\b|\bdo not\b|\bdon't\b/i,
    label: "Working preference",
  },
  {
    type: "decision",
    pattern: /\b(?:we\s+)?decided\b|\bdecision\s*:\s*|\bwe\s+chose\b|\bwe\s+will\s+use\b/i,
    label: "Decision",
  },
  {
    type: "recurring_workflow",
    pattern: /\b(?:daily|weekly|monthly|quarterly|every\s+(?:day|week|month|quarter|monday|tuesday|wednesday|thursday|friday)|each\s+(?:day|week|month|quarter)|recurring|workflow|standard operating procedure|sop)\b/i,
    label: "Recurring workflow",
  },
  {
    type: "reusable_context",
    pattern: /\b(?:remember|for future|reuse|reusable context|keep in mind|standing context)\b/i,
    label: "Reusable context",
  },
  {
    type: "business_fact",
    pattern: /\b(?:our|the)\s+(?:business|company|product|customer|audience|market|price|pricing|plan|goal|domain|website|launch|deadline|mrr|arr|runway)\b.*\b(?:is|are|uses?|targets?|costs?|launches?|ends?)\b/i,
    label: "Business fact",
  },
];

const ENTITY_RULES: Array<{
  type: Extract<MemoryType, "person" | "company" | "product">;
  pattern: RegExp;
  label: string;
}> = [
  {
    type: "person",
    pattern: /\b(?:person|contact|founder|customer|partner|advisor|investor|owner)\s*:\s*([^.;,\n]{2,80})/i,
    label: "Person",
  },
  {
    type: "company",
    pattern: /\b(?:company|customer company|partner company|vendor|competitor)\s*:\s*([^.;,\n]{2,100})/i,
    label: "Company",
  },
  {
    type: "product",
    pattern: /\b(?:product|offer|service)\s*:\s*([^.;,\n]{2,100})/i,
    label: "Product",
  },
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedKeyPart(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9@._ -]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function lineValue(value: string) {
  return normalizeWhitespace(value.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, ""));
}

function memorySearchText(type: MemoryType, label: string, value: string) {
  return normalizeWhitespace(`${type.replace(/_/g, " ")} ${label} ${value}`).toLowerCase();
}

export function redactSecrets(value: string) {
  let text = value;
  let redacted = false;
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (match) => {
      redacted = true;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(match)) {
        return match.replace(/:\/\/[^@]+@/, "://[REDACTED]@");
      }
      const separator = match.match(/^([^:=]+[:=]\s*)/);
      return separator ? `${separator[1]}[REDACTED]` : "[REDACTED]";
    });
  }
  return { text, redacted };
}

export function containsSecretMaterial(value: string) {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

export function inferMemorySensitivity(value: string): MemorySensitivity {
  if (containsSecretMaterial(value) || SENSITIVE_PATTERN.test(value)) return "sensitive";
  if (CONFIDENTIAL_PATTERN.test(value)) return "confidential";
  return "internal";
}

export function selectedMemorySensitivity(
  inferred: MemorySensitivity,
  selected?: MemorySensitivity,
): MemorySensitivity {
  if (!selected) return inferred;
  if (inferred !== "confidential" && inferred !== "sensitive") return selected;
  return SENSITIVITY_RANK[inferred] >= SENSITIVITY_RANK[selected] ? inferred : selected;
}

export function memoryCanonicalKey(type: MemoryType, label: string, value: string) {
  return `${type}:${normalizedKeyPart(label)}:${normalizedKeyPart(value)}`;
}

export function createMemoryCandidate(
  type: MemoryType,
  label: string,
  value: string,
): MemoryCandidate | null {
  const cleanValue = lineValue(value);
  const cleanLabel = normalizeWhitespace(label).slice(0, 80);
  if (
    cleanValue.length < 6 ||
    cleanValue.length > 360 ||
    containsSecretMaterial(cleanValue) ||
    containsSecretMaterial(cleanLabel)
  ) return null;
  const sensitivity = inferMemorySensitivity(cleanValue);
  return {
    type,
    label: cleanLabel,
    value: cleanValue,
    sensitivity,
    canonicalKey: memoryCanonicalKey(type, cleanLabel, cleanValue),
    searchText: memorySearchText(type, cleanLabel, cleanValue),
  };
}

export function extractMemoryCandidates(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map(lineValue)
    .filter((line) => line.length >= 6 && line.length <= 360);
  const candidates: MemoryCandidate[] = [];

  for (const line of lines) {
    if (containsSecretMaterial(line)) continue;

    for (const rule of MEMORY_RULES) {
      if (!rule.pattern.test(line)) continue;
      const candidate = createMemoryCandidate(rule.type, rule.label, line);
      if (candidate) candidates.push(candidate);
      break;
    }

    for (const rule of ENTITY_RULES) {
      const match = line.match(rule.pattern);
      if (!match?.[1]) continue;
      const candidate = createMemoryCandidate(rule.type, rule.label, match[1]);
      if (candidate) candidates.push(candidate);
    }
  }

  return dedupeMemoryCandidates(candidates).slice(0, 24);
}

export function dedupeMemoryCandidates<T extends MemoryCandidate>(candidates: T[]) {
  const byKey = new Map<string, T>();
  for (const candidate of candidates) {
    if (!byKey.has(candidate.canonicalKey)) byKey.set(candidate.canonicalKey, candidate);
  }
  return Array.from(byKey.values());
}

function tokens(value: string) {
  return Array.from(new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9@._ -]+/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  ));
}

export function memoryIsActive(memory: MemoryRecord) {
  return memory.status !== "deleted";
}

export function canUseMemory(args: {
  memory: MemoryRecord;
  requestSensitivity: MemorySensitivity;
  memoryEnabled?: boolean;
  useMemory?: boolean;
}) {
  if (
    args.memoryEnabled === false ||
    args.useMemory === false ||
    args.memory.sourceAllowed === false ||
    !memoryIsActive(args.memory)
  ) return false;
  if (args.memory.sensitivity === "sensitive") return false;
  return SENSITIVITY_RANK[args.memory.sensitivity] <= SENSITIVITY_RANK[args.requestSensitivity];
}

export function memoryRelevanceScore(queryText: string, memory: MemoryRecord) {
  const queryTokens = tokens(queryText);
  if (queryTokens.length === 0) return 0;
  const title = `${memory.type} ${memory.label}`.toLowerCase();
  const body = `${memory.value} ${memory.searchText}`.toLowerCase();
  return queryTokens.reduce((score, token) => (
    score + (title.includes(token) ? 4 : 0) + (body.includes(token) ? 2 : 0)
  ), 0);
}

export function selectRelevantMemories(args: {
  queryText: string;
  purpose: MemoryPurpose;
  requestSensitivity: MemorySensitivity;
  memories: MemoryRecord[];
  memoryEnabled?: boolean;
  useMemory?: boolean;
  limit?: number;
}) {
  void args.purpose;
  return args.memories
    .filter((memory) => canUseMemory({
      memory,
      requestSensitivity: args.requestSensitivity,
      memoryEnabled: args.memoryEnabled,
      useMemory: args.useMemory,
    }))
    .map((memory) => ({ ...memory, score: memoryRelevanceScore(args.queryText, memory) }))
    .filter((memory) => memory.score > 0)
    .sort((left, right) => right.score - left.score || (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    .slice(0, args.limit ?? 8);
}

export function formatMemoryContext(memories: MemoryRecord[]) {
  if (memories.length === 0) return "";
  const lines = memories.map((memory) => {
    const { text } = redactSecrets(memory.value);
    return `- ${memory.label}: ${text}`;
  });
  return `Remembered business details:\n${lines.join("\n")}`;
}
