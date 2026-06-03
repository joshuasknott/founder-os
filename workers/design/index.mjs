import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { convexMutation } from "../convexRetry.mjs";

const POLL_INTERVAL_MS = Number(process.env.DESIGN_WORKER_POLL_INTERVAL_MS ?? 5000);
const REVIEW_URL = process.env.DESIGN_REVIEW_URL;
const WORKER_ID = process.env.DESIGN_WORKER_ID ?? `design:${process.pid}`;
const LEASE_MS = Number(process.env.DESIGN_WORKER_LEASE_MS ?? 10 * 60 * 1000);

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
  if (!token) throw new Error("Set FOUNDEROS_WORKER_TOKEN before running the design worker.");
  return token;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function append(client, runId, message, tone = "progress") {
  await convexMutation(client, api.workRuns.appendUpdate, {
    runId,
    message,
    tone,
    workerToken: workerToken(),
  });
}

function designBrief(run, directive) {
  const summary = "A first design direction is ready for review and saved in your Library.";
  const content = [
    `# ${run.title}`,
    "",
    "## Design Brief",
    directive.objective,
    "",
    "## Draft Concepts",
    "- Clear, business-focused layout.",
    "- Reusable visual direction for the requested asset.",
    "- Prepared as a review placeholder before a full design connector is added.",
    "",
    "## Review Notes",
    "Review the direction, then ask FounderOS for refinements or final asset production.",
  ].join("\n");

  return { summary, content };
}

async function processRun(client, run) {
  console.log(`Starting hidden design run: ${run._id}`);
  const approvedAction = await client.query(api.approvals.getApprovedActionForRun, {
    runId: run._id,
    workerToken: workerToken(),
  });
  if (approvedAction) {
    await append(client, run._id, "I'm resuming the approved step.");
    await sleep(400);
    await convexMutation(client, api.approvals.resumeApprovedActionWithoutConnector, {
      approvalId: approvedAction.approvalId,
      runId: run._id,
      leaseId: run.leaseId,
      workerToken: workerToken(),
    });
    console.log(`Hidden design run returned approved action to review: ${run._id}`);
    return;
  }

  await append(client, run._id, "I'm preparing the design brief.");

  const directive = await client.query(api.directives.getDirectiveById, {
    directiveId: run.directiveId,
    workerToken: workerToken(),
  });
  if (!directive) throw new Error("Task not found.");

  await sleep(400);
  await append(client, run._id, "I'm shaping the first visual direction.");

  const result = designBrief(run, directive);

  await sleep(400);
  await convexMutation(client, api.workRuns.markNeedsReviewWithResult, {
    runId: run._id,
    leaseId: run.leaseId,
    summary: result.summary,
    content: result.content,
    previewUrl: REVIEW_URL,
    internalNotes: JSON.stringify({
      mode: "design_worker",
      reviewUrl: REVIEW_URL ?? null,
      connector: "placeholder",
    }),
    message: "The design direction is ready to review.",
    workerToken: workerToken(),
  });

  console.log(`Hidden design run ready for review: ${run._id}`);
}

async function tick(client) {
  const run = await convexMutation(client, api.workRuns.leaseNext, {
    kinds: ["design"],
    workerId: WORKER_ID,
    leaseMs: LEASE_MS,
    workerToken: workerToken(),
  });
  if (!run) return false;

  try {
    await processRun(client, run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hidden design run failed: ${message}`);
    await convexMutation(client, api.workRuns.markFailed, {
      runId: run._id,
      leaseId: run.leaseId,
      failureReason: "FounderOS could not prepare the design draft yet.",
      internalError: message,
      workerToken: workerToken(),
    });
  }

  return true;
}

async function main() {
  const url = convexUrl();
  if (!url) {
    throw new Error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL before running the design worker.");
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

export { processRun };
