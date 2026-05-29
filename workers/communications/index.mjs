import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const POLL_INTERVAL_MS = Number(process.env.COMMUNICATIONS_WORKER_POLL_INTERVAL_MS ?? 5000);

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

function communicationDraft(run, directive) {
  if (run.kind === "email") {
    const summary = "An email draft is ready for review. It has not been sent.";
    const content = [
      `# ${run.title}`,
      "",
      "## Draft Email",
      "",
      "Subject: Follow-up from FounderOS",
      "",
      "Hi,",
      "",
      directive.objective,
      "",
      "Best,",
      "",
      "## Review Note",
      "This is a draft only. FounderOS must ask before sending anything externally.",
    ].join("\n");

    return { summary, content, action: "email_draft" };
  }

  const summary = "A scheduling suggestion is ready for review. Nothing has been added to a calendar.";
  const content = [
    `# ${run.title}`,
    "",
    "## Scheduling Suggestion",
    directive.objective,
    "",
    "## Draft Plan",
    "- Confirm the date, time, and recipient.",
    "- Review any context that should be included.",
    "- Approve before FounderOS creates or sends anything externally.",
  ].join("\n");

  return { summary, content, action: "schedule_suggestion" };
}

async function processRun(client, run) {
  console.log(`Starting hidden communications run: ${run._id}`);
  await client.mutation(api.workRuns.markWorking, { runId: run._id });
  await append(
    client,
    run._id,
    run.kind === "email" ? "I'm preparing the draft." : "I'm preparing the scheduling suggestion.",
  );

  const directive = await client.query(api.directives.getDirectiveById, {
    directiveId: run.directiveId,
  });
  if (!directive) throw new Error("Task not found.");

  await sleep(400);
  await append(client, run._id, "I'm getting this ready for review.");

  const result = communicationDraft(run, directive);

  await sleep(400);
  await client.mutation(api.workRuns.markNeedsReviewWithResult, {
    runId: run._id,
    summary: result.summary,
    content: result.content,
    internalNotes: JSON.stringify({
      mode: "communications_worker",
      action: result.action,
      externalActionRequiresApproval: true,
    }),
    message: "This is ready for your review.",
  });

  console.log(`Hidden communications run ready for review: ${run._id}`);
}

async function tick(client) {
  const runs = await client.query(api.workRuns.listQueuedCommunications, { limit: 1 });
  const run = runs[0];
  if (!run) return false;

  try {
    await processRun(client, run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hidden communications run failed: ${message}`);
    await client.mutation(api.workRuns.markFailed, {
      runId: run._id,
      message: "FounderOS could not prepare this for review yet.",
    });
  }

  return true;
}

async function main() {
  const url = convexUrl();
  if (!url) {
    throw new Error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL before running the communications worker.");
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
