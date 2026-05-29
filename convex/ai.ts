import { internal } from "./_generated/api";

const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_DEEPSEEK_REASONING_MODEL = "deepseek-reasoner";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_EMBEDDING_MODEL = "text-embedding-004";
const RATE_LIMIT_RESCHEDULED = "[AI Router] 429 Rate Limit hit. Task rescheduled with exponential backoff.";

type RoutePurpose = "standard" | "reasoning" | "creative" | "long-context";

type RetryContext = {
  runQuery: (queryRef: unknown, args: Record<string, unknown>) => Promise<unknown>;
  scheduler: {
    runAfter: (delayMs: number, actionRef: unknown, args: Record<string, unknown>) => Promise<unknown>;
  };
};

type DeepSeekChoice = {
  message?: {
    content?: string;
  };
};

type DeepSeekResponse = {
  choices?: DeepSeekChoice[];
  error?: {
    message?: string;
  };
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
  error?: {
    message?: string;
  };
};

function isRetryContext(ctx: unknown): ctx is RetryContext {
  if (!ctx || typeof ctx !== "object") return false;
  const candidate = ctx as Record<string, unknown>;
  const scheduler = candidate.scheduler as Record<string, unknown> | undefined;
  return typeof candidate.runQuery === "function" && typeof scheduler?.runAfter === "function";
}

function routePurpose(tier: number): RoutePurpose {
  if (tier === 4) return "reasoning";
  if (tier === 3) return "long-context";
  if (tier === 2) return "creative";
  return "standard";
}

function deepSeekModelForPurpose(purpose: RoutePurpose): string {
  if (purpose === "reasoning") {
    return process.env.DEEPSEEK_REASONING_MODEL ?? DEFAULT_DEEPSEEK_REASONING_MODEL;
  }
  return process.env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_MODEL;
}

async function maybeReschedule(ctx: unknown, taskId: unknown): Promise<boolean> {
  if (!isRetryContext(ctx) || !taskId) return false;

  let retryCount = 0;
  try {
    const task = await ctx.runQuery(internal.engine.getTaskById, { taskId });
    if (task && typeof task === "object" && "retryCount" in task) {
      const value = (task as { retryCount?: unknown }).retryCount;
      retryCount = typeof value === "number" ? value : 0;
    }
  } catch {
    retryCount = 0;
  }

  const backoffMs = Math.min(Math.pow(2, retryCount) * 1000, 30000);
  await ctx.scheduler.runAfter(backoffMs, internal.engine.executeTask, { taskId });
  return true;
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

async function callDeepSeek(
  purpose: RoutePurpose,
  systemPrompt: string,
  userPrompt: string,
  ctx?: unknown,
  taskId?: unknown,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Primary AI key is not configured.");

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: deepSeekModelForPurpose(purpose),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: purpose === "creative" ? 0.7 : 0.2,
    }),
  });

  const data = await readJson<DeepSeekResponse>(response);

  if (!response.ok) {
    if (response.status === 429 && (await maybeReschedule(ctx, taskId))) {
      return RATE_LIMIT_RESCHEDULED;
    }
    throw new Error(data.error?.message ?? `Primary AI request failed (${response.status}).`);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Primary AI returned no content.");
  return content;
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  ctx?: unknown,
  taskId?: unknown,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Backup AI key is not configured.");

  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }),
    },
  );

  const data = await readJson<GeminiResponse>(response);

  if (!response.ok) {
    if (response.status === 429 && (await maybeReschedule(ctx, taskId))) {
      return RATE_LIMIT_RESCHEDULED;
    }
    throw new Error(data.error?.message ?? `Backup AI request failed (${response.status}).`);
  }

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) throw new Error("Backup AI returned no content.");
  return content;
}

function fallbackEmbedding(text: string): number[] {
  const vector = new Array<number>(768).fill(0);
  for (let i = 0; i < text.length; i++) {
    const index = i % vector.length;
    vector[index] += ((text.charCodeAt(i) % 31) - 15) / 15;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

export async function executeAITask(
  tier: number,
  systemPrompt: string,
  userPrompt: string,
  ctx?: unknown,
  taskId?: unknown,
): Promise<string> {
  const purpose = routePurpose(tier);

  try {
    return await callDeepSeek(purpose, systemPrompt, userPrompt, ctx, taskId);
  } catch {
    try {
      return await callGemini(systemPrompt, userPrompt, ctx, taskId);
    } catch {
      return [
        "I could not reach the AI service yet.",
        "Add the primary or backup AI key in Settings, then try again.",
      ].join("\n");
    }
  }
}

export async function executeEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackEmbedding(text);

  const model = process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_GEMINI_EMBEDDING_MODEL;
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
  if (!response.ok) return fallbackEmbedding(text);

  const values = data.embedding?.values ?? data.embeddings?.[0]?.values;
  if (!values || values.length === 0) return fallbackEmbedding(text);

  if (values.length === 768) return values;
  if (values.length > 768) return values.slice(0, 768);
  return [...values, ...new Array<number>(768 - values.length).fill(0)];
}
