import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";

const POLL_INTERVAL_MS = Number(process.env.BUILDER_POLL_INTERVAL_MS ?? 5000);
const PREVIEW_URL = process.env.BUILDER_PREVIEW_URL ?? "http://localhost:3000";

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

async function processRun(client, run) {
  console.log(`Starting hidden builder run: ${run._id}`);
  await client.mutation(api.workRuns.markWorking, { runId: run._id });

  await sleep(600);
  await append(client, run._id, "I'm preparing the workspace.");

  await sleep(600);
  await append(client, run._id, "I'm making the requested changes.");

  await sleep(600);
  await append(client, run._id, "I'm checking the preview.");

  await sleep(600);
  await client.mutation(api.workRuns.markNeedsReviewWithResult, {
    runId: run._id,
    summary: "A first review version is ready. This local builder is still using a simulated result.",
    previewUrl: PREVIEW_URL,
    message: "Your preview is ready to review.",
  });
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
