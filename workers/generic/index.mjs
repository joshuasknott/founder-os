import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const POLL_INTERVAL_MS = Number(process.env.GENERIC_WORKER_POLL_INTERVAL_MS ?? 5000);
const WORKER_ID = process.env.GENERIC_WORKER_ID ?? `generic:${process.pid}`;
const LEASE_MS = Number(process.env.GENERIC_WORKER_LEASE_MS ?? 10 * 60 * 1000);

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
  if (!token) throw new Error("Set FOUNDEROS_WORKER_TOKEN before running the generic worker.");
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

function genericResult(run, directive) {
  if (run.kind === "data_update") {
    return {
      summary: "The workspace record is ready and saved in your Library.",
      content: [
        `# ${run.title}`,
        "",
        "## Record Update",
        directive.objective,
        "",
        "## Result",
        "FounderOS prepared this as a saved workspace record so it can be reused later.",
      ].join("\n"),
    };
  }

  return {
    summary: "The requested work is ready and saved in your Library.",
    content: [
      `# ${run.title}`,
      "",
      "## Request",
      directive.objective,
      "",
      "## Result",
      "FounderOS prepared this as a general task output. Ask for a revision if you want it changed.",
    ].join("\n"),
  };
}

async function processRun(client, run) {
  console.log(`Starting hidden generic run: ${run._id}`);
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
    console.log(`Hidden generic run returned approved action to review: ${run._id}`);
    return;
  }

  await append(client, run._id, "I'm preparing this work.");

  const directive = await client.query(api.directives.getDirectiveById, {
    directiveId: run.directiveId,
    workerToken: workerToken(),
  });
  if (!directive) throw new Error("Task not found.");

  await sleep(400);
  await append(client, run._id, "I'm saving the result.");

  const result = genericResult(run, directive);

  await sleep(400);
  await client.mutation(api.workRuns.completeWithResult, {
    runId: run._id,
    leaseId: run.leaseId,
    summary: result.summary,
    content: result.content,
    internalNotes: JSON.stringify({
      mode: "generic_worker",
      kind: run.kind,
    }),
    workerToken: workerToken(),
  });

  console.log(`Hidden generic run completed: ${run._id}`);
}

async function tick(client) {
  const run = await client.mutation(api.workRuns.leaseNext, {
    kinds: ["generic", "data_update"],
    workerId: WORKER_ID,
    leaseMs: LEASE_MS,
    workerToken: workerToken(),
  });
  if (!run) return false;

  try {
    await processRun(client, run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hidden generic run failed: ${message}`);
    await client.mutation(api.workRuns.markFailed, {
      runId: run._id,
      leaseId: run.leaseId,
      failureReason: "FounderOS could not finish this task yet.",
      internalError: message,
      workerToken: workerToken(),
    });
  }

  return true;
}

async function main() {
  const url = convexUrl();
  if (!url) {
    throw new Error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL before running the generic worker.");
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
