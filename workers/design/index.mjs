import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const POLL_INTERVAL_MS = Number(process.env.DESIGN_WORKER_POLL_INTERVAL_MS ?? 5000);
const REVIEW_URL = process.env.DESIGN_REVIEW_URL;

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

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function append(client, runId, message, tone = "progress") {
  await client.mutation(api.workRuns.appendUpdate, {
    runId,
    message,
    tone,
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
  await client.mutation(api.workRuns.markWorking, { runId: run._id });
  await append(client, run._id, "I'm preparing the design brief.");

  const directive = await client.query(api.directives.getDirectiveById, {
    directiveId: run.directiveId,
  });
  if (!directive) throw new Error("Task not found.");

  await sleep(400);
  await append(client, run._id, "I'm shaping the first visual direction.");

  const result = designBrief(run, directive);

  await sleep(400);
  await client.mutation(api.workRuns.markNeedsReviewWithResult, {
    runId: run._id,
    summary: result.summary,
    content: result.content,
    previewUrl: REVIEW_URL,
    internalNotes: JSON.stringify({
      mode: "design_worker",
      reviewUrl: REVIEW_URL ?? null,
      connector: "placeholder",
    }),
    message: "The design direction is ready to review.",
  });

  console.log(`Hidden design run ready for review: ${run._id}`);
}

async function tick(client) {
  const runs = await client.query(api.workRuns.listQueuedDesigns, { limit: 1 });
  const run = runs[0];
  if (!run) return false;

  try {
    await processRun(client, run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hidden design run failed: ${message}`);
    await client.mutation(api.workRuns.markFailed, {
      runId: run._id,
      message: "FounderOS could not prepare the design draft yet.",
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
