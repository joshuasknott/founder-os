import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const DEFAULT_API_BASE_URL = "https://api.vercel.com";
const DEFAULT_MAX_FILES = 300;
const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 18 * 1024 * 1024;

const EXCLUDED_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "coverage",
  "dist",
  "build",
  "node_modules",
]);

export class VercelConnectorError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "VercelConnectorError";
    this.safeMessage = options.safeMessage;
    this.status = options.status;
  }
}

function cleanString(value, maxLength = 240) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || undefined;
}

function cleanPath(value) {
  const cleaned = cleanString(value, 180);
  if (!cleaned) return undefined;
  return cleaned.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\.(\/|$)/g, "");
}

function cleanDomain(value) {
  const cleaned = cleanString(value, 180);
  if (!cleaned) return undefined;
  return cleaned
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function boolValue(value) {
  return value === true || value === "true" || value === "1";
}

export function vercelSettingsFromEnv(env = process.env) {
  return {
    enabled:
      boolValue(env.BUILDER_VERCEL_PREVIEWS) ||
      String(env.BUILDER_PREVIEW_PROVIDER ?? "").toLowerCase() === "vercel",
    token: cleanString(env.VERCEL_TOKEN ?? env.BUILDER_VERCEL_TOKEN, 2000),
    projectId: cleanString(env.VERCEL_PROJECT_ID ?? env.BUILDER_VERCEL_PROJECT_ID),
    projectName: cleanString(env.VERCEL_PROJECT_NAME ?? env.BUILDER_VERCEL_PROJECT_NAME),
    teamId: cleanString(env.VERCEL_TEAM_ID ?? env.BUILDER_VERCEL_TEAM_ID),
    productionDomain: cleanDomain(env.VERCEL_PRODUCTION_DOMAIN ?? env.BUILDER_VERCEL_PRODUCTION_DOMAIN),
    rootDirectory: cleanPath(env.VERCEL_ROOT_DIRECTORY ?? env.BUILDER_VERCEL_ROOT_DIRECTORY),
    framework: cleanString(env.VERCEL_FRAMEWORK ?? env.BUILDER_VERCEL_FRAMEWORK, 80),
    buildCommand: cleanString(env.VERCEL_BUILD_COMMAND ?? env.BUILDER_VERCEL_BUILD_COMMAND, 240),
    installCommand: cleanString(env.VERCEL_INSTALL_COMMAND ?? env.BUILDER_VERCEL_INSTALL_COMMAND, 240),
    outputDirectory: cleanPath(env.VERCEL_OUTPUT_DIRECTORY ?? env.BUILDER_VERCEL_OUTPUT_DIRECTORY),
    apiBaseUrl: cleanString(env.VERCEL_API_BASE_URL ?? env.BUILDER_VERCEL_API_BASE_URL, 240) ?? DEFAULT_API_BASE_URL,
    maxFiles: Number(env.BUILDER_VERCEL_MAX_FILES ?? DEFAULT_MAX_FILES),
    maxFileBytes: Number(env.BUILDER_VERCEL_MAX_FILE_BYTES ?? DEFAULT_MAX_FILE_BYTES),
    maxTotalBytes: Number(env.BUILDER_VERCEL_MAX_TOTAL_BYTES ?? DEFAULT_MAX_TOTAL_BYTES),
  };
}

export function vercelIsConfigured(settings = vercelSettingsFromEnv()) {
  return Boolean(
    settings.enabled &&
      settings.token &&
      (settings.projectId || settings.projectName),
  );
}

export function outputKindCanDeployPreview(kind) {
  return kind === "website" || kind === "tool" || kind === "internal_tool";
}

function normalizeUrl(value) {
  const raw = cleanString(value, 500);
  if (!raw) return undefined;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function firstString(...values) {
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

function shouldSkipName(name) {
  return EXCLUDED_NAMES.has(name) || name.startsWith(".env.");
}

async function walkFiles(rootDir, currentDir, files, limits) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipName(entry.name)) continue;
    const fullPath = join(currentDir, entry.name);
    const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");
    if (!relPath || relPath.startsWith("../")) continue;

    if (entry.isDirectory()) {
      await walkFiles(rootDir, fullPath, files, limits);
      continue;
    }

    if (!entry.isFile()) continue;
    const info = await lstat(fullPath);
    if (info.size > limits.maxFileBytes) continue;
    if (files.length >= limits.maxFiles) return;
    files.push({ fullPath, relPath, size: info.size });
  }
}

export async function collectVercelDeploymentFiles(workspaceDir, options = {}) {
  const limits = {
    maxFiles: Number(options.maxFiles ?? DEFAULT_MAX_FILES),
    maxFileBytes: Number(options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES),
    maxTotalBytes: Number(options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES),
  };
  const files = [];
  await walkFiles(workspaceDir, workspaceDir, files, limits);

  const selected = [];
  let totalBytes = 0;
  for (const file of files.sort((a, b) => a.relPath.localeCompare(b.relPath))) {
    if (totalBytes + file.size > limits.maxTotalBytes) continue;
    const bytes = await readFile(file.fullPath);
    totalBytes += bytes.length;
    selected.push({
      file: file.relPath,
      data: bytes.toString("base64"),
      encoding: "base64",
    });
  }

  return selected;
}

function queryUrl(settings, pathname) {
  const url = new URL(pathname, settings.apiBaseUrl ?? DEFAULT_API_BASE_URL);
  if (settings.teamId) url.searchParams.set("teamId", settings.teamId);
  return url.toString();
}

function requestHeaders(settings) {
  return {
    Authorization: `Bearer ${settings.token}`,
    "Content-Type": "application/json",
  };
}

async function parseResponseBody(response) {
  const text = typeof response.text === "function" ? await response.text() : "";
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function safeFailureFromPayload(payload) {
  const message = cleanString(payload?.error?.message ?? payload?.message, 180);
  if (!message) return undefined;
  if (/api|token|secret|key|http|json|payload|request|response|endpoint|bearer/i.test(message)) {
    return undefined;
  }
  return message;
}

export function safeVercelFailureMessage(error, fallback = "FounderOS could not create the preview link yet.") {
  const raw = error?.safeMessage ?? (error instanceof Error ? error.message : String(error ?? ""));
  const scrubbed = String(raw)
    .replace(/https?:\/\/\S+/gi, "the service")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b[A-Za-z0-9._-]*vercel[A-Za-z0-9._-]*_[A-Za-z0-9._-]{8,}\b/gi, "private credential")
    .replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, "private detail")
    .replace(/\{[\s\S]*\}/g, "details")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !scrubbed ||
    /api|token|secret|key|http|json|payload|request|response|endpoint|bearer|stack|trace/i.test(scrubbed)
  ) {
    return fallback;
  }

  return scrubbed.slice(0, 180);
}

function projectSettings(settings) {
  const projectSettingsBody = {};
  if (settings.framework) projectSettingsBody.framework = settings.framework;
  if (settings.rootDirectory) projectSettingsBody.rootDirectory = settings.rootDirectory;
  if (settings.buildCommand) projectSettingsBody.buildCommand = settings.buildCommand;
  if (settings.installCommand) projectSettingsBody.installCommand = settings.installCommand;
  if (settings.outputDirectory) projectSettingsBody.outputDirectory = settings.outputDirectory;
  return Object.keys(projectSettingsBody).length ? projectSettingsBody : undefined;
}

function projectIdentifier(settings) {
  return settings.projectId ?? settings.projectName;
}

function deploymentHash(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.file);
    hash.update(file.data);
  }
  return hash.digest("hex").slice(0, 16);
}

async function requestJson(request, url, init) {
  const response = await request(url, init);
  const payload = await parseResponseBody(response);
  if (!response.ok) {
    throw new VercelConnectorError(
      payload?.error?.message ?? payload?.message ?? `Vercel request failed with status ${response.status}`,
      {
        status: response.status,
        safeMessage: safeFailureFromPayload(payload),
      },
    );
  }
  return payload;
}

export async function createVercelPreviewDeployment({
  workspaceDir,
  settings = vercelSettingsFromEnv(),
  metadata = {},
  request = fetch,
  now = Date.now(),
} = {}) {
  if (!vercelIsConfigured(settings)) {
    throw new VercelConnectorError("Vercel preview deployment is not configured.", {
      safeMessage: "Preview publishing is not connected yet.",
    });
  }
  if (!workspaceDir) {
    throw new VercelConnectorError("Missing workspace directory.", {
      safeMessage: "FounderOS could not create the preview link yet.",
    });
  }

  const files = await collectVercelDeploymentFiles(workspaceDir, settings);
  if (files.length === 0) {
    throw new VercelConnectorError("No deployable files were found.", {
      safeMessage: "FounderOS could not find a review version to publish.",
    });
  }

  const body = {
    name: settings.projectName,
    project: projectIdentifier(settings),
    files,
    projectSettings: projectSettings(settings),
    meta: {
      founderos: "preview",
      source: "builder",
      ...metadata,
    },
  };

  const payload = await requestJson(request, queryUrl(settings, "/v13/deployments"), {
    method: "POST",
    headers: requestHeaders(settings),
    body: JSON.stringify(body),
  });
  const previewUrl = normalizeUrl(firstString(payload.url, payload.alias, payload.aliases));
  if (!previewUrl) {
    throw new VercelConnectorError("Vercel did not return a preview URL.", {
      safeMessage: "FounderOS could not create the preview link yet.",
    });
  }

  return {
    provider: "vercel",
    target: "preview",
    status: "ready",
    deploymentId: cleanString(payload.id ?? payload.uid),
    deploymentUrl: previewUrl,
    previewUrl,
    readyState: cleanString(payload.readyState ?? payload.state, 80),
    fileCount: files.length,
    contentHash: deploymentHash(files),
    safeMessage: "Preview created for review.",
    publishRequiresApproval: true,
    createdAt: now,
  };
}

export async function publishVercelDeployment({
  deploymentId,
  settings = vercelSettingsFromEnv(),
  productionDomain,
  request = fetch,
  now = Date.now(),
} = {}) {
  if (!vercelIsConfigured(settings)) {
    throw new VercelConnectorError("Vercel publishing is not configured.", {
      safeMessage: "Live publishing is not connected yet.",
    });
  }
  if (!deploymentId) {
    throw new VercelConnectorError("Missing deployment id.", {
      safeMessage: "The approved preview was not ready to publish.",
    });
  }

  const domain = cleanDomain(productionDomain ?? settings.productionDomain);
  if (domain) {
    const payload = await requestJson(
      request,
      queryUrl(settings, `/v2/deployments/${encodeURIComponent(deploymentId)}/aliases`),
      {
        method: "POST",
        headers: requestHeaders(settings),
        body: JSON.stringify({ alias: domain }),
      },
    );
    return {
      provider: "vercel",
      target: "production",
      status: "live",
      deploymentId,
      liveUrl: normalizeUrl(payload.alias ?? domain),
      safeMessage: "Approved site update published.",
      publishRequiresApproval: false,
      createdAt: now,
    };
  }

  const payload = await requestJson(request, queryUrl(settings, "/v13/deployments"), {
    method: "POST",
    headers: requestHeaders(settings),
    body: JSON.stringify({
      deploymentId,
      project: projectIdentifier(settings),
      target: "production",
    }),
  });

  return {
    provider: "vercel",
    target: "production",
    status: "live",
    deploymentId: cleanString(payload.id ?? payload.uid) ?? deploymentId,
    liveUrl: normalizeUrl(firstString(payload.url, payload.alias, payload.aliases)),
    safeMessage: "Approved site update published.",
    publishRequiresApproval: false,
    createdAt: now,
  };
}
