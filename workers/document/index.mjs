import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { runOpenCodeDocument } from "../local-runner/opencode.mjs";
import {
  buildDocumentPrompt,
  buildVerifierPrompt,
  classifyDocumentRequest,
  fallbackDocument,
  selectDocumentRoute,
  summarizeDocument,
} from "./runtime.mjs";

const POLL_INTERVAL_MS = Number(process.env.DOCUMENT_WORKER_POLL_INTERVAL_MS ?? 5000);
const WORKER_ID = process.env.DOCUMENT_WORKER_ID ?? `document:${process.pid}`;
const LEASE_MS = Number(process.env.DOCUMENT_WORKER_LEASE_MS ?? 10 * 60 * 1000);

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

function workerToken() {
  const token = process.env.FOUNDEROS_WORKER_TOKEN || readLocalEnv("FOUNDEROS_WORKER_TOKEN");
  if (!token) throw new Error("Set FOUNDEROS_WORKER_TOKEN before running the document worker.");
  return token;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function append(client, runId, message, tone = "progress") {
  await client.mutation(api.workRuns.appendUpdate, {
    runId,
    message,
    tone,
    workerToken: workerToken(),
  });
}

function envValue(name) {
  return process.env[name] || readLocalEnv(name);
}

async function generateDocument(run, directive, context) {
  const documentType = classifyDocumentRequest(run.title, directive.objective);
  const route = selectDocumentRoute({
    title: run.title,
    objective: directive.objective,
    env: {
      FOUNDEROS_OPENCODE_BUSINESS_MODEL: envValue("FOUNDEROS_OPENCODE_BUSINESS_MODEL"),
      FOUNDEROS_OPENCODE_PLANNING_MODEL: envValue("FOUNDEROS_OPENCODE_PLANNING_MODEL"),
    },
  });
  const commandValue = envValue("BUILDER_OPENCODE_COMMAND") ?? "opencode";
  const agent = envValue("BUILDER_OPENCODE_AGENT");
  const attachUrl = envValue("BUILDER_OPENCODE_ATTACH_URL");
  const prompt = buildDocumentPrompt({ run, directive, context, documentType });
  let generationMode = "opencode";
  let verifierApplied = false;
  let verifierFailed = false;
  let content;

  try {
    content = (await runOpenCodeDocument({
      commandValue,
      model: route.model,
      agent,
      attachUrl,
      prompt,
      title: run.title,
    })).content;
  } catch {
    content = fallbackDocument({ run, directive, documentType });
    generationMode = "structured_fallback";
  }

  if (route.verifierRequired && generationMode === "opencode") {
    try {
      content = (await runOpenCodeDocument({
        commandValue,
        model: route.verifierModel,
        agent,
        attachUrl,
        prompt: buildVerifierPrompt({
          draft: content,
          documentType,
          objective: directive.objective,
        }),
        title: `${run.title} review`,
      })).content;
      verifierApplied = true;
    } catch {
      verifierFailed = true;
    }
  }

  return {
    summary: summarizeDocument(documentType),
    content,
    documentType,
    route,
    generationMode,
    verifierApplied,
    verifierFailed,
  };
}

async function processRun(client, run) {
  console.log(`Starting hidden document run: ${run._id}`);
  const approvedAction = await client.query(api.approvals.getApprovedActionForRun, {
    runId: run._id,
    workerToken: workerToken(),
  });
  if (approvedAction) {
    await append(client, run._id, "I'm resuming the approved step.");
    await sleep(400);
    await client.mutation(api.approvals.resumeApprovedActionWithoutConnector, {
      approvalId: approvedAction.approvalId,
      runId: run._id,
      leaseId: run.leaseId,
      workerToken: workerToken(),
    });
    console.log(`Hidden document run returned approved action to review: ${run._id}`);
    return;
  }

  await append(client, run._id, "I'm preparing the draft.");

  const directive = await client.query(api.directives.getDirectiveById, {
    directiveId: run.directiveId,
    workerToken: workerToken(),
  });
  if (!directive) throw new Error("Task not found.");

  await sleep(400);
  await append(client, run._id, "I'm pulling relevant approved Library context.");

  const context = await client.query(api.workRuns.getDocumentContext, {
    runId: run._id,
    workerToken: workerToken(),
  });

  await sleep(400);
  await append(client, run._id, "I'm writing the draft and checking the important details.");
  const result = await generateDocument(run, directive, context);

  await sleep(400);
  await client.mutation(api.workRuns.markNeedsReviewWithResult, {
    runId: run._id,
    leaseId: run.leaseId,
    summary: result.summary,
    content: result.content,
    internalNotes: JSON.stringify({
      mode: "document_worker",
      documentType: result.documentType,
      source: "FounderOS Library",
      generationMode: result.generationMode,
      verifierApplied: result.verifierApplied,
      verifierFailed: result.verifierFailed,
    }),
    metadata: {
      needsReview: true,
      document: {
        type: result.documentType,
        capability: result.route.capability,
        highStakes: result.route.highStakes,
        contextCount: context.length,
        generationMode: result.generationMode,
        verifierApplied: result.verifierApplied,
        verifierFailed: result.verifierFailed,
      },
    },
    message: "The draft is ready for your review.",
    workerToken: workerToken(),
  });

  console.log(`Hidden document run completed: ${run._id}`);
}

async function tick(client) {
  const run = await client.mutation(api.workRuns.leaseNext, {
    kinds: ["document"],
    workerId: WORKER_ID,
    leaseMs: LEASE_MS,
    workerToken: workerToken(),
  });
  if (!run) return false;

  try {
    await processRun(client, run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hidden document run failed: ${message}`);
    await client.mutation(api.workRuns.markFailed, {
      runId: run._id,
      leaseId: run.leaseId,
      failureReason: "FounderOS could not prepare the document yet.",
      internalError: message,
      workerToken: workerToken(),
    });
  }

  return true;
}

async function main() {
  const url = convexUrl();
  if (!url) {
    throw new Error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL before running the document worker.");
  }

  const client = new ConvexHttpClient(url);
  const once = process.argv.includes("--once");

  do {
    const handled = await tick(client);
    if (once) break;
    if (!handled) await sleep(POLL_INTERVAL_MS);
  } while (true);
}

const directRunPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (import.meta.url === directRunPath) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { generateDocument, processRun };
