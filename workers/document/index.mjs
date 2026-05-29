import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const POLL_INTERVAL_MS = Number(process.env.DOCUMENT_WORKER_POLL_INTERVAL_MS ?? 5000);

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

function classifyDocument(title, objective) {
  const text = `${title} ${objective}`.toLowerCase();
  if (text.includes("proposal")) return "proposal";
  if (text.includes("checklist")) return "checklist";
  if (text.includes("meeting")) return "meeting notes";
  if (text.includes("launch")) return "launch plan";
  if (text.includes("brief")) return "brief";
  return "plan";
}

function draftDocument(run, directive) {
  const documentType = classifyDocument(run.title, directive.objective);
  const summary = `A ${documentType} draft is ready and saved in your Library.`;
  const content = [
    `# ${run.title}`,
    "",
    "## Purpose",
    directive.objective,
    "",
    "## Draft",
    `This ${documentType} is prepared as a first internal version for review.`,
    "",
    "## Next Steps",
    "- Review the draft in Library.",
    "- Add any missing business context.",
    "- Ask FounderOS for revisions when needed.",
  ].join("\n");

  return { summary, content, documentType };
}

async function processRun(client, run) {
  console.log(`Starting hidden document run: ${run._id}`);
  await client.mutation(api.workRuns.markWorking, { runId: run._id });
  await append(client, run._id, "I'm preparing the draft.");

  const directive = await client.query(api.directives.getDirectiveById, {
    directiveId: run.directiveId,
  });
  if (!directive) throw new Error("Task not found.");

  await sleep(400);
  await append(client, run._id, "I'm organizing the key points.");

  const result = draftDocument(run, directive);

  await sleep(400);
  await client.mutation(api.workRuns.completeWithResult, {
    runId: run._id,
    summary: result.summary,
    content: result.content,
    internalNotes: JSON.stringify({
      mode: "document_worker",
      documentType: result.documentType,
      source: "FounderOS Library",
    }),
  });

  console.log(`Hidden document run completed: ${run._id}`);
}

async function tick(client) {
  const runs = await client.query(api.workRuns.listQueuedDocuments, { limit: 1 });
  const run = runs[0];
  if (!run) return false;

  try {
    await processRun(client, run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hidden document run failed: ${message}`);
    await client.mutation(api.workRuns.markFailed, {
      runId: run._id,
      message: "FounderOS could not prepare the document yet.",
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
