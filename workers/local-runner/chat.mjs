import {
  runOpenCodeChat,
  safeText,
  selectOpenCodeChatModel,
} from "./opencode.mjs";
import { convexMutation } from "../convexRetry.mjs";

const DEFAULT_HEARTBEAT_TTL_MS = 45 * 1000;

function cleanEnvValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function founderError(error) {
  const message = safeText(error instanceof Error ? error.message : error, 260);
  if (!message) return "FounderOS could not finish that on this computer yet. Check Settings, then try again.";
  return message;
}

export async function processChatJob(client, job, options = {}) {
  const {
    runnerId,
    workerToken,
    heartbeatTtlMs = DEFAULT_HEARTBEAT_TTL_MS,
    env = process.env,
  } = options;
  if (!runnerId) throw new Error("Local runner id is missing.");

  await convexMutation(client, options.api.chat.progressLocalRunnerJob, {
    runnerId,
    jobId: job._id,
    leaseId: job.leaseId,
    message: job.requiresWork ? "Preparing a reply and starting the work." : "Preparing a reply.",
    heartbeatTtlMs,
    workerToken,
  });

  const selected = selectOpenCodeChatModel({
    requestedModel: cleanEnvValue(env.FOUNDEROS_OPENCODE_CHAT_MODEL),
    routeModel: job.opencodeModel,
    sensitivity: job.sensitivity,
    allowFreeRoute: job.allowFreeRoute,
    verifierRequired: job.verifierRequired,
    env,
  });

  try {
    const result = await runOpenCodeChat({
      commandValue: cleanEnvValue(env.BUILDER_OPENCODE_COMMAND) || "opencode",
      model: selected.model,
      agent: cleanEnvValue(env.FOUNDEROS_OPENCODE_CHAT_AGENT),
      attachUrl: cleanEnvValue(env.BUILDER_OPENCODE_ATTACH_URL),
      systemPrompt: job.systemPrompt,
      userPrompt: job.userPrompt,
      requiresWork: job.requiresWork,
      timeoutMs: Number(env.FOUNDEROS_OPENCODE_CHAT_TIMEOUT_MS ?? 120000),
    });

    await convexMutation(client, options.api.chat.completeLocalRunnerJob, {
      runnerId,
      jobId: job._id,
      leaseId: job.leaseId,
      assistantContent: result.content,
      heartbeatTtlMs,
      workerToken,
    });
  } catch (error) {
    await convexMutation(client, options.api.chat.failLocalRunnerJob, {
      runnerId,
      jobId: job._id,
      leaseId: job.leaseId,
      message: founderError(error),
      internalError: error instanceof Error ? error.message : String(error),
      retryable: false,
      heartbeatTtlMs,
      workerToken,
    });
  }
}
