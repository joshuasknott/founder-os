import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { Codex } from "@openai/codex-sdk";
import { api } from "../../convex/_generated/api.js";

const POLL_INTERVAL_MS = Number(process.env.BUILDER_POLL_INTERVAL_MS ?? 5000);
const PREVIEW_URL = process.env.BUILDER_PREVIEW_URL ?? "http://localhost:3000";
const WORKSPACE_DIR = resolve(process.env.BUILDER_WORKSPACE_DIR ?? process.cwd());
const USE_CODEX = process.env.BUILDER_USE_CODEX === "true";
const START_PREVIEW = process.env.BUILDER_START_PREVIEW === "true";
const PREVIEW_COMMAND = process.env.BUILDER_PREVIEW_COMMAND ?? "npm run dev";
const PREVIEW_TIMEOUT_MS = Number(process.env.BUILDER_PREVIEW_TIMEOUT_MS ?? 30000);

function readLocalEnv(name) {
  const filePath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(filePath, "utf8");
    const line = content
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value && !value.startsWith("#") && value.startsWith(`${name}=`));

    if (!line) return undefined;
    return line.slice(name.length + 1).replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

function convexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    readLocalEnv("CONVEX_URL") ||
    readLocalEnv("NEXT_PUBLIC_CONVEX_URL")
  );
}

function openAiKey() {
  return process.env.OPENAI_API_KEY || readLocalEnv("OPENAI_API_KEY");
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function isPreviewReachable(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function startPreviewProcess() {
  const child = spawn(PREVIEW_COMMAND, {
    cwd: WORKSPACE_DIR,
    detached: true,
    shell: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function ensurePreviewUrl() {
  if (await isPreviewReachable(PREVIEW_URL)) return PREVIEW_URL;

  if (!START_PREVIEW) return null;

  startPreviewProcess();
  const startedAt = Date.now();

  while (Date.now() - startedAt < PREVIEW_TIMEOUT_MS) {
    await sleep(1000);
    if (await isPreviewReachable(PREVIEW_URL)) return PREVIEW_URL;
  }

  return null;
}

async function append(client, runId, message, tone = "progress") {
  await client.mutation(api.workRuns.appendUpdate, {
    runId,
    message,
    tone,
  });
}

async function simulateRun(client, run) {
  await sleep(600);
  await append(client, run._id, "I'm preparing the workspace.");

  await sleep(600);
  await append(client, run._id, "I'm making the requested changes.");

  await sleep(600);
  await append(client, run._id, "I'm checking the preview.");

  const previewUrl = await ensurePreviewUrl();
  const hasPreview = Boolean(previewUrl);

  await sleep(600);
  await client.mutation(api.workRuns.markNeedsReviewWithResult, {
    runId: run._id,
    summary: hasPreview
      ? "A first review version is ready. This local builder is still using a simulated result."
      : "A first review version is ready, but FounderOS could not open a preview yet.",
    previewUrl: previewUrl ?? undefined,
    internalNotes: JSON.stringify({
      mode: "simulated",
      previewUrl,
      previewAvailable: hasPreview,
    }),
    message: hasPreview
      ? "Your preview is ready to review."
      : "The work is ready for review, but I could not open the preview yet.",
  });
}

function buildCodexPrompt(directive) {
  return [
    "You are the hidden build worker for FounderOS.",
    "",
    "Make the requested project change in this workspace.",
    "Keep all final user-facing wording plain and non-technical.",
    "Do not mention Codex, tools, commands, terminals, git branches, commits, models, raw logs, APIs, or provider names.",
    "Do not push, deploy, publish, send messages, spend money, delete important data, or contact external people.",
    "If the request needs one of those external actions, prepare the work and state that it is ready for review.",
    "",
    "Founder request:",
    directive.objective,
    "",
    "Expected final response:",
    "- One short plain-language summary of what is ready.",
    "- Any review notes the founder should know.",
    "- No technical details.",
  ].join("\n");
}

function eventProgress(event) {
  if (!event || typeof event !== "object") return null;

  if (event.type === "item.started" || event.type === "item.completed") {
    const item = event.item;
    if (!item || typeof item !== "object") return null;

    if (item.type === "file_change" && event.type === "item.completed") {
      return "I'm applying the requested changes.";
    }

    if (item.type === "command_execution" && event.type === "item.started") {
      return "I'm checking that the work holds together.";
    }

    if (item.type === "error") {
      return "I found something that needs attention.";
    }
  }

  if (event.type === "turn.completed") {
    return "The first review version is ready.";
  }

  return null;
}

async function runCodex(client, run, directive) {
  const apiKey = openAiKey();
  if (!apiKey) {
    await append(client, run._id, "I'm preparing a local review version.");
    await simulateRun(client, run);
    return;
  }

  const codex = new Codex({ apiKey });
  const thread = codex.startThread({
    workingDirectory: WORKSPACE_DIR,
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    model: process.env.BUILDER_CODEX_MODEL,
    modelReasoningEffort: process.env.BUILDER_CODEX_REASONING_EFFORT ?? "medium",
  });

  await append(client, run._id, "I'm preparing the workspace.");

  const streamed = await thread.runStreamed(buildCodexPrompt(directive));
  const progressSeen = new Set();
  const changedFiles = new Set();
  let commandCount = 0;
  let finalSummary = "";
  let usage = null;

  for await (const event of streamed.events) {
    const message = eventProgress(event);
    if (message && !progressSeen.has(message)) {
      progressSeen.add(message);
      await append(client, run._id, message);
    }

    if (
      event.type === "item.completed" &&
      event.item?.type === "file_change" &&
      Array.isArray(event.item.changes)
    ) {
      for (const change of event.item.changes) {
        if (typeof change.path === "string") changedFiles.add(change.path);
      }
    }

    if (event.type === "item.completed" && event.item?.type === "command_execution") {
      commandCount += 1;
    }

    if (event.type === "item.completed" && event.item?.type === "agent_message") {
      finalSummary = event.item.text.trim();
    }

    if (event.type === "turn.completed") {
      usage = event.usage;
    }

    if (event.type === "turn.failed") {
      throw new Error(event.error.message);
    }
  }

  const previewUrl = await ensurePreviewUrl();
  const hasPreview = Boolean(previewUrl);

  await client.mutation(api.workRuns.markNeedsReviewWithResult, {
    runId: run._id,
    summary: finalSummary || (hasPreview
      ? "A first review version is ready."
      : "A first review version is ready, but FounderOS could not open a preview yet."),
    previewUrl: previewUrl ?? undefined,
    internalNotes: JSON.stringify({
      mode: "codex",
      threadId: thread.id,
      changedFileCount: changedFiles.size,
      changedFiles: [...changedFiles],
      commandCount,
      previewUrl,
      previewAvailable: hasPreview,
      usage,
    }),
    message: hasPreview
      ? "Your preview is ready to review."
      : "The work is ready for review, but I could not open the preview yet.",
  });
}

async function processRun(client, run) {
  console.log(`Starting hidden builder run: ${run._id}`);
  await client.mutation(api.workRuns.markWorking, { runId: run._id });

  if (!USE_CODEX) {
    await simulateRun(client, run);
    console.log(`Hidden builder run ready for review: ${run._id}`);
    return;
  }

  const directive = await client.query(api.directives.getDirectiveById, {
    directiveId: run.directiveId,
  });
  if (!directive) throw new Error("Task not found.");

  await runCodex(client, run, directive);
  console.log(`Hidden builder run ready for review: ${run._id}`);
}

async function tick(client) {
  const runs = await client.query(api.workRuns.listQueuedCodePreview, { limit: 1 });
  const run = runs[0];
  if (!run) return false;

  try {
    await processRun(client, run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hidden builder run failed: ${message}`);
    await client.mutation(api.workRuns.markFailed, {
      runId: run._id,
      message: "FounderOS could not prepare the preview yet.",
    });
  }

  return true;
}

async function main() {
  const url = convexUrl();
  if (!url) {
    throw new Error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL before running the builder.");
  }

  const client = new ConvexHttpClient(url);
  const once = process.argv.includes("--once");

  do {
    const handled = await tick(client);
    if (once) break;
    if (!handled) await sleep(POLL_INTERVAL_MS);
  } while (true);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
