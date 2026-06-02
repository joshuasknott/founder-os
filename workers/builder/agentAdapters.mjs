const OPENCODE_PROVIDER_ALIASES = new Set(["opencode", "open-code", "open_code"]);
const CODEX_PROVIDER_ALIASES = new Set(["codex", "openai-codex", "openai_codex"]);
const SIMULATED_PROVIDER_ALIASES = new Set(["simulated", "simulation", "local", "mock"]);
const LLM_PROVIDER_ALIASES = new Set(["llm", "chat-completions", "chat_completions", "custom"]);
const DEEPSEEK_PROVIDER_ALIASES = new Set(["deepseek", "deepseek-chat"]);
const ZAI_PROVIDER_ALIASES = new Set(["zai", "z.ai", "z_ai", "zhipu", "glm"]);
const OPENROUTER_PROVIDER_ALIASES = new Set(["openrouter", "open-router", "open_router"]);
const DEFAULT_OPENCODE_BUSINESS_MODEL = "zai-coding-plan/glm-4.7";
const DEFAULT_OPENCODE_PLANNING_MODEL = "zai-coding-plan/glm-5-turbo";
const DEFAULT_OPENCODE_CODING_MODEL = "zai-coding-plan/glm-5.1";
const FREE_OPENCODE_DRAFT_ROUTES = new Set([
  "opencode/deepseek-v4-flash-free",
  "opencode/nemotron-3-super-free",
  "opencode/minimax-m3-free",
  "opencode/mimo-v2.5-free",
  "opencode/big-pickle",
]);

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readEnv(env, name) {
  return cleanString(env[name]);
}

function canonicalProvider(value, useCodex = false) {
  const provider = cleanString(value)?.toLowerCase() ?? (useCodex ? "codex" : "opencode");

  if (OPENCODE_PROVIDER_ALIASES.has(provider)) return "opencode";
  if (CODEX_PROVIDER_ALIASES.has(provider)) return "codex";
  if (SIMULATED_PROVIDER_ALIASES.has(provider)) return "simulated";
  if (DEEPSEEK_PROVIDER_ALIASES.has(provider)) return "deepseek";
  if (ZAI_PROVIDER_ALIASES.has(provider)) return "zai";
  if (OPENROUTER_PROVIDER_ALIASES.has(provider)) return "openrouter";
  if (LLM_PROVIDER_ALIASES.has(provider)) return "llm";

  return provider;
}

function firstEnv(env, names) {
  for (const name of names) {
    const value = readEnv(env, name);
    if (value) return value;
  }
  return undefined;
}

function defaultLlmModel(provider) {
  if (provider === "zai") return "glm-5.1";
  if (provider === "openrouter") return "deepseek/deepseek-chat";
  return "deepseek-chat";
}

function defaultLlmBaseUrl(provider) {
  if (provider === "zai") return "https://api.z.ai/api/paas/v4";
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  return "https://api.deepseek.com";
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function inferRouteSensitivity(run = {}, directive = {}) {
  const text = normalizeText(`${run.title ?? ""} ${directive.title ?? ""} ${directive.objective ?? ""}`);
  if (
    /\b(api[_ -]?key|secret|password|bearer|private key|access token|refresh token)\b/.test(text) ||
    /\b(sk|pk|rk|ghp|github_pat|ya29)[-_a-z0-9]{8,}\b/.test(text)
  ) {
    return "restricted";
  }
  if (
    /\b(bank|payroll|salary|tax|legal|contract|nda|cap table|runway|revenue|invoice|customer list)\b/.test(text) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(text)
  ) {
    return "confidential";
  }
  if (/\b(redacted|public draft|blog post|press release|social post|marketing copy|landing page copy)\b/.test(text)) {
    return "low";
  }
  if (/\b(public information|published page|public website)\b/.test(text)) return "public";
  return "internal";
}

function outputContractForRun(run = {}, directive = {}) {
  if (run.kind === "code_preview") return "code_changes";
  const text = normalizeText(`${run.title ?? ""} ${directive.title ?? ""} ${directive.objective ?? ""}`);
  if (/\b(public draft|blog post|press release|social post|marketing copy)\b/.test(text)) {
    return "public_draft";
  }
  return "library_item";
}

function routeForOutputContract(outputContract, env = {}) {
  if (outputContract === "code_changes") {
    return readEnv(env, "FOUNDEROS_OPENCODE_CODING_MODEL") ?? DEFAULT_OPENCODE_CODING_MODEL;
  }
  if (outputContract === "library_item") {
    return readEnv(env, "FOUNDEROS_OPENCODE_PLANNING_MODEL") ?? DEFAULT_OPENCODE_PLANNING_MODEL;
  }
  return readEnv(env, "FOUNDEROS_OPENCODE_BUSINESS_MODEL") ?? DEFAULT_OPENCODE_BUSINESS_MODEL;
}

export function isFreeOpenCodeModel(model) {
  return FREE_OPENCODE_DRAFT_ROUTES.has(cleanString(model) ?? "");
}

function freeOpenCodeAllowed(args) {
  const lowEnough = args.sensitivity === "public" || args.sensitivity === "low";
  return lowEnough && args.outputContract === "public_draft" && args.redacted === true;
}

export function selectOpenCodeModelForRun({
  settings = {},
  modelProfile = "auto",
  run = {},
  directive = {},
  env = process.env,
} = {}) {
  const outputContract = outputContractForRun(run, directive);
  const sensitivity = inferRouteSensitivity(run, directive);
  const redacted = /\bredacted\b/i.test(`${directive.objective ?? ""} ${run.title ?? ""}`);
  const requestedModel =
    opencodeModelForProfile(settings, modelProfile) ||
    readEnv(env, "BUILDER_OPENCODE_MODEL") ||
    readEnv(env, "BUILDER_MODEL");
  const defaultModel = routeForOutputContract(outputContract, env);
  const freeAllowed = freeOpenCodeAllowed({ sensitivity, outputContract, redacted });

  if (requestedModel && isFreeOpenCodeModel(requestedModel) && !freeAllowed) {
    return {
      model: defaultModel,
      requestedModel,
      sensitivity,
      outputContract,
      verifierModel: DEFAULT_OPENCODE_BUSINESS_MODEL,
      freeRouteBlocked: true,
      freeRouteAllowed: false,
    };
  }

  if (requestedModel) {
    return {
      model: requestedModel,
      requestedModel,
      sensitivity,
      outputContract,
      verifierModel: isFreeOpenCodeModel(requestedModel) ? DEFAULT_OPENCODE_BUSINESS_MODEL : DEFAULT_OPENCODE_PLANNING_MODEL,
      freeRouteBlocked: false,
      freeRouteAllowed: isFreeOpenCodeModel(requestedModel) ? freeAllowed : undefined,
    };
  }

  return {
    model: defaultModel,
    sensitivity,
    outputContract,
    verifierModel: outputContract === "code_changes" ? DEFAULT_OPENCODE_PLANNING_MODEL : DEFAULT_OPENCODE_BUSINESS_MODEL,
    freeRouteBlocked: false,
    freeRouteAllowed: undefined,
  };
}

function chatCompletionsUrl(env, provider) {
  const explicit = firstEnv(env, ["BUILDER_LLM_CHAT_COMPLETIONS_URL"]);
  if (explicit) return explicit;

  const baseUrl = (
    firstEnv(env, [
      "BUILDER_LLM_BASE_URL",
      provider === "deepseek" ? "BUILDER_DEEPSEEK_BASE_URL" : "",
      provider === "deepseek" ? "DEEPSEEK_BASE_URL" : "",
      provider === "openrouter" ? "OPENROUTER_BASE_URL" : "",
    ].filter(Boolean)) ?? defaultLlmBaseUrl(provider)
  ).replace(/\/+$/, "");

  return `${baseUrl}/chat/completions`;
}

function llmApiKeyEnvNames(provider) {
  if (provider === "zai") {
    return ["BUILDER_LLM_API_KEY", "ZAI_API_KEY", "Z_AI_API_KEY", "ZHIPU_API_KEY"];
  }
  if (provider === "openrouter") {
    return ["BUILDER_LLM_API_KEY", "OPENROUTER_API_KEY"];
  }
  if (provider === "deepseek") {
    return ["BUILDER_LLM_API_KEY", "DEEPSEEK_API_KEY"];
  }
  return ["BUILDER_LLM_API_KEY"];
}

function llmModel(env, provider) {
  return (
    firstEnv(env, [
      "BUILDER_LLM_MODEL",
      provider === "deepseek" ? "BUILDER_DEEPSEEK_MODEL" : "",
      provider === "deepseek" ? "DEEPSEEK_MODEL" : "",
      provider === "openrouter" ? "OPENROUTER_MODEL" : "",
      provider === "zai" ? "ZAI_MODEL" : "",
    ].filter(Boolean)) ?? defaultLlmModel(provider)
  );
}

export function isLlmBuilderProvider(provider) {
  return ["llm", "deepseek", "zai", "openrouter"].includes(canonicalProvider(provider));
}

export function selectBuilderAgent(env = process.env) {
  const useCodex = env.BUILDER_USE_CODEX === "true";
  const provider = canonicalProvider(env.BUILDER_AGENT ?? env.BUILDER_PROVIDER, useCodex);
  const timeoutMs = Number(env.BUILDER_AGENT_TIMEOUT_MS ?? env.BUILDER_OPENCODE_TIMEOUT_MS ?? 10 * 60 * 1000);

  if (provider === "simulated") {
    return {
      adapter: "simulated",
      provider,
      displayName: "FounderOS builder",
      isRealBuilder: false,
      timeoutMs,
    };
  }

  if (provider === "opencode") {
    return {
      adapter: "opencode",
      provider,
      displayName: "FounderOS builder",
      command: readEnv(env, "BUILDER_OPENCODE_COMMAND") ?? "opencode",
      model: firstEnv(env, ["BUILDER_OPENCODE_MODEL", "BUILDER_MODEL"]),
      agent: readEnv(env, "BUILDER_OPENCODE_AGENT"),
      attachUrl: readEnv(env, "BUILDER_OPENCODE_ATTACH_URL"),
      timeoutMs,
      isRealBuilder: true,
    };
  }

  if (provider === "codex") {
    return {
      adapter: "codex",
      provider,
      displayName: "FounderOS builder",
      model: firstEnv(env, ["BUILDER_CODEX_MODEL", "BUILDER_MODEL"]),
      reasoningEffort: readEnv(env, "BUILDER_CODEX_REASONING_EFFORT") ?? "medium",
      timeoutMs,
      isRealBuilder: true,
    };
  }

  if (isLlmBuilderProvider(provider)) {
    return {
      adapter: "llm",
      provider,
      displayName: "FounderOS builder",
      model: llmModel(env, provider),
      chatCompletionsUrl: chatCompletionsUrl(env, provider),
      apiKeyEnvNames: llmApiKeyEnvNames(provider),
      timeoutMs,
      isRealBuilder: true,
    };
  }

  return {
    adapter: "unknown",
    provider,
    displayName: "FounderOS builder",
    timeoutMs,
    isRealBuilder: false,
  };
}

export function opencodeModelForProfile(settings = {}, profile = "auto") {
  const normalizedProfile = ["low", "medium", "high"].includes(profile) ? profile : "auto";
  if (normalizedProfile === "auto") return undefined;

  const profileModel =
    normalizedProfile === "low" ? cleanString(settings.modelLow) :
    normalizedProfile === "medium" ? cleanString(settings.modelMedium) :
    cleanString(settings.modelHigh);

  return profileModel ?? cleanString(settings.model);
}

export function buildOpenCodeArgs(agent, prompt, workspaceDir, title = "FounderOS build") {
  const args = ["run", "--dir", workspaceDir, "--title", title];
  if (agent.model) args.push("--model", agent.model);
  if (agent.agent) args.push("--agent", agent.agent);
  if (agent.attachUrl) args.push("--attach", agent.attachUrl);
  args.push(prompt);
  return args;
}

export function builderProviderHelp(provider) {
  const canonical = canonicalProvider(provider);
  if (canonical === "opencode") return "opencode should be installed and authenticated for the selected model.";
  if (canonical === "codex") return "Set OPENAI_API_KEY and BUILDER_USE_CODEX=true for the Codex adapter.";
  if (canonical === "deepseek") return "Set DEEPSEEK_API_KEY only for the manual DeepSeek escalation/review adapter.";
  if (canonical === "zai") return "Set FOUNDEROS_ENABLE_DIRECT_ZAI=true and ZAI_API_KEY only for the manual direct Z.ai adapter.";
  if (canonical === "openrouter") return "Set OPENROUTER_API_KEY and choose an OpenRouter model.";
  if (canonical === "llm") return "Set BUILDER_LLM_API_KEY, BUILDER_LLM_CHAT_COMPLETIONS_URL, and BUILDER_LLM_MODEL.";
  return "Set BUILDER_PROVIDER to simulated, opencode, deepseek, zai, openrouter, llm, or codex.";
}
