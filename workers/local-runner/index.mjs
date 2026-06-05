import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { checkOpenCode, safeText } from "./opencode.mjs";
import { processChatJob } from "./chat.mjs";
import { convexMutation } from "../convexRetry.mjs";

const DEFAULT_CAPABILITIES = [
  "business_reasoning",
  "coding",
  "debugging",
  "planning",
  "product_marketing_docs",
  "document",
  "design",
  "communication",
  "schedule",
  "data",
  "generic",
];
const DEFAULT_OUTPUT_CONTRACTS = [
  "plain_text",
  "structured_json",
  "library_item",
  "code_changes",
  "public_draft",
];
const DEFAULT_APPROVAL_CAPABILITIES = [
  "send_email",
  "create_calendar_event",
  "publish_preview",
  "post_externally",
  "spend_money",
  "delete_data",
  "change_live_asset",
  "generic",
];
const VALID_CAPABILITIES = new Set([
  "coding",
  "debugging",
  "document",
  "design",
  "communication",
  "schedule",
  "data",
  "generic",
  "business_reasoning",
  "product_marketing_docs",
  "planning",
]);
const VALID_OUTPUT_CONTRACTS = new Set(DEFAULT_OUTPUT_CONTRACTS);
const VALID_SENSITIVITIES = new Set(["public", "low", "internal", "confidential", "restricted"]);
const VALID_APPROVAL_CAPABILITIES = new Set(DEFAULT_APPROVAL_CAPABILITIES);
const OPENCODE_REQUIRED_CAPABILITIES = new Set([
  "business_reasoning",
  "planning",
  "product_marketing_docs",
  "coding",
  "debugging",
]);

const POLL_INTERVAL_MS = Number(envValue("LOCAL_RUNNER_POLL_INTERVAL_MS") ?? 5000);
const HEARTBEAT_TTL_MS = Number(envValue("LOCAL_RUNNER_HEARTBEAT_TTL_MS") ?? 45 * 1000);
const HEARTBEAT_INTERVAL_MS = Number(envValue("LOCAL_RUNNER_HEARTBEAT_INTERVAL_MS") ?? 15 * 1000);
const LEASE_MS = Number(envValue("LOCAL_RUNNER_LEASE_MS") ?? 10 * 60 * 1000);
const RUNNER_ID = envValue("LOCAL_RUNNER_ID") ?? `local:${process.pid}`;
const RUNNER_NAME = envValue("LOCAL_RUNNER_NAME") ?? "FounderOS local runner";

let stopping = false;

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

function envValue(name) {
  return process.env[name] || readLocalEnv(name);
}

function envFlag(name) {
  return ["1", "true", "yes", "on"].includes(String(envValue(name) ?? "").toLowerCase());
}

function readCsv(name, fallback, allowed) {
  const raw = envValue(name);
  const values = raw
    ? raw.split(",").map((value) => value.trim()).filter(Boolean)
    : fallback;
  const normalized = values.filter((value) => allowed.has(value));
  return [...new Set(normalized.length > 0 ? normalized : fallback)];
}

function convexUrl() {
  return envValue("CONVEX_URL") || envValue("NEXT_PUBLIC_CONVEX_URL");
}

function workerToken() {
  const token = envValue("FOUNDEROS_WORKER_TOKEN");
  if (!token) throw new Error("Set FOUNDEROS_WORKER_TOKEN before running the local runner.");
  return token;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function maxSensitivity() {
  const value = envValue("LOCAL_RUNNER_MAX_SENSITIVITY") ?? "restricted";
  return VALID_SENSITIVITIES.has(value) ? value : "restricted";
}

function builderProvider() {
  return String(envValue("BUILDER_AGENT") ?? envValue("BUILDER_PROVIDER") ?? "opencode").toLowerCase();
}

function shouldValidateOpenCode(capabilities) {
  if (envFlag("LOCAL_RUNNER_SKIP_OPENCODE_CHECK")) return false;
  return capabilities.some((capability) => OPENCODE_REQUIRED_CAPABILITIES.has(capability));
}

async function openCodeReadiness(capabilities) {
  if (!shouldValidateOpenCode(capabilities)) {
    return {
      opencodeReady: false,
      opencodeSafeMessage: "Local OpenCode check was not required.",
      capabilities,
    };
  }

  try {
    const result = await checkOpenCode(envValue("BUILDER_OPENCODE_COMMAND") ?? "opencode", {
      timeoutMs: envValue("FOUNDEROS_OPENCODE_READINESS_TIMEOUT_MS"),
    });
    return {
      opencodeReady: true,
      opencodeSafeMessage: result.safeMessage,
      capabilities,
    };
  } catch (error) {
    const message = safeText(error instanceof Error ? error.message : error) || "Local OpenCode is not ready.";
    if (envFlag("LOCAL_RUNNER_REQUIRE_OPENCODE") || builderProvider() === "opencode") {
      throw new Error(`${message} Install OpenCode and sign in on this computer, then start the local runner again.`);
    }

    return {
      opencodeReady: false,
      opencodeSafeMessage: message,
      capabilities: capabilities.filter((capability) => !OPENCODE_REQUIRED_CAPABILITIES.has(capability)),
    };
  }
}

async function startupChecks() {
  if (!existsSync(resolve(process.cwd(), "package.json"))) {
    throw new Error("Run the local runner from the FounderOS project folder.");
  }

  const url = convexUrl();
  if (!url) {
    throw new Error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL before running the local runner.");
  }
  workerToken();

  const capabilities = readCsv("LOCAL_RUNNER_CAPABILITIES", DEFAULT_CAPABILITIES, VALID_CAPABILITIES);
  const readiness = await openCodeReadiness(capabilities);

  return {
    url,
    capabilities: readiness.capabilities,
    outputContracts: readCsv("LOCAL_RUNNER_OUTPUT_CONTRACTS", DEFAULT_OUTPUT_CONTRACTS, VALID_OUTPUT_CONTRACTS),
    approvalCapabilities: readCsv(
      "LOCAL_RUNNER_APPROVAL_CAPABILITIES",
      DEFAULT_APPROVAL_CAPABILITIES,
      VALID_APPROVAL_CAPABILITIES,
    ),
    maxSensitivity: maxSensitivity(),
    opencodeReady: readiness.opencodeReady,
    opencodeSafeMessage: readiness.opencodeSafeMessage,
  };
}

async function loadHandlers() {
  const [
    builder,
    document,
    design,
    communications,
    generic,
  ] = await Promise.all([
    import("../builder/index.mjs"),
    import("../document/index.mjs"),
    import("../design/index.mjs"),
    import("../communications/index.mjs"),
    import("../generic/index.mjs"),
  ]);

  return {
    code_preview: builder.processRun,
    document: document.processRun,
    design: design.processRun,
    email: communications.processRun,
    schedule: communications.processRun,
    data_update: generic.processRun,
    generic: generic.processRun,
  };
}

async function register(client, settings) {
  await convexMutation(client, api.localRunner.register, {
    runnerId: RUNNER_ID,
    name: RUNNER_NAME,
    capabilities: settings.capabilities,
    outputContracts: settings.outputContracts,
    maxSensitivity: settings.maxSensitivity,
    approvalCapabilities: settings.approvalCapabilities,
    heartbeatTtlMs: HEARTBEAT_TTL_MS,
    opencodeReady: settings.opencodeReady,
    opencodeSafeMessage: settings.opencodeSafeMessage,
    processId: process.pid,
    version: "local-runner-v1",
    workerToken: workerToken(),
  });
}

async function heartbeat(client, settings, currentRunId, message) {
  await convexMutation(client, api.localRunner.heartbeat, {
    runnerId: RUNNER_ID,
    heartbeatTtlMs: HEARTBEAT_TTL_MS,
    capabilities: settings.capabilities,
    outputContracts: settings.outputContracts,
    maxSensitivity: settings.maxSensitivity,
    approvalCapabilities: settings.approvalCapabilities,
    currentRunId,
    lastSafeMessage: message,
    opencodeReady: settings.opencodeReady,
    opencodeSafeMessage: settings.opencodeSafeMessage,
    workerToken: workerToken(),
  });
}

async function leaseNext(client) {
  return await convexMutation(client, api.localRunner.leaseNext, {
    runnerId: RUNNER_ID,
    leaseMs: LEASE_MS,
    heartbeatTtlMs: HEARTBEAT_TTL_MS,
    workerToken: workerToken(),
  });
}

async function leaseNextChatJob(client) {
  return await convexMutation(client, api.chat.leaseNextLocalRunnerJob, {
    runnerId: RUNNER_ID,
    leaseMs: LEASE_MS,
    heartbeatTtlMs: HEARTBEAT_TTL_MS,
    workerToken: workerToken(),
  });
}

async function failRun(client, run, error) {
  const message = error instanceof Error ? error.message : String(error);
  await convexMutation(client, api.localRunner.fail, {
    runnerId: RUNNER_ID,
    runId: run._id,
    leaseId: run.leaseId,
    failureReason: "FounderOS could not finish this task yet.",
    internalError: message,
    workerToken: workerToken(),
  });
}

async function processWithHeartbeat(client, settings, run, handler) {
  const interval = setInterval(() => {
    heartbeat(client, settings, run._id, "Working.").catch((error) => {
      console.error(`Local runner heartbeat failed: ${safeText(error instanceof Error ? error.message : error)}`);
    });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await handler(client, run);
  } finally {
    clearInterval(interval);
    await heartbeat(client, settings, undefined, "Waiting for work.").catch(() => {});
  }
}

async function tick(client, settings, handlers) {
  await heartbeat(client, settings, undefined, "Waiting for work.");
  const chatJob = await leaseNextChatJob(client);
  if (chatJob) {
    try {
      await processChatJob(client, chatJob, {
        api,
        runnerId: RUNNER_ID,
        workerToken: workerToken(),
        heartbeatTtlMs: HEARTBEAT_TTL_MS,
      });
    } catch (error) {
      console.error(`Local runner chat failed: ${safeText(error instanceof Error ? error.message : error)}`);
    }
    return true;
  }

  const run = await leaseNext(client);
  if (!run) return false;

  const handler = handlers[run.kind];
  if (!handler) {
    await failRun(client, run, new Error("FounderOS does not have a local handler for this work."));
    return true;
  }

  try {
    await processWithHeartbeat(client, settings, run, handler);
  } catch (error) {
    console.error(`Local runner task failed: ${safeText(error instanceof Error ? error.message : error)}`);
    await failRun(client, run, error);
  }

  return true;
}

async function markOffline(client, message = "Local runner stopped.") {
  await convexMutation(client, api.localRunner.markOffline, {
    runnerId: RUNNER_ID,
    message,
    workerToken: workerToken(),
  }).catch(() => {});
}

function installShutdownHandlers() {
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

async function main() {
  installShutdownHandlers();
  const once = process.argv.includes("--once");
  const settings = await startupChecks();
  const client = new ConvexHttpClient(settings.url);
  const handlers = await loadHandlers();

  await register(client, settings);
  console.log(`FounderOS local runner started: ${RUNNER_ID}`);

  try {
    do {
      const handled = await tick(client, settings, handlers);
      if (once || stopping) break;
      if (!handled) await sleep(POLL_INTERVAL_MS);
    } while (!stopping);
  } finally {
    await markOffline(client);
    console.log("FounderOS local runner stopped.");
  }
}

const isDirectRun = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export {
  startupChecks,
  shouldValidateOpenCode,
};
