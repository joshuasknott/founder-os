import { providerAuthHeaders, type ConnectorRequest } from "./connectorProviderRuntime";
import { safeConnectorError, sanitizeVercelConnectionSettings, type VercelConnectionSettings } from "./connectorRuntime";

const DEFAULT_API_BASE_URL = "https://api.vercel.com";

export type VercelProviderSettings = VercelConnectionSettings & {
  token?: string;
  apiBaseUrl?: string;
};

export type VercelDeploymentFile = {
  file: string;
  data: string;
  encoding?: "base64" | "utf8";
};

function cleanString(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || undefined;
}

function normalizeUrl(value: unknown) {
  const raw = cleanString(value, 500);
  if (!raw) return undefined;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const fromArray = value.find((item) => typeof item === "string" && item.trim());
      if (fromArray) return fromArray;
      continue;
    }
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function queryUrl(settings: VercelProviderSettings, pathname: string) {
  const url = new URL(pathname, settings.apiBaseUrl ?? DEFAULT_API_BASE_URL);
  if (settings.teamId) url.searchParams.set("teamId", settings.teamId);
  return url.toString();
}

function requestHeaders(settings: VercelProviderSettings) {
  if (!settings.token) throw new Error("Add a Vercel token in Settings.");
  return {
    ...providerAuthHeaders("bearer", settings.token),
    "Content-Type": "application/json",
  };
}

async function parseResponseBody(response: Awaited<ReturnType<ConnectorRequest>>) {
  if (typeof response.text === "function") {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { message: text };
    }
  }
  return await response.json();
}

function safeFailureFromPayload(payload: unknown) {
  const source = recordValue(payload);
  const error = recordValue(source.error);
  const message = cleanString(error.message ?? source.message, 180);
  if (!message) return undefined;
  if (/api|token|secret|key|http|json|payload|request|response|endpoint|bearer/i.test(message)) {
    return undefined;
  }
  return message;
}

async function requestVercelJson(args: {
  request: ConnectorRequest;
  settings: VercelProviderSettings;
  pathname: string;
  init?: Parameters<ConnectorRequest>[1];
}) {
  const response = await args.request(queryUrl(args.settings, args.pathname), {
    ...args.init,
    headers: {
      ...requestHeaders(args.settings),
      ...(args.init?.headers ?? {}),
    },
  });
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    const safeMessage = safeFailureFromPayload(payload);
    throw new Error(safeMessage ?? `Vercel request failed with status ${response.status}`);
  }
  return payload;
}

function projectIdentifier(settings: VercelProviderSettings) {
  return settings.projectId ?? settings.projectName;
}

function projectSettings(settings: VercelProviderSettings) {
  const body: Record<string, string> = {};
  if (settings.framework) body.framework = settings.framework;
  if (settings.rootDirectory) body.rootDirectory = settings.rootDirectory;
  if (settings.buildCommand) body.buildCommand = settings.buildCommand;
  if (settings.installCommand) body.installCommand = settings.installCommand;
  if (settings.outputDirectory) body.outputDirectory = settings.outputDirectory;
  return Object.keys(body).length ? body : undefined;
}

function cleanDeploymentFiles(value: unknown): VercelDeploymentFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = recordValue(item);
    const file = cleanString(source.file, 240);
    const data = typeof source.data === "string" && source.data ? source.data : undefined;
    if (!file || !data || file.includes("..")) return [];
    return [{
      file: file.replace(/\\/g, "/").replace(/^\/+/, ""),
      data,
      encoding: source.encoding === "utf8" ? "utf8" as const : "base64" as const,
    }];
  });
}

export function vercelSettingsFromConnection(args: {
  token?: string;
  settings?: unknown;
  apiBaseUrl?: string;
}): VercelProviderSettings {
  return {
    ...sanitizeVercelConnectionSettings(args.settings),
    token: cleanString(args.token, 2000),
    apiBaseUrl: cleanString(args.apiBaseUrl, 240) ?? DEFAULT_API_BASE_URL,
  };
}

export function vercelProviderMissingConfig(settings: VercelProviderSettings) {
  const missing: string[] = [];
  if (!settings.token) missing.push("Vercel token");
  if (!projectIdentifier(settings)) missing.push("project ID or project name");
  return missing;
}

export function vercelProviderConfigured(settings: VercelProviderSettings) {
  return vercelProviderMissingConfig(settings).length === 0;
}

export function safeVercelProviderError(error: unknown, fallback = "Vercel could not finish that step.") {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/^Missing (Vercel token|project ID or project name|production domain)/i.test(raw)) {
    return raw.slice(0, 180);
  }
  if (/^Add a Vercel token in Settings\./i.test(raw)) {
    return "Missing Vercel token.";
  }
  return safeConnectorError(error, fallback);
}

export function normalizeVercelProject(payload: unknown) {
  const source = recordValue(payload);
  return {
    projectId: cleanString(source.id, 120),
    projectName: cleanString(source.name, 160),
    framework: cleanString(source.framework, 80),
    buildCommand: cleanString(source.buildCommand, 240),
    installCommand: cleanString(source.installCommand, 240),
    outputDirectory: cleanString(source.outputDirectory, 180),
    rootDirectory: cleanString(source.rootDirectory, 180),
  };
}

export async function listVercelProjects(args: {
  settings: VercelProviderSettings;
  search?: string;
  request: ConnectorRequest;
}) {
  if (!args.settings.token) {
    throw new Error("Add a Vercel token in Settings.");
  }

  const url = new URL(queryUrl(args.settings, "/v10/projects"));
  const search = cleanString(args.search, 100);
  if (search) url.searchParams.set("search", search);
  url.searchParams.set("limit", "20");

  const response = await args.request(url.toString(), {
    method: "GET",
    headers: requestHeaders(args.settings),
  });
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    const safeMessage = safeFailureFromPayload(payload);
    throw new Error(safeMessage ?? `Vercel request failed with status ${response.status}`);
  }

  const projects = Array.isArray(payload)
    ? payload
    : Array.isArray(recordValue(payload).projects)
      ? recordValue(payload).projects as unknown[]
      : [];
  return projects.map(normalizeVercelProject).filter((project) => project.projectId || project.projectName);
}

export async function confirmVercelProject(args: {
  settings: VercelProviderSettings;
  request: ConnectorRequest;
}) {
  const missing = vercelProviderMissingConfig(args.settings);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(" and ")}.`);
  }

  const identifier = encodeURIComponent(projectIdentifier(args.settings)!);
  const payload = await requestVercelJson({
    request: args.request,
    settings: args.settings,
    pathname: `/v9/projects/${identifier}`,
    init: { method: "GET" },
  });
  const project = normalizeVercelProject(payload);
  if (!project.projectId && !project.projectName) {
    throw new Error("Choose a Vercel project before FounderOS uses this connection.");
  }
  return project;
}

export async function validateVercelConnection(args: {
  settings: VercelProviderSettings;
  request: ConnectorRequest;
}) {
  const missing = vercelProviderMissingConfig(args.settings);
  if (missing.length > 0) {
    return {
      ok: false,
      status: "needs_attention" as const,
      healthy: false,
      safeMessage: `Missing ${missing.join(" and ")}.`,
    };
  }

  const project = await confirmVercelProject(args);
  return {
    ok: true,
    status: "connected" as const,
    healthy: true,
    safeMessage: `Connected to ${project.projectName ?? "the selected Vercel project"}.`,
    project,
  };
}

export async function createVercelDeploymentFromFiles(args: {
  settings: VercelProviderSettings;
  files: unknown;
  metadata?: unknown;
  request: ConnectorRequest;
  now?: number;
}) {
  const missing = vercelProviderMissingConfig(args.settings);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(" and ")}.`);
  }

  const files = cleanDeploymentFiles(args.files);
  if (files.length === 0) {
    throw new Error("A generated preview bundle is required before Vercel can create a review link.");
  }

  const payload = await requestVercelJson({
    request: args.request,
    settings: args.settings,
    pathname: "/v13/deployments",
    init: {
      method: "POST",
      body: JSON.stringify({
        name: args.settings.projectName,
        project: projectIdentifier(args.settings),
        files,
        projectSettings: projectSettings(args.settings),
        meta: {
          founderos: "preview",
          source: "settings_connector",
          ...recordValue(args.metadata),
        },
      }),
    },
  });
  const source = recordValue(payload);
  const previewUrl = normalizeUrl(firstString(source.url, source.alias, source.aliases));
  if (!previewUrl) {
    throw new Error("Vercel did not return a preview URL.");
  }

  return {
    status: "completed" as const,
    safeSummary: "Preview created for review.",
    externalId: cleanString(source.id ?? source.uid, 160),
    providerUrl: previewUrl,
    metadata: {
      provider: "vercel",
      target: "preview",
      deploymentId: cleanString(source.id ?? source.uid, 160),
      previewUrl,
      readyState: cleanString(source.readyState ?? source.state, 80),
      fileCount: files.length,
      publishRequiresApproval: true,
      createdAt: args.now ?? Date.now(),
    },
  };
}

export async function publishVercelDeploymentFromSettings(args: {
  settings: VercelProviderSettings;
  deploymentId?: unknown;
  productionDomain?: unknown;
  request: ConnectorRequest;
  now?: number;
}) {
  const missing = vercelProviderMissingConfig(args.settings);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(" and ")}.`);
  }
  const deploymentId = cleanString(args.deploymentId, 180);
  if (!deploymentId) {
    throw new Error("The approved preview was not ready to publish.");
  }
  const productionDomain = sanitizeVercelConnectionSettings({
    productionDomain: args.productionDomain ?? args.settings.productionDomain,
  }).productionDomain;
  if (!productionDomain) {
    throw new Error("Missing production domain.");
  }

  const payload = await requestVercelJson({
    request: args.request,
    settings: args.settings,
    pathname: `/v2/deployments/${encodeURIComponent(deploymentId)}/aliases`,
    init: {
      method: "POST",
      body: JSON.stringify({ alias: productionDomain }),
    },
  });
  const source = recordValue(payload);
  const liveUrl = normalizeUrl(source.alias ?? productionDomain);

  return {
    status: "completed" as const,
    safeSummary: "Approved site update published.",
    externalId: deploymentId,
    providerUrl: liveUrl,
    metadata: {
      provider: "vercel",
      target: "production",
      deploymentId,
      liveUrl,
      publishRequiresApproval: false,
      createdAt: args.now ?? Date.now(),
    },
  };
}
