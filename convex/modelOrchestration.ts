export type ModelCapability =
  | "classification"
  | "summarization"
  | "routine"
  | "business_reasoning"
  | "product_marketing_docs"
  | "planning"
  | "finance"
  | "complex_synthesis"
  | "strategy"
  | "coding"
  | "debugging"
  | "public_draft"
  | "vision"
  | "verification"
  | "escalation";

export type ModelSensitivity = "public" | "low" | "internal" | "confidential" | "restricted";

export type OutputContract =
  | "plain_text"
  | "structured_json"
  | "library_item"
  | "code_changes"
  | "public_draft"
  | "vision_summary"
  | "embedding";

export type HiddenModelRouteId =
  | "zai-coding-plan/glm-4.5-air"
  | "zai-coding-plan/glm-4.7"
  | "zai-coding-plan/glm-5-turbo"
  | "zai-coding-plan/glm-5.1"
  | "opencode/deepseek-v4-flash-free"
  | "opencode/nemotron-3-super-free"
  | "opencode/minimax-m3-free"
  | "opencode/mimo-v2.5-free"
  | "opencode/big-pickle"
  | "gemini/gemini-3-flash-free"
  | "deepseek/deepseek-v4-pro";

export type RouteProvider = "zai" | "opencode" | "gemini" | "deepseek";

export type HiddenModelRoute = {
  id: HiddenModelRouteId;
  provider: RouteProvider;
  model: string;
  envModelVar?: string;
  channel: "chat_completions" | "opencode" | "vision";
  free: boolean;
  requiresRedaction: boolean;
  requiresVerifier: boolean;
  maxSensitivity: ModelSensitivity;
  capabilities: ModelCapability[];
  outputContracts: OutputContract[];
};

export type ModelRouteRequest = {
  capability: ModelCapability;
  outputContract: OutputContract;
  sensitivity?: ModelSensitivity;
  redacted?: boolean;
  highStakes?: boolean;
  requiresReview?: boolean;
  allowFreeDraftRoute?: boolean;
  failures?: number;
  text?: string;
};

export type RoutePrivacyDecision = {
  allowed: boolean;
  sensitivity: ModelSensitivity;
  redactionRequired: boolean;
  redactionSatisfied: boolean;
  blockedReason?: string;
};

export type VerifierPolicy = {
  required: boolean;
  routeId?: HiddenModelRouteId;
  reason?: string;
};

export type ModelRouteSelection = {
  selectedRouteId: HiddenModelRouteId;
  fallbackRouteIds: HiddenModelRouteId[];
  verifier: VerifierPolicy;
  privacy: RoutePrivacyDecision;
  blockedRouteId?: HiddenModelRouteId;
};

const GLM_45_AIR: HiddenModelRouteId = "zai-coding-plan/glm-4.5-air";
const GLM_47: HiddenModelRouteId = "zai-coding-plan/glm-4.7";
const GLM_5_TURBO: HiddenModelRouteId = "zai-coding-plan/glm-5-turbo";
const GLM_51: HiddenModelRouteId = "zai-coding-plan/glm-5.1";
const GEMINI_3_FLASH: HiddenModelRouteId = "gemini/gemini-3-flash-free";
const DEEPSEEK_V4_PRO: HiddenModelRouteId = "deepseek/deepseek-v4-pro";

export const SUBSCRIPTION_OPENCODE_MODELS = {
  classification: GLM_45_AIR,
  business: GLM_47,
  planning: GLM_5_TURBO,
  coding: GLM_51,
} as const;

export const FREE_OPENCODE_DRAFT_ROUTES: HiddenModelRouteId[] = [
  "opencode/deepseek-v4-flash-free",
  "opencode/nemotron-3-super-free",
  "opencode/minimax-m3-free",
  "opencode/mimo-v2.5-free",
  "opencode/big-pickle",
];

const ROUTES: Record<HiddenModelRouteId, HiddenModelRoute> = {
  [GLM_45_AIR]: {
    id: GLM_45_AIR,
    provider: "zai",
    model: "glm-4.5-air",
    envModelVar: "FOUNDEROS_GLM_45_AIR_MODEL",
    channel: "chat_completions",
    free: false,
    requiresRedaction: false,
    requiresVerifier: false,
    maxSensitivity: "restricted",
    capabilities: ["classification", "summarization", "routine", "verification"],
    outputContracts: ["plain_text", "structured_json", "library_item"],
  },
  [GLM_47]: {
    id: GLM_47,
    provider: "zai",
    model: "glm-4.7",
    envModelVar: "FOUNDEROS_GLM_47_MODEL",
    channel: "chat_completions",
    free: false,
    requiresRedaction: false,
    requiresVerifier: false,
    maxSensitivity: "restricted",
    capabilities: ["business_reasoning", "product_marketing_docs", "summarization", "verification"],
    outputContracts: ["plain_text", "structured_json", "library_item", "public_draft"],
  },
  [GLM_5_TURBO]: {
    id: GLM_5_TURBO,
    provider: "zai",
    model: "glm-5-turbo",
    envModelVar: "FOUNDEROS_GLM_5_TURBO_MODEL",
    channel: "chat_completions",
    free: false,
    requiresRedaction: false,
    requiresVerifier: false,
    maxSensitivity: "restricted",
    capabilities: ["planning", "finance", "complex_synthesis", "strategy", "verification", "escalation"],
    outputContracts: ["plain_text", "structured_json", "library_item"],
  },
  [GLM_51]: {
    id: GLM_51,
    provider: "zai",
    model: "glm-5.1",
    envModelVar: "FOUNDEROS_GLM_51_MODEL",
    channel: "opencode",
    free: false,
    requiresRedaction: false,
    requiresVerifier: true,
    maxSensitivity: "restricted",
    capabilities: ["coding", "debugging"],
    outputContracts: ["code_changes", "library_item"],
  },
  "opencode/deepseek-v4-flash-free": {
    id: "opencode/deepseek-v4-flash-free",
    provider: "opencode",
    model: "opencode/deepseek-v4-flash-free",
    channel: "opencode",
    free: true,
    requiresRedaction: true,
    requiresVerifier: true,
    maxSensitivity: "low",
    capabilities: ["public_draft"],
    outputContracts: ["public_draft"],
  },
  "opencode/nemotron-3-super-free": {
    id: "opencode/nemotron-3-super-free",
    provider: "opencode",
    model: "opencode/nemotron-3-super-free",
    channel: "opencode",
    free: true,
    requiresRedaction: true,
    requiresVerifier: true,
    maxSensitivity: "low",
    capabilities: ["public_draft"],
    outputContracts: ["public_draft"],
  },
  "opencode/minimax-m3-free": {
    id: "opencode/minimax-m3-free",
    provider: "opencode",
    model: "opencode/minimax-m3-free",
    channel: "opencode",
    free: true,
    requiresRedaction: true,
    requiresVerifier: true,
    maxSensitivity: "low",
    capabilities: ["public_draft"],
    outputContracts: ["public_draft"],
  },
  "opencode/mimo-v2.5-free": {
    id: "opencode/mimo-v2.5-free",
    provider: "opencode",
    model: "opencode/mimo-v2.5-free",
    channel: "opencode",
    free: true,
    requiresRedaction: true,
    requiresVerifier: true,
    maxSensitivity: "low",
    capabilities: ["public_draft"],
    outputContracts: ["public_draft"],
  },
  "opencode/big-pickle": {
    id: "opencode/big-pickle",
    provider: "opencode",
    model: "opencode/big-pickle",
    channel: "opencode",
    free: true,
    requiresRedaction: true,
    requiresVerifier: true,
    maxSensitivity: "low",
    capabilities: ["public_draft"],
    outputContracts: ["public_draft"],
  },
  [GEMINI_3_FLASH]: {
    id: GEMINI_3_FLASH,
    provider: "gemini",
    model: "gemini-3-flash",
    envModelVar: "GEMINI_VISION_MODEL",
    channel: "vision",
    free: true,
    requiresRedaction: true,
    requiresVerifier: true,
    maxSensitivity: "low",
    capabilities: ["vision"],
    outputContracts: ["vision_summary"],
  },
  [DEEPSEEK_V4_PRO]: {
    id: DEEPSEEK_V4_PRO,
    provider: "deepseek",
    model: "deepseek-v4-pro",
    envModelVar: "DEEPSEEK_V4_PRO_MODEL",
    channel: "chat_completions",
    free: false,
    requiresRedaction: false,
    requiresVerifier: false,
    maxSensitivity: "restricted",
    capabilities: ["verification", "escalation", "debugging", "complex_synthesis"],
    outputContracts: ["plain_text", "structured_json", "library_item", "code_changes"],
  },
};

const SENSITIVITY_RANK: Record<ModelSensitivity, number> = {
  public: 0,
  low: 1,
  internal: 2,
  confidential: 3,
  restricted: 4,
};

function uniqueRouteIds(routeIds: HiddenModelRouteId[]) {
  return [...new Set(routeIds)];
}

export function getHiddenModelRoute(routeId: HiddenModelRouteId) {
  return ROUTES[routeId];
}

export function configuredModelForRoute(
  routeId: HiddenModelRouteId,
  env: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env,
) {
  const route = getHiddenModelRoute(routeId);
  return (route.envModelVar ? env[route.envModelVar] : undefined) || route.model;
}

export function isFreeOpenCodeRoute(value?: string): value is HiddenModelRouteId {
  return FREE_OPENCODE_DRAFT_ROUTES.includes(value as HiddenModelRouteId);
}

export function inferSensitivityFromText(
  text?: string,
  fallback: ModelSensitivity = "internal",
): ModelSensitivity {
  const normalized = String(text ?? "").toLowerCase();
  if (!normalized.trim()) return fallback;

  if (
    /\b(api[_ -]?key|secret|password|passwd|bearer|private key|refresh token|access token)\b/.test(normalized) ||
    /\b(sk|pk|rk|ghp|github_pat|ya29)[-_a-z0-9]{8,}\b/.test(normalized) ||
    /-----begin [a-z ]+private key-----/.test(normalized)
  ) {
    return "restricted";
  }

  if (
    /\b(bank|payroll|salary|tax|legal|contract|nda|cap table|investor update|runway|revenue|invoice|customer list|health)\b/.test(normalized) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(normalized) ||
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(normalized)
  ) {
    return "confidential";
  }

  if (/\b(redacted|public draft|public copy|blog post|press release|social post|landing page copy|marketing copy)\b/.test(normalized)) {
    return "low";
  }

  if (/\b(public information|published page|public website)\b/.test(normalized)) {
    return "public";
  }

  return fallback;
}

export function redactForExternalModelRoute(text: string) {
  return text
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted credential]")
    .replace(/\b(sk|pk|rk|ghp|github_pat|ya29)[-_A-Za-z0-9]{8,}\b/g, "[redacted credential]")
    .replace(/-----BEGIN [\s\S]+? PRIVATE KEY-----[\s\S]+?-----END [\s\S]+? PRIVATE KEY-----/g, "[redacted private key]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted phone]")
    .replace(/\$[0-9][0-9,]*(?:\.[0-9]{2})?/g, "[redacted amount]");
}

function privacyForRoute(routeId: HiddenModelRouteId, request: Required<Pick<ModelRouteRequest, "capability" | "outputContract" | "redacted">> & { sensitivity: ModelSensitivity }) {
  const route = getHiddenModelRoute(routeId);
  const sensitivityAllowed = SENSITIVITY_RANK[request.sensitivity] <= SENSITIVITY_RANK[route.maxSensitivity];
  const redactionSatisfied = !route.requiresRedaction || request.redacted || request.sensitivity === "public";
  const contractAllowed = route.outputContracts.includes(request.outputContract);
  const capabilityAllowed = route.capabilities.includes(request.capability);
  const freeDraftAllowed =
    !route.free ||
    route.provider !== "opencode" ||
    (request.capability === "public_draft" && request.outputContract === "public_draft");
  const geminiVisionAllowed =
    route.provider !== "gemini" ||
    (request.capability === "vision" && request.outputContract === "vision_summary");

  if (!sensitivityAllowed) {
    return {
      allowed: false,
      sensitivity: request.sensitivity,
      redactionRequired: route.requiresRedaction,
      redactionSatisfied,
      blockedReason: "This route is limited to public or low-sensitive material.",
    };
  }
  if (!redactionSatisfied) {
    return {
      allowed: false,
      sensitivity: request.sensitivity,
      redactionRequired: route.requiresRedaction,
      redactionSatisfied,
      blockedReason: "This route requires redacted input.",
    };
  }
  if (!contractAllowed || !capabilityAllowed || !freeDraftAllowed || !geminiVisionAllowed) {
    return {
      allowed: false,
      sensitivity: request.sensitivity,
      redactionRequired: route.requiresRedaction,
      redactionSatisfied,
      blockedReason: "This route is not allowed for the requested work type.",
    };
  }

  return {
    allowed: true,
    sensitivity: request.sensitivity,
    redactionRequired: route.requiresRedaction,
    redactionSatisfied,
  };
}

function primaryRouteFor(request: Required<Pick<ModelRouteRequest, "capability" | "outputContract" | "allowFreeDraftRoute">>) {
  if (request.capability === "public_draft" && request.allowFreeDraftRoute) {
    return FREE_OPENCODE_DRAFT_ROUTES[0];
  }
  if (request.capability === "classification" || request.capability === "summarization" || request.capability === "routine") {
    return GLM_45_AIR;
  }
  if (request.capability === "planning" || request.capability === "finance" || request.capability === "complex_synthesis" || request.capability === "strategy") {
    return GLM_5_TURBO;
  }
  if (request.capability === "coding" || request.capability === "debugging" || request.outputContract === "code_changes") {
    return GLM_51;
  }
  if (request.capability === "vision") {
    return GEMINI_3_FLASH;
  }
  return GLM_47;
}

function fallbackRoutesFor(routeId: HiddenModelRouteId, request: ModelRouteRequest) {
  const deepSeekFallback = request.highStakes || (request.failures ?? 0) >= 2 ? [DEEPSEEK_V4_PRO] : [];

  if (routeId === GLM_45_AIR) return uniqueRouteIds([GLM_47, GLM_5_TURBO, ...deepSeekFallback]);
  if (routeId === GLM_47) return uniqueRouteIds([GLM_5_TURBO, ...deepSeekFallback]);
  if (routeId === GLM_5_TURBO) return uniqueRouteIds([GLM_47, ...deepSeekFallback]);
  if (routeId === GLM_51) return uniqueRouteIds([GLM_5_TURBO, ...deepSeekFallback]);
  if (FREE_OPENCODE_DRAFT_ROUTES.includes(routeId)) return [GLM_47];
  if (routeId === GEMINI_3_FLASH) return [GLM_45_AIR];
  if (routeId === DEEPSEEK_V4_PRO) return [GLM_5_TURBO];
  return [GLM_47];
}

function verifierFor(routeId: HiddenModelRouteId, request: ModelRouteRequest): VerifierPolicy {
  const route = getHiddenModelRoute(routeId);
  const required =
    route.requiresVerifier ||
    Boolean(request.highStakes) ||
    Boolean(request.requiresReview) ||
    request.outputContract === "code_changes" ||
    request.capability === "finance" ||
    request.capability === "strategy" ||
    request.capability === "complex_synthesis";

  if (!required) return { required: false };

  const verifier =
    routeId === GLM_47 ? GLM_5_TURBO :
    routeId === GLM_5_TURBO ? GLM_47 :
    routeId === GLM_51 ? GLM_5_TURBO :
    route.provider === "gemini" || route.free ? GLM_47 :
    GLM_47;

  return {
    required: true,
    routeId: verifier,
    reason: route.free ? "Free draft routes require GLM review." : "Use a different route for review where practical.",
  };
}

export function selectModelRoute(args: ModelRouteRequest): ModelRouteSelection {
  const sensitivity = args.sensitivity ?? inferSensitivityFromText(args.text);
  const request = {
    capability: args.capability,
    outputContract: args.outputContract,
    redacted: args.redacted === true,
    allowFreeDraftRoute: args.allowFreeDraftRoute === true,
    sensitivity,
  };

  const requestedPrimary = primaryRouteFor(request);
  const primaryPrivacy = privacyForRoute(requestedPrimary, request);
  const selectedRouteId = primaryPrivacy.allowed ? requestedPrimary : GLM_47;
  const selectedPrivacy = primaryPrivacy.allowed
    ? primaryPrivacy
    : {
        ...privacyForRoute(selectedRouteId, { ...request, capability: "business_reasoning", outputContract: "plain_text" }),
        blockedReason: primaryPrivacy.blockedReason,
      };

  return {
    selectedRouteId,
    fallbackRouteIds: fallbackRoutesFor(selectedRouteId, args).filter((routeId) => routeId !== selectedRouteId),
    verifier: verifierFor(selectedRouteId, args),
    privacy: selectedPrivacy,
    blockedRouteId: primaryPrivacy.allowed ? undefined : requestedPrimary,
  };
}

export function routeRequestForCoreUseCase(args: {
  useCase: string;
  tier?: number;
  structured?: boolean;
  text?: string;
}): ModelRouteRequest {
  const outputContract = args.structured ? "structured_json" : "plain_text";
  const tier = args.tier ?? 1;
  const useCase = args.useCase;

  if (useCase === "classification" || useCase === "entity_fact_extraction") {
    return { capability: "classification", outputContract, text: args.text };
  }
  if (useCase === "summarization") {
    return { capability: "summarization", outputContract, text: args.text };
  }
  if (useCase === "workflow_suggestion" || tier >= 4) {
    return { capability: "planning", outputContract, highStakes: true, text: args.text };
  }
  if (useCase === "item_edit") {
    return { capability: "product_marketing_docs", outputContract: "library_item", text: args.text };
  }
  if (useCase === "greeting") {
    return { capability: "routine", outputContract, sensitivity: "public", text: args.text };
  }
  if (tier >= 3) {
    return { capability: "complex_synthesis", outputContract, text: args.text };
  }
  return { capability: "business_reasoning", outputContract, text: args.text };
}
