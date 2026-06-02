import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadAiModule() {
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-ai-"));
  const pricingSource = await readFile(resolve(process.cwd(), "convex", "pricing.config.ts"), "utf8");
  const routingSource = await readFile(resolve(process.cwd(), "convex", "modelOrchestration.ts"), "utf8");
  const aiSource = await readFile(resolve(process.cwd(), "convex", "ai.ts"), "utf8");
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  };

  const pricing = ts.transpileModule(pricingSource, { compilerOptions });
  const routing = ts.transpileModule(routingSource, { compilerOptions });
  const ai = ts.transpileModule(aiSource, { compilerOptions });
  await writeFile(join(outputDir, "pricing.config.mjs"), pricing.outputText, "utf8");
  await writeFile(join(outputDir, "modelOrchestration.mjs"), routing.outputText, "utf8");
  await writeFile(
    join(outputDir, "ai.mjs"),
    ai.outputText
      .replace('from "./pricing.config";', 'from "./pricing.config.mjs";')
      .replace('from "./modelOrchestration";', 'from "./modelOrchestration.mjs";'),
    "utf8",
  );
  return import(pathToFileURL(join(outputDir, "ai.mjs")).href);
}

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const ai = await loadAiModule();

function resetRuntime() {
  process.env = { ...originalEnv };
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.ZAI_API_KEY;
  delete process.env.Z_AI_API_KEY;
  delete process.env.ZHIPU_API_KEY;
  delete process.env.FOUNDEROS_ENABLE_DIRECT_ZAI;
  globalThis.fetch = originalFetch;
}

test.beforeEach(resetRuntime);
test.afterEach(resetRuntime);

test("routine chat does not use a direct Z.ai key unless manual direct mode is enabled", async () => {
  process.env.ZAI_API_KEY = "test-key";
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return Response.json({
      choices: [{ message: { content: "Direct answer." } }],
    });
  };

  await assert.rejects(
    ai.executeChat({
      tier: 1,
      systemPrompt: "Read only.",
      userPrompt: "What should I do?",
    }),
    /FounderOS could not reach the AI service yet/,
  );
  assert.equal(callCount, 0);
});

test("manual direct Z.ai mode reports safe usage metadata without changing founder labels", async () => {
  process.env.FOUNDEROS_ENABLE_DIRECT_ZAI = "true";
  process.env.ZAI_API_KEY = "test-key";
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return Response.json({
      choices: [{ message: { content: "Here is a read-only answer." } }],
      usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 },
    });
  };

  const seenUsage = [];
  const result = await ai.executeChat({
    tier: 1,
    systemPrompt: "Read only.",
    userPrompt: "What should I do?",
    onUsage: (usage) => seenUsage.push(usage),
  });

  assert.equal(result.content, "Here is a read-only answer.");
  assert.equal(requestBody.model, "glm-4.7");
  assert.equal(seenUsage.length, 1);
  assert.equal(seenUsage[0].useCase, "chat");
  assert.equal(seenUsage[0].tokensUsed, 125);
  assert.equal(seenUsage[0].model, "core:chat");
  assert.equal(seenUsage[0].costUSD >= 0, true);
});

test("structured classification returns parsed JSON with conservative validation", async () => {
  process.env.FOUNDEROS_ENABLE_DIRECT_ZAI = "true";
  process.env.ZAI_API_KEY = "test-key";
  globalThis.fetch = async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              category: "communication",
              workerKind: "communications",
              confidence: 0.82,
              requiresReview: true,
              reasoning: "It asks to prepare outreach.",
            }),
          },
        },
      ],
    });

  const result = await ai.classifyText({
    title: "Client outreach",
    text: "Draft a follow-up email",
  });

  assert.equal(result.parsed.category, "communication");
  assert.equal(result.parsed.workerKind, "communications");
  assert.equal(result.parsed.requiresReview, true);
  assert.equal(result.parsed.confidence, 0.82);
});

test("routine core chat does not spend DeepSeek escalation when opencode is unavailable", async () => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return Response.json({
      choices: [{ message: { content: "Escalation answer." } }],
    });
  };

  await assert.rejects(
    ai.executeChat({
      tier: 2,
      systemPrompt: "Read only.",
      userPrompt: "Help me think through priorities.",
    }),
    /FounderOS could not reach the AI service yet/,
  );
  assert.equal(callCount, 0);
});

test("high-stakes workflow review can use DeepSeek escalation after GLM routes are unavailable", async () => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Review the decision",
              summary: "Prepare a careful review before acting.",
              steps: [{ title: "Review the request", kind: "review", requiresApproval: false }],
            }),
          },
        },
      ],
    });
  };

  const result = await ai.suggestWorkflow({
    objective: "Review this high-stakes legal contract change",
  });

  assert.equal(requestBody.model, "deepseek-v4-pro");
  assert.equal(result.parsed.title, "Review the decision");
  assert.equal(result.usage.model, "core:workflow_suggestion");
});

test("classification prefers the hidden GLM air route in manual direct mode", async () => {
  process.env.FOUNDEROS_ENABLE_DIRECT_ZAI = "true";
  process.env.ZAI_API_KEY = "test-key";
  let requestBody;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              category: "document",
              workerKind: "document",
              confidence: 0.77,
              requiresReview: false,
              reasoning: "It asks for a summary.",
            }),
          },
        },
      ],
    });
  };

  const result = await ai.classifyText({
    title: "Summary",
    text: "Summarize these public notes",
  });

  assert.equal(requestBody.model, "glm-4.5-air");
  assert.equal(result.parsed.category, "document");
  assert.equal(result.usage.model, "core:classification");
});

test("safe errors hide provider names, URLs, keys, and technical details", () => {
  const safe = ai.safeAIErrorMessage(
    new Error("HTTP 401 from https://api.deepseek.com with Bearer sk-live-secret stack trace model deepseek-chat"),
  );

  assert.equal(safe.includes("deepseek"), false);
  assert.equal(safe.includes("https://"), false);
  assert.equal(safe.includes("sk-live"), false);
  assert.equal(safe.includes("stack"), false);
  assert.equal(safe.startsWith("FounderOS could not reach the AI service yet."), true);
  assert.equal(
    ai.safeAIErrorMessage(new Error(safe)),
    safe,
  );
});

test("embeddings fall back deterministically and still trigger usage hooks", async () => {
  const seenUsage = [];
  const first = await ai.executeEmbedding("same text", { onUsage: (usage) => seenUsage.push(usage) });
  const second = await ai.executeEmbedding("same text");

  assert.equal(first.length, 768);
  assert.deepEqual(first, second);
  assert.equal(seenUsage.length, 1);
  assert.equal(seenUsage[0].useCase, "embedding");
  assert.equal(seenUsage[0].model, "core:embedding");
});
