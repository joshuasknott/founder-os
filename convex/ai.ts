import { calculateCostUSD } from "./pricing.config";

const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_DEEPSEEK_REASONING_MODEL = "deepseek-reasoner";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;

type RoutePurpose = "standard" | "reasoning" | "creative" | "long-context";

export type CoreAIUseCase =
  | "chat"
  | "classification"
  | "summarization"
  | "embedding"
  | "item_edit"
  | "entity_fact_extraction"
  | "workflow_suggestion"
  | "greeting";

export type CoreAIUsage = {
  useCase: CoreAIUseCase;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  tokensUsed: number;
  costUSD: number;
  model: string;
};

export type CoreAIResult<T = string> = {
  content: string;
  parsed?: T;
  usage: CoreAIUsage;
};

export type CoreAIUsageHook = (usage: CoreAIUsage) => void | Promise<void>;

type StructuredOutputOptions<T> = {
  useCase: Exclude<CoreAIUseCase, "embedding">;
  tier?: number;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  schemaDescription: string;
  fallback: T;
  validate?: (value: unknown) => T | undefined;
  onUsage?: CoreAIUsageHook;
};

type TextOutputOptions = {
  useCase: Exclude<CoreAIUseCase, "embedding">;
  tier?: number;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  onUsage?: CoreAIUsageHook;
};

type DeepSeekChoice = {
  message?: {
    content?: string;
  };
};

type ProviderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type DeepSeekResponse = {
  choices?: DeepSeekChoice[];
  usage?: ProviderUsage;
  error?: {
    message?: string;
  };
};

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  embeddings?: Array<{
    values?: number[];
  }>;
  embedding?: {
    values?: number[];
  };
  usageMetadata?: GeminiUsage;
  error?: {
    message?: string;
  };
};

export type CoreTaskClassification = {
  category: "build" | "document" | "design" | "communication" | "schedule" | "data" | "generic";
  workerKind: "builder" | "document" | "design" | "communications" | "generic";
  confidence: number;
  requiresReview: boolean;
  reasoning: string;
};

export type CoreEntityFactExtraction = {
  entities: Array<{
    name: string;
    type: "person" | "company" | "product" | "project" | "topic" | "other";
    confidence: number;
  }>;
  facts: Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
  }>;
};

export type CoreWorkflowSuggestion = {
  title: string;
  summary: string;
  steps: Array<{
    title: string;
    kind: "prompt" | "review" | "connector_action" | "wait";
    requiresApproval: boolean;
  }>;
};

export type CoreItemEdit = {
  title?: string;
  summary: string;
  content: string;
  changeNote: string;
};

function routePurpose(tier: number, useCase: CoreAIUseCase): RoutePurpose {
  if (useCase === "workflow_suggestion" || tier === 4) return "reasoning";
  if (useCase === "summarization" || tier === 3) return "long-context";
  if (useCase === "item_edit" || useCase === "greeting" || tier === 2) return "creative";
  return "standard";
}

function deepSeekModelForPurpose(purpose: RoutePurpose): string {
  if (purpose === "reasoning") {
    return process.env.DEEPSEEK_REASONING_MODEL ?? DEFAULT_DEEPSEEK_REASONING_MODEL;
  }
  return process.env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_MODEL;
}

function safeModelLabel(useCase: CoreAIUseCase) {
  return `core:${useCase}`;
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function usageFromProvider(args: {
  useCase: CoreAIUseCase;
  latencyMs: number;
  model: string;
  inputText: string;
  outputText: string;
  usage?: ProviderUsage | GeminiUsage;
}): CoreAIUsage {
  const providerUsage = args.usage as ProviderUsage & GeminiUsage | undefined;
  const inputTokens =
    providerUsage?.prompt_tokens ??
    providerUsage?.promptTokenCount ??
    estimateTokens(args.inputText);
  const outputTokens =
    providerUsage?.completion_tokens ??
    providerUsage?.candidatesTokenCount ??
    estimateTokens(args.outputText);
  const tokensUsed =
    providerUsage?.total_tokens ??
    providerUsage?.totalTokenCount ??
    inputTokens + outputTokens;

  return {
    useCase: args.useCase,
    latencyMs: args.latencyMs,
    inputTokens,
    outputTokens,
    tokensUsed,
    costUSD: calculateCostUSD(args.model, inputTokens, outputTokens),
    model: safeModelLabel(args.useCase),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function fallbackEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (let i = 0; i < text.length; i++) {
    const index = i % vector.length;
    vector[index] += ((text.charCodeAt(i) % 31) - 15) / 15;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function normalizeEmbedding(values: number[]) {
  if (values.length === EMBEDDING_DIMENSIONS) return values;
  if (values.length > EMBEDDING_DIMENSIONS) return values.slice(0, EMBEDDING_DIMENSIONS);
  return [...values, ...new Array<number>(EMBEDDING_DIMENSIONS - values.length).fill(0)];
}

function safeErrorText(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.startsWith("FounderOS could not reach the AI service yet.")) {
    return raw;
  }

  const cleaned = raw
    .replace(/https?:\/\/\S+/gi, "the AI service")
    .replace(/\b(?:deepseek|gemini|openai|gpt|claude|mistral|llama)[-\w.]*/gi, "AI")
    .replace(/\b(?:api|sdk|http|json|stack|trace|fetch|token|bearer|key|model)\b/gi, "service")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !cleaned ||
    cleaned.length > 140 ||
    /[{}[\]<>]/.test(cleaned) ||
    /\b(service\s+){2,}/i.test(cleaned)
  ) {
    return "FounderOS could not reach the AI service yet. Check Settings, then try again.";
  }

  return `FounderOS could not reach the AI service yet. ${cleaned}`;
}

export function safeAIErrorMessage(error: unknown) {
  return safeErrorText(error);
}

async function callDeepSeek(
  options: TextOutputOptions & { structured?: boolean },
): Promise<CoreAIResult> {
  const startedAt = Date.now();
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Primary AI key is not configured.");

  const purpose = routePurpose(options.tier ?? 1, options.useCase);
  const model = deepSeekModelForPurpose(purpose);
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt },
      ],
      temperature: options.temperature ?? (purpose === "creative" ? 0.7 : 0.2),
      ...(options.maxOutputTokens ? { max_tokens: options.maxOutputTokens } : {}),
      ...(options.structured ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const data = await readJson<DeepSeekResponse>(response);

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Primary AI request failed (${response.status}).`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Primary AI returned no content.");

  return {
    content,
    usage: usageFromProvider({
      useCase: options.useCase,
      latencyMs: Date.now() - startedAt,
      model,
      inputText: `${options.systemPrompt}\n${options.userPrompt}`,
      outputText: content,
      usage: data.usage,
    }),
  };
}

async function callGemini(
  options: TextOutputOptions & { structured?: boolean },
): Promise<CoreAIResult> {
  const startedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Backup AI key is not configured.");

  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: options.userPrompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
          ...(options.structured ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  const data = await readJson<GeminiResponse>(response);

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Backup AI request failed (${response.status}).`);
  }

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) throw new Error("Backup AI returned no content.");

  return {
    content,
    usage: usageFromProvider({
      useCase: options.useCase,
      latencyMs: Date.now() - startedAt,
      model,
      inputText: `${options.systemPrompt}\n${options.userPrompt}`,
      outputText: content,
      usage: data.usageMetadata,
    }),
  };
}

async function runText(options: TextOutputOptions & { structured?: boolean }): Promise<CoreAIResult> {
  let lastError: unknown;

  try {
    const result = await callDeepSeek(options);
    await options.onUsage?.(result.usage);
    return result;
  } catch (error) {
    lastError = error;
  }

  try {
    const result = await callGemini(options);
    await options.onUsage?.(result.usage);
    return result;
  } catch (error) {
    lastError = error;
  }

  throw new Error(safeErrorText(lastError));
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim();
  const candidate = fenced ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstObject = candidate.indexOf("{");
    const lastObject = candidate.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(candidate.slice(firstObject, lastObject + 1));
    }
    throw new Error("The AI service returned an unusable structured response.");
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function clampConfidence(value: unknown) {
  return Math.max(0, Math.min(1, numberValue(value, 0.5)));
}

async function runStructured<T>(options: StructuredOutputOptions<T>): Promise<CoreAIResult<T>> {
  const result = await runText({
    useCase: options.useCase,
    tier: options.tier,
    systemPrompt: [
      options.systemPrompt,
      "",
      `Return only valid JSON for ${options.schemaName}.`,
      options.schemaDescription,
      "Do not include markdown, comments, provider names, or implementation details.",
    ].join("\n"),
    userPrompt: options.userPrompt,
    temperature: 0.1,
    structured: true,
    onUsage: options.onUsage,
  });

  try {
    const parsed = parseJsonObject(result.content);
    return {
      ...result,
      parsed: options.validate?.(parsed) ?? (parsed as T),
    };
  } catch {
    return {
      ...result,
      parsed: options.fallback,
    };
  }
}

export async function executeChat(args: {
  tier: number;
  systemPrompt: string;
  userPrompt: string;
  onUsage?: CoreAIUsageHook;
}) {
  return await runText({
    useCase: "chat",
    tier: args.tier,
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    onUsage: args.onUsage,
  });
}

export async function executeAITask(
  tier: number,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  try {
    return (await executeChat({ tier, systemPrompt, userPrompt })).content;
  } catch (error) {
    return safeErrorText(error);
  }
}

export async function executeGreeting(args?: { onUsage?: CoreAIUsageHook }) {
  return await runText({
    useCase: "greeting",
    tier: 2,
    systemPrompt: `You generate a single short greeting or motivational line for a founder opening their business workspace.
Requirements:
- Maximum 10 words
- No quotes, no emoji, no punctuation except periods or question marks
- Vary between a warm greeting, a motivational nudge, a thought-provoking question, or a fun founder-relevant insight
- Be conversational, not corporate
- Output only the line`,
    userPrompt: `Generate one greeting. Current time context: ${new Date().toLocaleString("en-US", {
      weekday: "long",
      hour: "numeric",
      hour12: true,
    })}`,
    temperature: 1.2,
    maxOutputTokens: 30,
    onUsage: args?.onUsage,
  });
}

export async function summarizeText(args: {
  text: string;
  purpose?: string;
  onUsage?: CoreAIUsageHook;
}) {
  return await runStructured<{ summary: string; keyPoints: string[] }>({
    useCase: "summarization",
    tier: 3,
    systemPrompt: "Summarize founder workspace material into concise, decision-useful notes.",
    userPrompt: [`Purpose: ${args.purpose ?? "general workspace summary"}`, "", args.text].join("\n"),
    schemaName: "SummaryResult",
    schemaDescription: `{"summary":"one paragraph","keyPoints":["short bullet"]}`,
    fallback: { summary: args.text.slice(0, 240), keyPoints: [] },
    validate: (value) => {
      const record = asRecord(value);
      if (!record) return undefined;
      return {
        summary: stringValue(record.summary) ?? args.text.slice(0, 240),
        keyPoints: Array.isArray(record.keyPoints) ? record.keyPoints.map(stringValue).filter(Boolean) as string[] : [],
      };
    },
    onUsage: args.onUsage,
  });
}

export async function classifyText(args: {
  title?: string;
  text: string;
  onUsage?: CoreAIUsageHook;
}) {
  return await runStructured<CoreTaskClassification>({
    useCase: "classification",
    tier: 1,
    systemPrompt: "Classify a founder task for routing. Prefer conservative routing and require review for external or live changes.",
    userPrompt: [`Title: ${args.title ?? "Untitled"}`, `Text: ${args.text}`].join("\n"),
    schemaName: "TaskClassification",
    schemaDescription: `{"category":"build|document|design|communication|schedule|data|generic","workerKind":"builder|document|design|communications|generic","confidence":0.0,"requiresReview":false,"reasoning":"short reason"}`,
    fallback: {
      category: "generic",
      workerKind: "generic",
      confidence: 0.35,
      requiresReview: false,
      reasoning: "Fallback classification.",
    },
    validate: validateTaskClassification,
    onUsage: args.onUsage,
  });
}

function validateTaskClassification(value: unknown): CoreTaskClassification | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const category = stringValue(record.category);
  const workerKind = stringValue(record.workerKind);
  const categories = new Set(["build", "document", "design", "communication", "schedule", "data", "generic"]);
  const workers = new Set(["builder", "document", "design", "communications", "generic"]);
  if (!category || !categories.has(category) || !workerKind || !workers.has(workerKind)) return undefined;

  return {
    category: category as CoreTaskClassification["category"],
    workerKind: workerKind as CoreTaskClassification["workerKind"],
    confidence: clampConfidence(record.confidence),
    requiresReview: booleanValue(record.requiresReview, false),
    reasoning: stringValue(record.reasoning) ?? "Classified by FounderOS.",
  };
}

export async function editItemContent(args: {
  title?: string;
  currentContent: string;
  instruction: string;
  onUsage?: CoreAIUsageHook;
}) {
  return await runStructured<CoreItemEdit>({
    useCase: "item_edit",
    tier: 2,
    systemPrompt: "Edit a saved FounderOS Library item. Preserve meaning unless the instruction explicitly changes it.",
    userPrompt: [
      `Title: ${args.title ?? "Untitled"}`,
      `Instruction: ${args.instruction}`,
      "",
      args.currentContent,
    ].join("\n"),
    schemaName: "ItemEdit",
    schemaDescription: `{"title":"optional revised title","summary":"plain summary","content":"full revised content","changeNote":"short note"}`,
    fallback: {
      title: args.title,
      summary: "No edit was applied.",
      content: args.currentContent,
      changeNote: "FounderOS could not prepare a structured edit.",
    },
    validate: (value) => {
      const record = asRecord(value);
      const content = stringValue(record?.content);
      if (!record || !content) return undefined;
      return {
        title: stringValue(record.title),
        summary: stringValue(record.summary) ?? "Updated Library item.",
        content,
        changeNote: stringValue(record.changeNote) ?? "Updated from instruction.",
      };
    },
    onUsage: args.onUsage,
  });
}

export async function extractEntitiesAndFacts(args: {
  text: string;
  onUsage?: CoreAIUsageHook;
}) {
  return await runStructured<CoreEntityFactExtraction>({
    useCase: "entity_fact_extraction",
    tier: 1,
    systemPrompt: "Extract only concrete people, companies, projects, topics, and durable facts from founder workspace text.",
    userPrompt: args.text,
    schemaName: "EntityFactExtraction",
    schemaDescription: `{"entities":[{"name":"string","type":"person|company|product|project|topic|other","confidence":0.0}],"facts":[{"subject":"string","predicate":"string","object":"string","confidence":0.0}]}`,
    fallback: { entities: [], facts: [] },
    validate: validateEntityFactExtraction,
    onUsage: args.onUsage,
  });
}

function validateEntityFactExtraction(value: unknown): CoreEntityFactExtraction | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const entityTypes = new Set(["person", "company", "product", "project", "topic", "other"]);
  const entities = Array.isArray(record.entities)
    ? record.entities.flatMap((entry) => {
        const item = asRecord(entry);
        const name = stringValue(item?.name);
        const type = stringValue(item?.type);
        if (!item || !name || !type || !entityTypes.has(type)) return [];
        return [{ name, type: type as CoreEntityFactExtraction["entities"][number]["type"], confidence: clampConfidence(item.confidence) }];
      })
    : [];
  const facts = Array.isArray(record.facts)
    ? record.facts.flatMap((entry) => {
        const item = asRecord(entry);
        const subject = stringValue(item?.subject);
        const predicate = stringValue(item?.predicate);
        const object = stringValue(item?.object);
        if (!item || !subject || !predicate || !object) return [];
        return [{ subject, predicate, object, confidence: clampConfidence(item.confidence) }];
      })
    : [];
  return { entities, facts };
}

export async function suggestWorkflow(args: {
  objective: string;
  context?: string;
  onUsage?: CoreAIUsageHook;
}) {
  return await runStructured<CoreWorkflowSuggestion>({
    useCase: "workflow_suggestion",
    tier: 4,
    systemPrompt: "Suggest a safe FounderOS workflow. External actions, spending, publishing, sending messages, and deletion need approval steps.",
    userPrompt: [`Objective: ${args.objective}`, args.context ? `Context: ${args.context}` : ""].filter(Boolean).join("\n"),
    schemaName: "WorkflowSuggestion",
    schemaDescription: `{"title":"string","summary":"string","steps":[{"title":"string","kind":"prompt|review|connector_action|wait","requiresApproval":false}]}`,
    fallback: {
      title: "Review request",
      summary: "FounderOS can turn this into a task after review.",
      steps: [{ title: "Review the request", kind: "review", requiresApproval: false }],
    },
    validate: validateWorkflowSuggestion,
    onUsage: args.onUsage,
  });
}

function validateWorkflowSuggestion(value: unknown): CoreWorkflowSuggestion | undefined {
  const record = asRecord(value);
  const title = stringValue(record?.title);
  if (!record || !title) return undefined;
  const stepKinds = new Set(["prompt", "review", "connector_action", "wait"]);
  const steps = Array.isArray(record.steps)
    ? record.steps.flatMap((entry) => {
        const item = asRecord(entry);
        const stepTitle = stringValue(item?.title);
        const kind = stringValue(item?.kind);
        if (!item || !stepTitle || !kind || !stepKinds.has(kind)) return [];
        return [{
          title: stepTitle,
          kind: kind as CoreWorkflowSuggestion["steps"][number]["kind"],
          requiresApproval: booleanValue(item.requiresApproval, kind === "connector_action"),
        }];
      })
    : [];

  return {
    title,
    summary: stringValue(record.summary) ?? "Suggested workflow.",
    steps,
  };
}

export async function executeEmbedding(
  text: string,
  args?: { onUsage?: CoreAIUsageHook },
): Promise<number[]> {
  return (await executeEmbeddingWithUsage(text, args)).embedding;
}

export async function executeEmbeddingWithUsage(
  text: string,
  args?: { onUsage?: CoreAIUsageHook },
): Promise<{ embedding: number[]; usage: CoreAIUsage }> {
  const startedAt = Date.now();
  const model = process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_GEMINI_EMBEDDING_MODEL;
  const fallbackUsage = (outputText = "") =>
    usageFromProvider({
      useCase: "embedding",
      latencyMs: Date.now() - startedAt,
      model,
      inputText: text,
      outputText,
      usage: { prompt_tokens: estimateTokens(text), completion_tokens: 0 },
    });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const usage = fallbackUsage();
    await args?.onUsage?.(usage);
    return { embedding: fallbackEmbedding(text), usage };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
      },
    );

    const data = await readJson<GeminiResponse>(response);
    if (!response.ok) {
      const usage = fallbackUsage();
      await args?.onUsage?.(usage);
      return { embedding: fallbackEmbedding(text), usage };
    }

    const values = data.embedding?.values ?? data.embeddings?.[0]?.values;
    const usage = fallbackUsage(values ? "embedding" : "");
    await args?.onUsage?.(usage);
    return { embedding: values?.length ? normalizeEmbedding(values) : fallbackEmbedding(text), usage };
  } catch {
    const usage = fallbackUsage();
    await args?.onUsage?.(usage);
    return { embedding: fallbackEmbedding(text), usage };
  }
}
