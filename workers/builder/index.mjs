import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { Codex } from "@openai/codex-sdk";
import { api } from "../../convex/_generated/api.js";
import {
  createVercelPreviewDeployment,
  outputKindCanDeployPreview,
  publishVercelDeployment,
  safeVercelFailureMessage,
  vercelIsConfigured,
  vercelSettingsFromEnv,
} from "./vercelConnector.mjs";
import {
  buildOpenCodeArgs,
  builderProviderHelp,
  selectOpenCodeModelForRun,
  selectBuilderAgent,
} from "./agentAdapters.mjs";

const POLL_INTERVAL_MS = Number(process.env.BUILDER_POLL_INTERVAL_MS ?? 5000);
const PREVIEW_URL = process.env.BUILDER_PREVIEW_URL ?? "http://localhost:3000";
const ROOT_WORKSPACE_DIR = resolve(process.env.BUILDER_WORKSPACE_DIR ?? process.cwd());
const BUILDER_AGENT_ENV = buildBuilderAgentEnv(process.env);
const BUILDER_AGENT = selectBuilderAgent(BUILDER_AGENT_ENV);
const BUILDER_PROVIDER = BUILDER_AGENT.provider;
const BUILDER_ADAPTER = BUILDER_AGENT.adapter;
const START_PREVIEW = process.env.BUILDER_START_PREVIEW === "true";
const PREVIEW_COMMAND = process.env.BUILDER_PREVIEW_COMMAND ?? "npm run dev";
const PREVIEW_TIMEOUT_MS = Number(process.env.BUILDER_PREVIEW_TIMEOUT_MS ?? 30000);
const WORKER_ID = process.env.BUILDER_WORKER_ID ?? `builder:${process.pid}`;
const LEASE_MS = Number(process.env.BUILDER_LEASE_MS ?? 10 * 60 * 1000);
const ISOLATION_MODE = process.env.BUILDER_ISOLATION_MODE ?? "auto";
const BUILD_RUNS_DIR = resolve(
  process.env.BUILDER_RUNS_DIR ?? join(tmpdir(), "founderos-builder-runs"),
);
const BRANCH_PREFIX = process.env.BUILDER_BRANCH_PREFIX ?? "codex/founderos-build";
const CLEAN_WORKSPACE_AFTER_RUN = process.env.BUILDER_CLEAN_WORKSPACE_AFTER_RUN === "true";
const TEST_TIMEOUT_MS = Number(process.env.BUILDER_TEST_TIMEOUT_MS ?? 120000);
const REPAIR_ATTEMPTS = Number(process.env.BUILDER_REPAIR_ATTEMPTS ?? 1);
const MAX_CAPTURED_OUTPUT_CHARS = 6000;
const MAX_SNAPSHOT_FILE_BYTES = Number(process.env.BUILDER_SNAPSHOT_FILE_BYTES ?? 5 * 1024 * 1024);
const MAX_LLM_CONTEXT_CHARS = Number(
  process.env.BUILDER_LLM_CONTEXT_CHARS ??
  process.env.BUILDER_DEEPSEEK_CONTEXT_CHARS ??
  120000,
);
const MAX_LLM_FILE_CHARS = Number(
  process.env.BUILDER_LLM_FILE_CHARS ??
  process.env.BUILDER_DEEPSEEK_FILE_CHARS ??
  50000,
);

const CODEX_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description: "One short plain-language summary of what is ready.",
    },
    reviewNotes: {
      type: "array",
      items: { type: "string" },
      description: "Plain-language notes the founder should know before approval or launch.",
    },
    externalActionRequested: {
      type: "boolean",
      description: "Whether the founder asked for publishing, deployment, sending, spending, deletion, or outreach.",
    },
    publishOrDeployBlocked: {
      type: "boolean",
      description: "True when any publish, deploy, or live-site update was requested but not performed.",
    },
  },
  required: ["summary", "reviewNotes", "externalActionRequested", "publishOrDeployBlocked"],
};

const COPY_EXCLUDED_NAMES = new Set([
  ".git",
  ".founderos",
  ".next",
  ".turbo",
  ".vercel",
  "coverage",
  "dist",
  "build",
  "node_modules",
]);

const SNAPSHOT_EXCLUDED_NAMES = new Set([
  ".git",
  ".founderos",
  ".next",
  ".turbo",
  ".vercel",
  "coverage",
  "dist",
  "build",
  "node_modules",
]);

const PROHIBITED_EXTERNAL_ACTIONS = [
  "Do not publish publicly.",
  "Do not deploy.",
  "Do not push to a remote repository.",
  "Do not change a live asset.",
  "Do not send messages or contact external people.",
  "Do not spend money.",
  "Do not delete important data.",
];

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

function buildBuilderAgentEnv(env = process.env) {
  const localNames = [
    "BUILDER_AGENT",
    "BUILDER_PROVIDER",
    "BUILDER_USE_CODEX",
    "BUILDER_AGENT_TIMEOUT_MS",
    "BUILDER_OPENCODE_TIMEOUT_MS",
    "BUILDER_OPENCODE_COMMAND",
    "BUILDER_OPENCODE_MODEL",
    "BUILDER_OPENCODE_AGENT",
    "BUILDER_OPENCODE_ATTACH_URL",
    "BUILDER_MODEL",
    "FOUNDEROS_OPENCODE_BUSINESS_MODEL",
    "FOUNDEROS_OPENCODE_PLANNING_MODEL",
    "FOUNDEROS_OPENCODE_CODING_MODEL",
    "BUILDER_CODEX_MODEL",
    "BUILDER_CODEX_REASONING_EFFORT",
    "BUILDER_LLM_API_KEY",
    "BUILDER_LLM_CHAT_COMPLETIONS_URL",
    "BUILDER_LLM_BASE_URL",
    "BUILDER_LLM_MODEL",
    "BUILDER_DEEPSEEK_BASE_URL",
    "BUILDER_DEEPSEEK_MODEL",
    "DEEPSEEK_API_KEY",
    "DEEPSEEK_BASE_URL",
    "DEEPSEEK_MODEL",
    "OPENROUTER_API_KEY",
    "OPENROUTER_BASE_URL",
    "OPENROUTER_MODEL",
    "ZAI_API_KEY",
    "ZAI_MODEL",
    "Z_AI_API_KEY",
    "ZHIPU_API_KEY",
  ];
  const merged = { ...env };
  for (const name of localNames) {
    if (merged[name]) continue;
    const localValue = readLocalEnv(name);
    if (localValue) merged[name] = localValue;
  }
  return merged;
}

function convexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    readLocalEnv("CONVEX_URL") ||
    readLocalEnv("NEXT_PUBLIC_CONVEX_URL")
  );
}

function workerToken() {
  const token = process.env.FOUNDEROS_WORKER_TOKEN || readLocalEnv("FOUNDEROS_WORKER_TOKEN");
  if (!token) throw new Error("Set FOUNDEROS_WORKER_TOKEN before running the builder.");
  return token;
}

function openAiKey() {
  return process.env.OPENAI_API_KEY || readLocalEnv("OPENAI_API_KEY");
}

function deepSeekKey() {
  return process.env.DEEPSEEK_API_KEY || readLocalEnv("DEEPSEEK_API_KEY");
}

function zAiKey() {
  return (
    process.env.ZAI_API_KEY ||
    process.env.Z_AI_API_KEY ||
    process.env.ZHIPU_API_KEY ||
    readLocalEnv("ZAI_API_KEY") ||
    readLocalEnv("Z_AI_API_KEY") ||
    readLocalEnv("ZHIPU_API_KEY")
  );
}

function llmApiKey() {
  const names = BUILDER_AGENT.apiKeyEnvNames ?? ["BUILDER_LLM_API_KEY"];
  for (const name of names) {
    const value = process.env[name] || readLocalEnv(name);
    if (value) return value;
  }
  return BUILDER_PROVIDER === "zai" ? zAiKey() : deepSeekKey();
}

function llmChatCompletionsUrl() {
  const explicit =
    process.env.BUILDER_LLM_CHAT_COMPLETIONS_URL ||
    readLocalEnv("BUILDER_LLM_CHAT_COMPLETIONS_URL");
  if (explicit) return explicit;

  if (BUILDER_AGENT.chatCompletionsUrl) return BUILDER_AGENT.chatCompletionsUrl;

  const baseUrl = (
    process.env.BUILDER_LLM_BASE_URL ||
    process.env.BUILDER_DEEPSEEK_BASE_URL ||
    process.env.DEEPSEEK_BASE_URL ||
    readLocalEnv("BUILDER_LLM_BASE_URL") ||
    readLocalEnv("BUILDER_DEEPSEEK_BASE_URL") ||
    readLocalEnv("DEEPSEEK_BASE_URL") ||
    "https://api.deepseek.com"
  ).replace(/\/+$/, "");
  return `${baseUrl}/chat/completions`;
}

function llmModel() {
  return (
    process.env.BUILDER_LLM_MODEL ||
    process.env.BUILDER_DEEPSEEK_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    readLocalEnv("BUILDER_LLM_MODEL") ||
    readLocalEnv("BUILDER_DEEPSEEK_MODEL") ||
    readLocalEnv("DEEPSEEK_MODEL") ||
    BUILDER_AGENT.model ||
    (BUILDER_PROVIDER === "zai" ? "glm-5.1" : "deepseek-chat")
  );
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function sanitizeSlug(value) {
  return String(value ?? "run")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "run";
}

function sanitizeBranchName(value) {
  return String(value)
    .replace(/[^A-Za-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/(^\/+|\/+$)/g, "")
    .replace(/\.\.+/g, "-")
    .replace(/\.lock$/i, "-lock");
}

function buildRunSlug(run) {
  return sanitizeSlug(`${run?._id ?? "run"}-${run?.attemptCount ?? 0}-${Date.now()}`);
}

function assertNotRootDirectory(directory, label) {
  const resolved = resolve(directory);
  if (dirname(resolved) === resolved) {
    throw new Error(`${label} cannot be the filesystem root.`);
  }
}

function assertChildPath(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Build workspace path is outside the configured runs directory.");
  }
}

function isSafeRelativePath(value) {
  if (!value || typeof value !== "string") return false;
  if (isAbsolute(value)) return false;
  const normalized = normalizePath(value);
  return !normalized.split("/").some((part) => part === "..");
}

function safeRelativePath(value) {
  if (!isSafeRelativePath(value)) return null;
  const cleaned = normalizePath(value).replace(/^\.\/+/, "");
  if (!cleaned || shouldExcludeRelativePath(cleaned, SNAPSHOT_EXCLUDED_NAMES)) return null;
  if (/^\.env(?:\.|$)/.test(cleaned)) return null;
  return cleaned;
}

function toPlainFounderText(message, fallback = "A first review version is ready.") {
  const cleaned = String(message ?? "")
    .replace(/\bwork\s*runs?\b|\bworkRuns\b/gi, "work")
    .replace(/\bdirectives?\b/gi, "tasks")
    .replace(/\bconnectors?\b/gi, "connections")
    .replace(/\btool calls?\b|\btool invocations?\b/gi, "steps")
    .replace(/\bcommands?\b/gi, "checks")
    .replace(/\bterminal\b|\bstdout\b|\bstderr\b|\bstack trace\b/gi, "workspace")
    .replace(/\bAPI\b|\bSDK\b|\bCLI\b/gi, "connection")
    .replace(/\bVercel\b/gi, "preview service")
    .replace(/\bCodex\b|\bOpenCode\b|\bDeepSeek\b|\bOpenRouter\b|\bZ\.ai\b|\bZAI\b/gi, "FounderOS")
    .replace(/\bprovider(s)?\b|\bmodel(s)?\b/gi, "setting$1")
    .replace(/\bcommit\b|\bbranch\b/gi, "version")
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/[A-Za-z]:[\\/][^\s)]+/g, "the workspace")
    .replace(/(?:^|\s)(?:\.\.?[\\/])?[^\s`'"]+\.(?:tsx?|jsx?|mjs|cjs|css|json|md)(?=\s|$)/g, " a saved file")
    .replace(/`+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

function sanitizeInternalLog(value) {
  return String(value ?? "")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***")
    .slice(-MAX_CAPTURED_OUTPUT_CHARS);
}

function execFileCapture(command, args, options = {}) {
  return new Promise((resolveCapture, rejectCapture) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        windowsHide: true,
        timeout: options.timeoutMs ?? 60000,
        maxBuffer: options.maxBuffer ?? 5 * 1024 * 1024,
        env: options.env ?? process.env,
      },
      (error, stdout, stderr) => {
        const result = {
          ok: !error,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          timedOut: Boolean(error?.killed),
        };

        if (error && !options.allowFailure) {
          const message = stderr.trim() || stdout.trim() || error.message;
          rejectCapture(new Error(message));
          return;
        }

        resolveCapture(result);
      },
    );
  });
}

async function execGit(args, options = {}) {
  try {
    return await execFileCapture("git", args, {
      cwd: options.cwd ?? ROOT_WORKSPACE_DIR,
      allowFailure: true,
      timeoutMs: options.timeoutMs ?? 60000,
    });
  } catch {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: 1,
      timedOut: false,
    };
  }
}

async function sourceMetadata(workspaceDir = ROOT_WORKSPACE_DIR) {
  const [branch, commitSha, status] = await Promise.all([
    execGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: workspaceDir }),
    execGit(["rev-parse", "HEAD"], { cwd: workspaceDir }),
    execGit(["status", "--short"], { cwd: workspaceDir }),
  ]);

  return {
    source: branch.ok ? "local_git" : "safe_workspace",
    branch: branch.ok ? branch.stdout : null,
    commitSha: commitSha.ok ? commitSha.stdout : null,
    hasUncommittedChanges: Boolean(status.stdout),
  };
}

function deploymentMetadata(previewStatus) {
  const deployment = previewStatus?.deployment ?? {};
  return {
    provider: deployment.provider ?? previewStatus?.provider ?? process.env.BUILDER_PREVIEW_PROVIDER ?? "local",
    projectId: process.env.VERCEL_PROJECT_ID ?? null,
    teamId: process.env.VERCEL_TEAM_ID ?? null,
    target: deployment.target ?? "preview",
    status: deployment.status ?? (previewStatus?.available ? "ready" : "failed"),
    deploymentId: deployment.deploymentId ?? null,
    previewUrl: deployment.previewUrl ?? previewStatus?.url ?? null,
    liveUrl: deployment.liveUrl ?? null,
    safeError: deployment.safeError,
    safeMessage: deployment.safeMessage,
    createdAt: deployment.createdAt ?? Date.now(),
    publishRequiresApproval: true,
  };
}

async function isPreviewReachable(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok || response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function startPreviewProcess(workspaceDir) {
  const child = spawn(PREVIEW_COMMAND, {
    cwd: workspaceDir,
    detached: true,
    shell: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function ensurePreviewStatus(workspaceDir = ROOT_WORKSPACE_DIR) {
  if (await isPreviewReachable(PREVIEW_URL)) {
    return {
      available: true,
      started: false,
      url: PREVIEW_URL,
      provider: process.env.BUILDER_PREVIEW_PROVIDER ?? "local",
    };
  }

  if (!START_PREVIEW) {
    return {
      available: false,
      started: false,
      url: null,
      provider: process.env.BUILDER_PREVIEW_PROVIDER ?? "local",
    };
  }

  startPreviewProcess(workspaceDir);
  const startedAt = Date.now();

  while (Date.now() - startedAt < PREVIEW_TIMEOUT_MS) {
    await sleep(1000);
    if (await isPreviewReachable(PREVIEW_URL)) {
      return {
        available: true,
        started: true,
        url: PREVIEW_URL,
        provider: process.env.BUILDER_PREVIEW_PROVIDER ?? "local",
      };
    }
  }

  return {
    available: false,
    started: true,
    url: null,
    provider: process.env.BUILDER_PREVIEW_PROVIDER ?? "local",
  };
}

function outputKindForPreviewDeployment(run, directive) {
  return run?.classification?.outputItemKind ?? outputKindForRun(run, directive);
}

async function createReviewPreviewStatus(workspaceDir = ROOT_WORKSPACE_DIR, run, directive) {
  const localStatus = await ensurePreviewStatus(workspaceDir);
  const outputKind = outputKindForPreviewDeployment(run, directive);
  const settings = vercelSettingsFromEnv();

  if (!outputKindCanDeployPreview(outputKind) || !vercelIsConfigured(settings)) {
    return localStatus;
  }

  try {
    const deployment = await createVercelPreviewDeployment({
      workspaceDir,
      settings,
      metadata: {
        runId: String(run?._id ?? ""),
        outputKind,
        approvalRequiredForLive: "true",
      },
    });

    return {
      available: true,
      started: localStatus.started,
      url: deployment.previewUrl,
      provider: deployment.provider,
      deployment,
    };
  } catch (error) {
    const safeError = safeVercelFailureMessage(error);
    return {
      ...localStatus,
      deployment: {
        provider: "vercel",
        target: "preview",
        status: "failed",
        safeError,
        previewUrl: localStatus.url,
        publishRequiresApproval: true,
        createdAt: Date.now(),
      },
      safeMessage: safeError,
    };
  }
}

async function append(client, runId, message, tone = "progress") {
  await client.mutation(api.workRuns.appendUpdate, {
    runId,
    message,
    tone,
    workerToken: workerToken(),
  });
}

function shouldExcludeRelativePath(relPath, excludedNames) {
  if (!relPath) return false;
  const parts = normalizePath(relPath).split("/");
  return parts.some((part) => excludedNames.has(part));
}

async function linkSharedDependencyDirs(sourceDir, workingDirectory) {
  const sourceNodeModules = join(sourceDir, "node_modules");
  const targetNodeModules = join(workingDirectory, "node_modules");
  if (!existsSync(sourceNodeModules) || existsSync(targetNodeModules)) return false;

  try {
    await symlink(
      sourceNodeModules,
      targetNodeModules,
      process.platform === "win32" ? "junction" : "dir",
    );
    return true;
  } catch {
    return false;
  }
}

async function copyWorkspace(sourceDir, workingDirectory) {
  await mkdir(dirname(workingDirectory), { recursive: true });
  await cp(sourceDir, workingDirectory, {
    recursive: true,
    dereference: false,
    filter: (source) => {
      const relPath = relative(sourceDir, source);
      return !shouldExcludeRelativePath(relPath, COPY_EXCLUDED_NAMES);
    },
  });
  await linkSharedDependencyDirs(sourceDir, workingDirectory);
}

async function createGitWorktree(sourceDir, workingDirectory, slug) {
  const branchName = sanitizeBranchName(`${BRANCH_PREFIX}/${slug}`);
  const result = await execGit(
    ["worktree", "add", "-b", branchName, workingDirectory, "HEAD"],
    { cwd: sourceDir, timeoutMs: 120000 },
  );

  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || "Could not create isolated workspace.");
  }

  await linkSharedDependencyDirs(sourceDir, workingDirectory);
  return {
    isolation: "git_worktree",
    branch: branchName,
  };
}

async function createBuildWorkspace(run, options = {}) {
  const sourceDir = resolve(options.sourceDir ?? ROOT_WORKSPACE_DIR);
  const mode = options.mode ?? ISOLATION_MODE;
  const runsDir = resolve(options.runsDir ?? BUILD_RUNS_DIR);

  assertNotRootDirectory(sourceDir, "Builder workspace");
  assertNotRootDirectory(runsDir, "Builder runs directory");
  await mkdir(runsDir, { recursive: true });

  if (mode === "workspace") {
    return {
      isolation: "workspace",
      workingDirectory: sourceDir,
      sourceDirectory: sourceDir,
      branch: null,
      cleanup: async () => {},
    };
  }

  const slug = options.slug ?? buildRunSlug(run);
  const workingDirectory = resolve(join(runsDir, slug));
  assertChildPath(runsDir, workingDirectory);

  const gitStatus = await execGit(["status", "--porcelain"], { cwd: sourceDir });
  const canUseWorktree =
    gitStatus.ok &&
    (mode === "worktree" || (mode === "auto" && !gitStatus.stdout.trim()));

  if (canUseWorktree) {
    try {
      const worktree = await createGitWorktree(sourceDir, workingDirectory, slug);
      return {
        ...worktree,
        workingDirectory,
        sourceDirectory: sourceDir,
        cleanup: async () => {
          if (!CLEAN_WORKSPACE_AFTER_RUN) return;
          await execGit(["worktree", "remove", "--force", workingDirectory], { cwd: sourceDir });
        },
      };
    } catch (error) {
      if (mode === "worktree") throw error;
    }
  }

  if (mode !== "auto" && mode !== "copy") {
    throw new Error("Builder isolation mode must be auto, worktree, copy, or workspace.");
  }

  await copyWorkspace(sourceDir, workingDirectory);
  return {
    isolation: "safe_copy",
    workingDirectory,
    sourceDirectory: sourceDir,
    branch: null,
    cleanup: async () => {
      if (!CLEAN_WORKSPACE_AFTER_RUN) return;
      await rm(workingDirectory, { recursive: true, force: true });
    },
  };
}

async function hashFile(filePath) {
  const file = await readFile(filePath);
  return createHash("sha256").update(file).digest("hex");
}

async function snapshotWorkspaceFiles(rootDir) {
  const root = resolve(rootDir);
  const snapshot = new Map();

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      const relPath = normalizePath(relative(root, absolutePath));
      if (shouldExcludeRelativePath(relPath, SNAPSHOT_EXCLUDED_NAMES)) continue;

      const entryStat = entry.isSymbolicLink()
        ? await lstat(absolutePath)
        : await stat(absolutePath);

      if (entryStat.isSymbolicLink()) continue;
      if (entryStat.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entryStat.isFile()) continue;

      snapshot.set(relPath, {
        size: entryStat.size,
        hash:
          entryStat.size <= MAX_SNAPSHOT_FILE_BYTES
            ? await hashFile(absolutePath)
            : `large:${entryStat.size}:${Math.floor(entryStat.mtimeMs)}`,
      });
    }
  }

  await walk(root);
  return snapshot;
}

function diffWorkspaceSnapshots(before, after) {
  const changed = [];
  const allPaths = new Set([...before.keys(), ...after.keys()]);

  for (const filePath of [...allPaths].sort()) {
    const previous = before.get(filePath);
    const current = after.get(filePath);
    if (!previous && current) {
      changed.push({ path: filePath, status: "added" });
      continue;
    }
    if (previous && !current) {
      changed.push({ path: filePath, status: "deleted" });
      continue;
    }
    if (previous && current && (previous.hash !== current.hash || previous.size !== current.size)) {
      changed.push({ path: filePath, status: "modified" });
    }
  }

  return changed;
}

async function captureChangedFiles(workingDirectory, baselineSnapshot, eventPaths = []) {
  const afterSnapshot = await snapshotWorkspaceFiles(workingDirectory);
  const diff = diffWorkspaceSnapshots(baselineSnapshot, afterSnapshot);
  const byPath = new Map(diff.map((change) => [change.path, change]));

  for (const eventPath of eventPaths) {
    const safePath = safeRelativePath(eventPath);
    if (safePath && !byPath.has(safePath)) {
      byPath.set(safePath, { path: safePath, status: "modified" });
    }
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function parseConfiguredTestCommands() {
  if (process.env.BUILDER_SKIP_TESTS === "true") return [];
  const configured = process.env.BUILDER_TEST_COMMANDS;
  if (!configured) return null;

  try {
    const parsed = JSON.parse(configured);
    if (Array.isArray(parsed)) {
      return parsed.filter((value) => typeof value === "string" && value.trim());
    }
  } catch {
    // Fall back to a simple separator format for local setup.
  }

  return configured
    .split(/\r?\n|;/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function defaultTestCommands(workingDirectory) {
  const configured = parseConfiguredTestCommands();
  if (configured) return configured;

  try {
    const packageJson = JSON.parse(await readFile(join(workingDirectory, "package.json"), "utf8"));
    if (packageJson?.scripts?.test) return ["npm test"];
  } catch {
    return [];
  }

  return [];
}

function runShellCommand(command, workingDirectory, timeoutMs) {
  return new Promise((resolveRun) => {
    const startedAt = Date.now();
    const child = spawn(command, {
      cwd: workingDirectory,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        CI: process.env.CI ?? "true",
      },
    });
    const chunks = [];

    function capture(chunk) {
      chunks.push(Buffer.from(chunk));
      const totalLength = chunks.reduce((sum, item) => sum + item.length, 0);
      while (totalLength > MAX_CAPTURED_OUTPUT_CHARS * 2 && chunks.length > 1) {
        chunks.shift();
      }
    }

    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);

    const timeout = setTimeout(() => {
      child.kill();
      resolveRun({
        command,
        status: "timed_out",
        exitCode: null,
        durationMs: Date.now() - startedAt,
        outputTail: sanitizeInternalLog(Buffer.concat(chunks).toString("utf8")),
      });
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolveRun({
        command,
        status: "failed",
        exitCode: null,
        durationMs: Date.now() - startedAt,
        outputTail: sanitizeInternalLog(error.message),
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolveRun({
        command,
        status: code === 0 ? "passed" : "failed",
        exitCode: code,
        durationMs: Date.now() - startedAt,
        outputTail: sanitizeInternalLog(Buffer.concat(chunks).toString("utf8")),
      });
    });
  });
}

async function runTestCommands(workingDirectory) {
  const commands = await defaultTestCommands(workingDirectory);
  if (commands.length === 0) {
    return {
      status: "skipped",
      summary: "No checks were configured for this preview.",
      commands: [],
    };
  }

  const results = [];
  for (const command of commands.slice(0, 3)) {
    const result = await runShellCommand(command, workingDirectory, TEST_TIMEOUT_MS);
    results.push(result);
    if (result.status !== "passed") break;
  }

  const status = results.every((result) => result.status === "passed")
    ? "passed"
    : results.some((result) => result.status === "timed_out")
      ? "timed_out"
      : "failed";

  const summary =
    status === "passed"
      ? "Checks passed."
      : status === "timed_out"
        ? "A check took too long and needs attention."
        : "A check needs attention.";

  return { status, summary, commands: results };
}

function checksNeedRepair(testResults) {
  return testResults.status === "failed" || testResults.status === "timed_out";
}

function compactCheckResults(testResults) {
  return {
    status: testResults.status,
    summary: testResults.summary,
    commands: (testResults.commands ?? []).map((result) => ({
      status: result.status,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      outputTail: result.outputTail?.slice(-3000),
    })),
  };
}

function buildRepairPrompt(taskSpec, testResults) {
  return [
    "The review version was built, but one check needs attention.",
    "Repair the workspace in place, keeping the founder's requested product outcome unchanged.",
    "Do not publish, deploy, push, send messages, spend money, delete data, or contact external people.",
    "Keep final user-facing wording plain and non-technical.",
    "",
    "Task spec JSON:",
    JSON.stringify(taskSpec, null, 2),
    "",
    "Check result JSON:",
    JSON.stringify(compactCheckResults(testResults), null, 2),
    "",
    "Return only strict JSON with this shape:",
    JSON.stringify({
      summary: "Plain-language summary of the repair.",
      reviewNotes: ["Plain-language note."],
      externalActionRequested: false,
      publishOrDeployBlocked: false,
      files: [
        {
          path: "app/page.tsx",
          content: "Full file content here when using the chat-completions adapter.",
        },
      ],
      deleteFiles: [],
    }, null, 2),
  ].join("\n");
}

function detectSensitiveExternalAction(objective = "") {
  const text = objective.toLowerCase();
  const previewOnly =
    /\b(preview|review link|review version)\b/.test(text) &&
    !/\b(go live|live|production|publicly publish|publish publicly|ship live)\b/.test(text);
  if (previewOnly && /\b(deploy|deployment|share|publish)\b/.test(text)) return null;

  if (/\b(deploy|deployment|go live|launch live|ship live|publish|publicly publish)\b/.test(text)) {
    return {
      actionKind: "publish_preview",
      actionTitle: "Publish this preview",
      actionDescription: "This will make the preview visible outside your private workspace.",
    };
  }
  if (/\b(update|change|replace)\b.*\b(live|production|public)\b/.test(text)) {
    return {
      actionKind: "change_live_asset",
      actionTitle: "Update the live version",
      actionDescription: "This will change something already visible outside your private workspace.",
    };
  }
  if (/\b(send|email|message|contact)\b.*\b(customer|client|lead|user|external|partner|vendor)\b/.test(text)) {
    return {
      actionKind: "send_email",
      actionTitle: "Contact someone outside the workspace",
      actionDescription: "This will send a message or contact someone outside your workspace.",
    };
  }
  if (/\b(spend|charge|buy|purchase|subscribe|paid)\b/.test(text)) {
    return {
      actionKind: "spend_money",
      actionTitle: "Spend money",
      actionDescription: "This may create a charge or commit budget.",
    };
  }
  if (/\b(delete|remove|destroy)\b.*\b(data|record|customer|file|database)\b/.test(text)) {
    return {
      actionKind: "delete_data",
      actionTitle: "Delete data",
      actionDescription: "This can remove business data.",
    };
  }

  return null;
}

function outputKindForRun(run, directive) {
  const classifiedKind = run?.classification?.outputItemKind;
  if (classifiedKind === "tool" || classifiedKind === "internal_tool") return classifiedKind;
  if (classifiedKind === "website") return "website";

  const text = `${run?.title ?? ""} ${directive?.title ?? ""} ${directive?.objective ?? ""}`.toLowerCase();
  if (/\b(internal tool|tool|dashboard|calculator|crm|admin|web app|app)\b/.test(text)) {
    return text.includes("internal tool") ? "internal_tool" : "tool";
  }
  return "website";
}

function plainOutputLabel(outputKind) {
  if (outputKind === "website") return "website";
  if (outputKind === "internal_tool") return "internal tool";
  if (outputKind === "tool") return "tool";
  return "product";
}

function planProductBuild(run, directive, outputKind = outputKindForRun(run, directive)) {
  const label = plainOutputLabel(outputKind);
  const objective = toPlainFounderText(directive?.objective, run?.title ?? "Build the requested product.");
  return {
    outcome: `Create a reviewable ${label} from the founder's request.`,
    steps: [
      "Turn the request into a small product plan.",
      "Build the first usable review version in an isolated workspace.",
      "Run configured checks and repair issues when possible.",
      "Prepare a private preview and save the result to Library.",
      "Use the founder's requested changes to create another review version.",
      "Ask for approval before anything is published or changed live.",
    ],
    reviewLoop: "The founder reviews the preview, asks for changes, and FounderOS prepares the next version.",
    publishing: "Preview links can be prepared privately. Live publishing waits for explicit approval.",
    history: "Each review result is saved as a Library version with deployment history when available.",
    rollback: "Previous Library versions remain available for handoff, comparison, or rollback planning.",
    objective,
  };
}

function buildTaskSpec(run, directive, workspace, builderAgent = BUILDER_AGENT) {
  const externalAction = detectSensitiveExternalAction(directive.objective);
  const outputKind = outputKindForRun(run, directive);
  const productPlan = planProductBuild(run, directive, outputKind);

  return {
    task: {
      title: run.title || directive.title,
      objective: directive.objective,
      runKind: run.kind,
      outputKind,
    },
    productPlan,
    builder: {
      adapter: builderAgent.adapter,
      hiddenFromFounder: true,
      preferredRealAdapter: "opencode",
    },
    orchestration: {
      hiddenFromFounder: true,
      selectedRoute: builderAgent.orchestration?.model ?? builderAgent.model,
      sensitivity: builderAgent.orchestration?.sensitivity,
      outputContract: builderAgent.orchestration?.outputContract,
      verifierRoute: builderAgent.orchestration?.verifierModel,
      freeRouteBlocked: builderAgent.orchestration?.freeRouteBlocked,
    },
    workspace: {
      isolation: workspace.isolation,
      safeWorkingDirectory: true,
    },
    founderExperience: {
      updates: "plain, short, non-technical",
      finalOutput: `Save as a ${outputKind === "website" ? "website" : "tool"} Library item for review.`,
    },
    safety: {
      approvalRequiredBeforeExternalAction: true,
      requestedExternalAction: externalAction,
      prohibitedExternalActions: PROHIBITED_EXTERNAL_ACTIONS,
    },
    expectedResult: {
      includePlainSummary: true,
      includeReviewNotes: true,
      keepTechnicalDetailsInternal: true,
      includeChangedFilesForInternalHistory: true,
    },
  };
}

function buildCodexPrompt(taskSpec) {
  return [
    "You are the hidden build worker for FounderOS.",
    "",
    "Make the requested project change in this isolated workspace.",
    "Use the task spec below as the source of truth.",
    "Keep final user-facing wording plain and non-technical.",
    "Do not mention Codex, tools, commands, terminals, git branches, commits, models, raw logs, APIs, or provider names.",
    "Do not push, deploy, publish, send messages, spend money, delete important data, change live assets, or contact external people.",
    "If the request asks for one of those actions, prepare the review version only and mark that action as blocked until approval.",
    "",
    "Task spec JSON:",
    JSON.stringify(taskSpec, null, 2),
    "",
    "Return the structured result requested by the output schema.",
  ].join("\n");
}

function buildOpenCodePrompt(taskSpec) {
  return [
    "You are the hidden build worker for FounderOS.",
    "",
    "Make the requested product changes in this isolated workspace.",
    "Use the task spec below as the source of truth.",
    "Prefer a complete, usable review version over a stub.",
    "Keep final user-facing wording plain and non-technical.",
    "Do not mention tools, commands, terminals, git branches, commits, models, providers, raw logs, APIs, or internal file paths.",
    "Do not push, deploy, publish, send messages, spend money, delete important data, change live assets, or contact external people.",
    "If the request asks for one of those actions, prepare the review version only and mark that action as blocked until approval.",
    "",
    "When finished, print only strict JSON with this shape:",
    JSON.stringify({
      summary: "One short plain-language summary of what is ready.",
      reviewNotes: ["Plain-language note for the founder."],
      externalActionRequested: false,
      publishOrDeployBlocked: false,
    }, null, 2),
    "",
    "Task spec JSON:",
    JSON.stringify(taskSpec, null, 2),
  ].join("\n");
}

async function listWorkspaceFiles(rootDir, limit = 240) {
  const root = resolve(rootDir);
  const files = [];

  async function walk(directory) {
    if (files.length >= limit) return;
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= limit) return;
      const absolutePath = join(directory, entry.name);
      const relPath = normalizePath(relative(root, absolutePath));
      if (shouldExcludeRelativePath(relPath, SNAPSHOT_EXCLUDED_NAMES)) continue;

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile()) files.push(relPath);
    }
  }

  await walk(root);
  return files;
}

function contextPriority(filePath) {
  if (filePath === "package.json") return 0;
  if (filePath === "app/page.tsx") return 1;
  if (filePath === "app/layout.tsx") return 2;
  if (filePath === "app/globals.css") return 3;
  if (/^app\/[^/]+\/page\.tsx$/.test(filePath)) return 4;
  if (/^components\//.test(filePath)) return 5;
  if (/\.(ts|tsx|mjs|js|css|json)$/.test(filePath)) return 6;
  return 10;
}

async function collectLlmWorkspaceContext(workspaceDir) {
  const files = await listWorkspaceFiles(workspaceDir);
  const prioritized = [...files]
    .filter((filePath) => /\.(ts|tsx|mjs|js|css|json|md)$/.test(filePath))
    .sort((a, b) => contextPriority(a) - contextPriority(b) || a.localeCompare(b));
  const included = [];
  let remaining = MAX_LLM_CONTEXT_CHARS;

  for (const filePath of prioritized) {
    if (remaining <= 0) break;
    const absolutePath = join(workspaceDir, filePath);
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile() || fileStat.size > MAX_LLM_FILE_CHARS) continue;

    const content = await readFile(absolutePath, "utf8");
    const clipped = content.slice(0, Math.min(content.length, remaining));
    included.push({ path: filePath, content: clipped });
    remaining -= clipped.length;
  }

  return {
    files,
    included,
  };
}

function buildLlmPrompt(taskSpec, workspaceContext) {
  return [
    "You are the hidden build worker for FounderOS.",
    "",
    "Create the requested product or app changes in a Next.js workspace.",
    "Return only strict JSON. Do not use markdown fences.",
    "Use full file contents for every file you create or replace.",
    "Prefer a complete, usable first version over a stub.",
    "Do not publish, deploy, push, send messages, spend money, delete important data, or contact external people.",
    "If asked for a live external action, build the review version and mark that action blocked until approval.",
    "",
    "JSON shape:",
    JSON.stringify({
      summary: "Plain-language summary.",
      reviewNotes: ["Plain-language review note."],
      externalActionRequested: false,
      publishOrDeployBlocked: false,
      files: [
        {
          path: "app/page.tsx",
          content: "Full file content here.",
        },
      ],
      deleteFiles: [],
    }, null, 2),
    "",
    "Task spec JSON:",
    JSON.stringify(taskSpec, null, 2),
    "",
    "Workspace file list:",
    JSON.stringify(workspaceContext.files.slice(0, 240), null, 2),
    "",
    "Selected existing file contents:",
    JSON.stringify(workspaceContext.included, null, 2),
  ].join("\n");
}

function extractLlmJson(text) {
  const trimmed = String(text ?? "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const candidates = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("The configured builder model did not return valid build JSON.");
}

async function callLlmBuildModel(prompt) {
  const apiKey = llmApiKey();
  if (!apiKey) {
    throw new Error("Set BUILDER_LLM_API_KEY, DEEPSEEK_API_KEY, or ZAI_API_KEY before running the LLM builder.");
  }

  const response = await fetch(llmChatCompletionsUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: llmModel(),
      messages: [
        {
          role: "system",
          content: "You are a senior product engineer. Return only valid JSON matching the requested schema.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message ?? `Builder model request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return {
    content: payload?.choices?.[0]?.message?.content ?? "",
    usage: payload?.usage ?? null,
    model: payload?.model ?? llmModel(),
  };
}

async function applyLlmChanges(workspaceDir, result) {
  const changedPaths = [];
  const files = Array.isArray(result.files) ? result.files : [];
  const deleteFiles = Array.isArray(result.deleteFiles) ? result.deleteFiles : [];

  for (const entry of files) {
    const relPath = safeRelativePath(entry?.path);
    if (!relPath || typeof entry?.content !== "string") continue;
    const targetPath = resolve(join(workspaceDir, relPath));
    assertChildPath(workspaceDir, targetPath);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, entry.content, "utf8");
    changedPaths.push(relPath);
  }

  for (const filePath of deleteFiles) {
    const relPath = safeRelativePath(filePath);
    if (!relPath) continue;
    const targetPath = resolve(join(workspaceDir, relPath));
    assertChildPath(workspaceDir, targetPath);
    await rm(targetPath, { force: true });
    changedPaths.push(relPath);
  }

  if (changedPaths.length === 0) {
    throw new Error("The configured builder model did not return any safe file changes.");
  }

  return changedPaths;
}

async function runOpenCodeCommand(prompt, workspaceDir, title, builderAgent = BUILDER_AGENT) {
  const command = builderAgent.command ?? "opencode";
  const result = await execFileCapture(command, buildOpenCodeArgs(builderAgent, prompt, workspaceDir, title), {
    cwd: workspaceDir,
    timeoutMs: builderAgent.timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      CI: process.env.CI ?? "true",
    },
  });

  return result.stdout || result.stderr;
}

function opencodeAgentFromConnection(connection, run, directive) {
  if (!connection || connection.status !== "connected") return null;
  const settings = connection.settings && typeof connection.settings === "object" ? connection.settings : {};
  const route = selectOpenCodeModelForRun({
    settings,
    modelProfile: run.modelProfile,
    run,
    directive,
    env: BUILDER_AGENT_ENV,
  });
  return {
    ...selectBuilderAgent({
      ...BUILDER_AGENT_ENV,
      BUILDER_PROVIDER: "opencode",
      BUILDER_OPENCODE_COMMAND: settings.command || "opencode",
      BUILDER_OPENCODE_MODEL: route.model,
      BUILDER_OPENCODE_AGENT: settings.agent || "",
      BUILDER_OPENCODE_ATTACH_URL: settings.attachUrl || "",
    }),
    orchestration: route,
  };
}

function defaultBuilderAgentForRun(run, directive) {
  if (BUILDER_AGENT.adapter !== "opencode") return BUILDER_AGENT;
  const route = selectOpenCodeModelForRun({
    run,
    directive,
    env: BUILDER_AGENT_ENV,
  });
  return {
    ...selectBuilderAgent({
      ...BUILDER_AGENT_ENV,
      BUILDER_PROVIDER: "opencode",
      BUILDER_OPENCODE_MODEL: route.model,
    }),
    orchestration: route,
  };
}

async function builderAgentForRun(client, run, directive) {
  if (!run.workspaceId) return defaultBuilderAgentForRun(run, directive);
  try {
    const connection = await client.query(api.connectors.getConnectorConnectionForWorker, {
      workspaceId: run.workspaceId,
      connectorId: "opencode",
      workerToken: workerToken(),
    });
    return opencodeAgentFromConnection(connection, run, directive) ?? defaultBuilderAgentForRun(run, directive);
  } catch {
    return defaultBuilderAgentForRun(run, directive);
  }
}

function eventProgress(event) {
  if (!event || typeof event !== "object") return null;

  if (event.type === "item.started" || event.type === "item.completed") {
    const item = event.item;
    if (!item || typeof item !== "object") return null;

    if (item.type === "file_change" && event.type === "item.completed") {
      return "I'm applying the requested changes.";
    }

    if (item.type === "command_execution" && event.type === "item.started") {
      return "I'm checking that the work holds together.";
    }

    if (item.type === "error") {
      return "I found something that needs attention.";
    }
  }

  if (event.type === "turn.completed") {
    return "The first review version is ready.";
  }

  return null;
}

function extractCodexResult(finalResponse) {
  const fallback = {
    summary: toPlainFounderText(finalResponse),
    reviewNotes: [],
    externalActionRequested: false,
    publishOrDeployBlocked: false,
  };

  if (!finalResponse) return fallback;

  const trimmed = finalResponse.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const candidates = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        summary: toPlainFounderText(parsed.summary, fallback.summary),
        reviewNotes: Array.isArray(parsed.reviewNotes)
          ? parsed.reviewNotes.map((note) => toPlainFounderText(note)).filter(Boolean).slice(0, 5)
          : [],
        externalActionRequested: Boolean(parsed.externalActionRequested),
        publishOrDeployBlocked: Boolean(parsed.publishOrDeployBlocked),
      };
    } catch {
      // Keep trying fallback shapes.
    }
  }

  return fallback;
}

function buildFounderSummary(result, previewStatus, testResults) {
  const notes = [];
  if (testResults.status === "failed" || testResults.status === "timed_out") {
    notes.push("One check needs attention before this is used more broadly.");
  }
  if (previewStatus.safeMessage) {
    notes.push(previewStatus.safeMessage);
  }
  if (!previewStatus.available) {
    notes.push("I could not open the preview yet.");
  }
  if (result.publishOrDeployBlocked) {
    notes.push("Nothing was published or changed live.");
  }

  return toPlainFounderText([result.summary, ...notes].filter(Boolean).join(" "));
}

function buildLibraryContent(args) {
  const plan = args.taskSpec?.productPlan;
  const reviewNotes = [
    ...args.codexResult.reviewNotes,
    args.testResults.summary,
    args.previewStatus.safeMessage ??
      (args.previewStatus.available
      ? "The preview is ready to open."
      : "The preview could not be opened yet."),
    "No public publishing or live changes were made.",
  ];

  return [
    `# ${args.title}`,
    "",
    args.summary,
    "",
    ...(plan
      ? [
          "## Plan",
          ...plan.steps.map((step) => `- ${toPlainFounderText(step)}`),
          "",
        ]
      : []),
    "## Preview",
    args.previewStatus.available && args.previewStatus.url
      ? `Preview: ${args.previewStatus.url}`
      : "The review version is saved, but the preview could not be opened yet.",
    "",
    "## Review notes",
    ...reviewNotes.map((note) => `- ${toPlainFounderText(note)}`),
    "",
    "## Version and handoff",
    "FounderOS saved this review version in Library so it can be compared, revised, handed off, or used as a rollback point later.",
  ].join("\n");
}

function buildResultMetadata(args) {
  return {
    mode: args.mode,
    connector: "hidden_build",
    agent: {
      adapter: BUILDER_ADAPTER,
      provider: BUILDER_PROVIDER,
      preferredRealAdapter: "opencode",
    },
    taskSpec: args.taskSpec,
    orchestration: args.taskSpec?.orchestration,
    productPlan: args.taskSpec?.productPlan,
    source: args.source,
    isolation: {
      mode: args.workspace.isolation,
      branch: args.workspace.branch,
      workingDirectory: args.workspace.workingDirectory,
    },
    deployment: deploymentMetadata(args.previewStatus),
    preview: args.previewStatus,
    changedFileCount: args.changedFiles.length,
    changedFiles: args.changedFiles,
    tests: args.testResults,
    repair: args.repair ?? {
      attempted: false,
      attempts: 0,
    },
    codex: args.codex,
    safety: {
      publishRequiresApproval: true,
      requestedExternalAction: args.externalAction,
      externalActionPerformed: false,
    },
  };
}

async function createApprovalIfNeeded(client, run, externalAction, previewStatus) {
  if (!externalAction) return null;

  return await client.mutation(api.approvals.createForRun, {
    directiveId: run.directiveId,
    runId: run._id,
    actionKind: externalAction.actionKind,
    actionTitle: externalAction.actionTitle,
    actionDescription: externalAction.actionDescription,
    actionPayload: {
      requestedBy: "builder",
      externalActionPerformed: false,
      deployment: previewStatus ? deploymentMetadata(previewStatus) : undefined,
    },
    workerToken: workerToken(),
  });
}

function readRunMetadata(run) {
  try {
    return run.internalNotes ? JSON.parse(run.internalNotes) : {};
  } catch {
    return {};
  }
}

function canPublishApprovedDeployment(actionKind) {
  return actionKind === "publish_preview" || actionKind === "change_live_asset";
}

function buildPublishedLibraryContent(args) {
  return [
    `# ${args.title}`,
    "",
    args.summary,
    "",
    "## Published link",
    args.liveUrl ? `Live: ${args.liveUrl}` : "The approved update was published.",
    "",
    "## Approval",
    args.actionTitle ?? "The live update was approved before publishing.",
  ].join("\n");
}

async function publishApprovedDeployment(client, run, approvedAction) {
  if (!canPublishApprovedDeployment(approvedAction.actionKind)) return false;

  const settings = vercelSettingsFromEnv();
  if (!vercelIsConfigured(settings)) return false;

  const metadata = readRunMetadata(run);
  const deployment = metadata.deployment ?? approvedAction.actionPayload?.deployment ?? {};
  const deploymentId = deployment.deploymentId;

  try {
    const result = await publishVercelDeployment({
      deploymentId,
      settings,
      productionDomain: deployment.productionDomain ?? settings.productionDomain,
    });
    const liveUrl = result.liveUrl ?? run.previewUrl;
    const summary = "The approved site update is live.";
    const nextMetadata = {
      ...metadata,
      deployment: {
        ...deployment,
        ...result,
        liveUrl,
        previewUrl: deployment.previewUrl ?? run.previewUrl,
        publishRequiresApproval: false,
      },
      safety: {
        ...(metadata.safety ?? {}),
        requestedExternalAction: approvedAction,
        externalActionPerformed: true,
      },
    };

    await client.mutation(api.approvals.markApprovedActionHandled, {
      approvalId: approvedAction.approvalId,
      workerToken: workerToken(),
    });
    await client.mutation(api.workRuns.completeWithResult, {
      runId: run._id,
      leaseId: run.leaseId,
      summary,
      content: buildPublishedLibraryContent({
        title: run.title,
        summary,
        liveUrl,
        actionTitle: approvedAction.actionTitle,
      }),
      previewUrl: liveUrl,
      internalNotes: JSON.stringify(nextMetadata),
      metadata: nextMetadata,
      workerToken: workerToken(),
    });
    return true;
  } catch (error) {
    const safeError = safeVercelFailureMessage(
      error,
      "The approved publishing step could not finish. No live changes were made.",
    );
    const nextMetadata = {
      ...metadata,
      deployment: {
        ...deployment,
        provider: deployment.provider ?? "vercel",
        target: "production",
        status: "failed",
        safeError,
        previewUrl: deployment.previewUrl ?? run.previewUrl,
        publishRequiresApproval: true,
        createdAt: Date.now(),
      },
      safety: {
        ...(metadata.safety ?? {}),
        requestedExternalAction: approvedAction,
        externalActionPerformed: false,
      },
    };

    await client.mutation(api.approvals.markApprovedActionHandled, {
      approvalId: approvedAction.approvalId,
      workerToken: workerToken(),
    });
    await client.mutation(api.workRuns.markNeedsReviewWithResult, {
      runId: run._id,
      leaseId: run.leaseId,
      summary: safeError,
      content: [
        `# ${run.title}`,
        "",
        safeError,
        "",
        "No live changes were made.",
      ].join("\n"),
      previewUrl: run.previewUrl,
      internalNotes: JSON.stringify(nextMetadata),
      metadata: nextMetadata,
      message: safeError,
      workerToken: workerToken(),
    });
    return true;
  }
}

async function simulateRun(client, run) {
  await sleep(600);
  await append(client, run._id, "I'm planning the product.");

  await sleep(600);
  await append(client, run._id, "I'm preparing the workspace.");

  await sleep(600);
  await append(client, run._id, "I'm making the requested changes.");

  await sleep(600);
  await append(client, run._id, "I'm checking the preview.");

  const previewStatus = await createReviewPreviewStatus(ROOT_WORKSPACE_DIR, run);
  const hasPreview = previewStatus.available;
  const summary = hasPreview
    ? "A first review version is ready. This development setup is using a sample result."
    : "A first review version is ready, but FounderOS could not open a preview yet.";
  const metadata = buildResultMetadata({
    mode: "simulated",
    taskSpec: null,
    source: await sourceMetadata(ROOT_WORKSPACE_DIR),
    workspace: {
      isolation: "workspace",
      branch: null,
      workingDirectory: ROOT_WORKSPACE_DIR,
    },
    previewStatus,
    changedFiles: [],
    testResults: {
      status: "skipped",
      summary: "No checks were run for the sample result.",
      commands: [],
    },
    codex: null,
    externalAction: null,
  });

  await sleep(600);
  await client.mutation(api.workRuns.markNeedsReviewWithResult, {
    runId: run._id,
    leaseId: run.leaseId,
    summary,
    content: buildLibraryContent({
      title: run.title,
      summary,
      codexResult: {
        summary,
        reviewNotes: ["This is a sample result for local development."],
        externalActionRequested: false,
        publishOrDeployBlocked: false,
      },
      previewStatus,
      testResults: metadata.tests,
    }),
    previewUrl: previewStatus.url ?? undefined,
    internalNotes: JSON.stringify(metadata),
    metadata,
    message: hasPreview
      ? "Your preview is ready to review."
      : "The work is ready for review, but I could not open the preview yet.",
    workerToken: workerToken(),
  });
}

async function runCodex(client, run, directive) {
  const apiKey = openAiKey();
  if (!apiKey) {
    await append(client, run._id, "I'm preparing a local review version.");
    await simulateRun(client, run);
    return;
  }

  let workspace = null;
  try {
    workspace = await createBuildWorkspace(run);
    const taskSpec = buildTaskSpec(run, directive, workspace);
    const baselineSnapshot = await snapshotWorkspaceFiles(workspace.workingDirectory);
    const externalAction = taskSpec.safety.requestedExternalAction;
    const codex = new Codex({ apiKey });
    const thread = codex.startThread({
      workingDirectory: workspace.workingDirectory,
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      skipGitRepoCheck: workspace.isolation !== "git_worktree",
      model: process.env.BUILDER_CODEX_MODEL,
      modelReasoningEffort: process.env.BUILDER_CODEX_REASONING_EFFORT ?? "medium",
    });

    await append(client, run._id, "I'm planning the product.");
    await append(client, run._id, "I'm preparing the workspace.");

    const streamed = await thread.runStreamed(buildCodexPrompt(taskSpec), {
      outputSchema: CODEX_RESULT_SCHEMA,
    });
    const progressSeen = new Set();
    const eventChangedFiles = new Set();
    let commandCount = 0;
    let finalResponse = "";
    let usage = null;

    for await (const event of streamed.events) {
      const message = eventProgress(event);
      if (message && !progressSeen.has(message)) {
        progressSeen.add(message);
        await append(client, run._id, message);
      }

      if (
        event.type === "item.completed" &&
        event.item?.type === "file_change" &&
        Array.isArray(event.item.changes)
      ) {
        for (const change of event.item.changes) {
          const safePath = safeRelativePath(change.path);
          if (safePath) eventChangedFiles.add(safePath);
        }
      }

      if (event.type === "item.completed" && event.item?.type === "command_execution") {
        commandCount += 1;
      }

      if (event.type === "item.completed" && event.item?.type === "agent_message") {
        finalResponse = event.item.text.trim();
      }

      if (event.type === "turn.completed") {
        usage = event.usage;
      }

      if (event.type === "turn.failed") {
        throw new Error(event.error.message);
      }
    }

    await append(client, run._id, "I'm checking the review version.");
    const changedFiles = await captureChangedFiles(
      workspace.workingDirectory,
      baselineSnapshot,
      [...eventChangedFiles],
    );
    const testResults = await runTestCommands(workspace.workingDirectory);
    const previewStatus = await createReviewPreviewStatus(workspace.workingDirectory, run, directive);
    const codexResult = extractCodexResult(finalResponse);
    if (externalAction) {
      codexResult.externalActionRequested = true;
      codexResult.publishOrDeployBlocked = true;
    }
    const summary = buildFounderSummary(codexResult, previewStatus, testResults);
    const metadata = buildResultMetadata({
      mode: "codex",
      taskSpec,
      source: await sourceMetadata(workspace.workingDirectory),
      workspace,
      previewStatus,
      changedFiles,
      testResults,
      codex: {
        threadId: thread.id,
        usage,
        commandCount,
      },
      externalAction,
    });

    await client.mutation(api.workRuns.markNeedsReviewWithResult, {
      runId: run._id,
      leaseId: run.leaseId,
      summary,
      content: buildLibraryContent({
        title: run.title,
        summary,
        codexResult,
        previewStatus,
        testResults,
        taskSpec,
      }),
      previewUrl: previewStatus.url ?? undefined,
      internalNotes: JSON.stringify(metadata),
      metadata,
      message: previewStatus.available
        ? "Your preview is ready to review."
        : "The work is ready for review, but I could not open the preview yet.",
      workerToken: workerToken(),
    });

    try {
      await createApprovalIfNeeded(client, run, externalAction, previewStatus);
    } catch (error) {
      console.error(
        `Hidden builder could not queue approval: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (externalAction) {
        await append(
          client,
          run._id,
          "The review version is ready. Approval is still needed before anything goes live.",
          "blocked",
        );
      }
    }
  } finally {
    await workspace?.cleanup();
  }
}

async function runLlmBuilder(client, run, directive) {
  if (!llmApiKey()) {
    await append(client, run._id, "I'm preparing a local review version.");
    await simulateRun(client, run);
    return;
  }

  let workspace = null;
  try {
    workspace = await createBuildWorkspace(run);
    const taskSpec = buildTaskSpec(run, directive, workspace);
    const baselineSnapshot = await snapshotWorkspaceFiles(workspace.workingDirectory);
    const externalAction = taskSpec.safety.requestedExternalAction;

    await append(client, run._id, "I'm planning the product.");
    await append(client, run._id, "I'm preparing the workspace.");
    const workspaceContext = await collectLlmWorkspaceContext(workspace.workingDirectory);

    await append(client, run._id, "I'm making the requested changes.");
    const completion = await callLlmBuildModel(
      buildLlmPrompt(taskSpec, workspaceContext),
    );
    const llmResult = extractLlmJson(completion.content);
    const modelChangedPaths = await applyLlmChanges(workspace.workingDirectory, llmResult);

    await append(client, run._id, "I'm checking the review version.");
    let testResults = await runTestCommands(workspace.workingDirectory);
    let repair = {
      attempted: false,
      attempts: 0,
      finalStatus: testResults.status,
    };
    let repairResult = null;

    for (let attempt = 0; attempt < REPAIR_ATTEMPTS && checksNeedRepair(testResults); attempt += 1) {
      repair = {
        attempted: true,
        attempts: attempt + 1,
        finalStatus: testResults.status,
      };
      await append(client, run._id, "I found a check that needs attention and I'm repairing it.");
      try {
        const repairCompletion = await callLlmBuildModel(buildRepairPrompt(taskSpec, testResults));
        repairResult = extractLlmJson(repairCompletion.content);
        const repairChangedPaths = await applyLlmChanges(workspace.workingDirectory, repairResult);
        modelChangedPaths.push(...repairChangedPaths);
        testResults = await runTestCommands(workspace.workingDirectory);
        repair.finalStatus = testResults.status;
      } catch (error) {
        repair.error = sanitizeInternalLog(error instanceof Error ? error.message : String(error));
        break;
      }
    }

    const changedFiles = await captureChangedFiles(
      workspace.workingDirectory,
      baselineSnapshot,
      modelChangedPaths,
    );
    const previewStatus = await createReviewPreviewStatus(workspace.workingDirectory, run, directive);
    const codexResult = {
      summary: toPlainFounderText(repairResult?.summary ?? llmResult.summary),
      reviewNotes: Array.isArray(llmResult.reviewNotes)
        ? llmResult.reviewNotes.map((note) => toPlainFounderText(note)).filter(Boolean).slice(0, 5)
        : [],
      externalActionRequested: Boolean(llmResult.externalActionRequested || externalAction),
      publishOrDeployBlocked: Boolean(llmResult.publishOrDeployBlocked || externalAction),
    };
    const summary = buildFounderSummary(codexResult, previewStatus, testResults);
    const metadata = buildResultMetadata({
      mode: BUILDER_PROVIDER,
      taskSpec,
      source: await sourceMetadata(workspace.workingDirectory),
      workspace,
      previewStatus,
      changedFiles,
      testResults,
      repair,
      codex: {
        provider: BUILDER_PROVIDER,
        model: completion.model,
        usage: completion.usage,
        returnedFileCount: Array.isArray(llmResult.files) ? llmResult.files.length : 0,
      },
      externalAction,
    });

    await client.mutation(api.workRuns.markNeedsReviewWithResult, {
      runId: run._id,
      leaseId: run.leaseId,
      summary,
      content: buildLibraryContent({
        title: run.title,
        summary,
        codexResult,
        previewStatus,
        testResults,
        taskSpec,
      }),
      previewUrl: previewStatus.url ?? undefined,
      internalNotes: JSON.stringify(metadata),
      metadata,
      message: previewStatus.available
        ? "Your preview is ready to review."
        : "The work is ready for review, but I could not open the preview yet.",
      workerToken: workerToken(),
    });

    try {
      await createApprovalIfNeeded(client, run, externalAction, previewStatus);
    } catch (error) {
      console.error(
        `Hidden builder could not queue approval: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (externalAction) {
        await append(
          client,
          run._id,
          "The review version is ready. Approval is still needed before anything goes live.",
          "blocked",
        );
      }
    }
  } finally {
    await workspace?.cleanup();
  }
}

async function runOpenCodeBuilder(client, run, directive, builderAgent = BUILDER_AGENT) {
  let workspace = null;
  try {
    workspace = await createBuildWorkspace(run);
    const taskSpec = buildTaskSpec(run, directive, workspace, builderAgent);
    const baselineSnapshot = await snapshotWorkspaceFiles(workspace.workingDirectory);
    const externalAction = taskSpec.safety.requestedExternalAction;

    await append(client, run._id, "I'm planning the product.");
    await append(client, run._id, "I'm preparing the workspace.");

    await append(client, run._id, "I'm making the requested changes.");
    const finalResponse = await runOpenCodeCommand(
      buildOpenCodePrompt(taskSpec),
      workspace.workingDirectory,
      run.title,
      builderAgent,
    );
    const opencodeResult = extractCodexResult(finalResponse);

    await append(client, run._id, "I'm checking the review version.");
    let testResults = await runTestCommands(workspace.workingDirectory);
    let repair = {
      attempted: false,
      attempts: 0,
      finalStatus: testResults.status,
    };

    for (let attempt = 0; attempt < REPAIR_ATTEMPTS && checksNeedRepair(testResults); attempt += 1) {
      repair = {
        attempted: true,
        attempts: attempt + 1,
        finalStatus: testResults.status,
      };
      await append(client, run._id, "I found a check that needs attention and I'm repairing it.");
      try {
        await runOpenCodeCommand(
          buildRepairPrompt(taskSpec, testResults),
          workspace.workingDirectory,
          `${run.title} repair`,
          builderAgent,
        );
        testResults = await runTestCommands(workspace.workingDirectory);
        repair.finalStatus = testResults.status;
      } catch (error) {
        repair.error = sanitizeInternalLog(error instanceof Error ? error.message : String(error));
        break;
      }
    }

    const changedFiles = await captureChangedFiles(
      workspace.workingDirectory,
      baselineSnapshot,
      [],
    );
    const previewStatus = await createReviewPreviewStatus(workspace.workingDirectory, run, directive);
    if (externalAction) {
      opencodeResult.externalActionRequested = true;
      opencodeResult.publishOrDeployBlocked = true;
    }
    const summary = buildFounderSummary(opencodeResult, previewStatus, testResults);
    const metadata = buildResultMetadata({
      mode: "opencode",
      taskSpec,
      source: await sourceMetadata(workspace.workingDirectory),
      workspace,
      previewStatus,
      changedFiles,
      testResults,
      repair,
      codex: {
        adapter: "opencode",
        command: builderAgent.command,
        model: builderAgent.model,
        changedFileCount: changedFiles.length,
      },
      externalAction,
    });

    await client.mutation(api.workRuns.markNeedsReviewWithResult, {
      runId: run._id,
      leaseId: run.leaseId,
      summary,
      content: buildLibraryContent({
        title: run.title,
        summary,
        codexResult: opencodeResult,
        previewStatus,
        testResults,
        taskSpec,
      }),
      previewUrl: previewStatus.url ?? undefined,
      internalNotes: JSON.stringify(metadata),
      metadata,
      message: previewStatus.available
        ? "Your preview is ready to review."
        : "The work is ready for review, but I could not open the preview yet.",
      workerToken: workerToken(),
    });

    try {
      await createApprovalIfNeeded(client, run, externalAction, previewStatus);
    } catch (error) {
      console.error(
        `Hidden builder could not queue approval: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (externalAction) {
        await append(
          client,
          run._id,
          "The review version is ready. Approval is still needed before anything goes live.",
          "blocked",
        );
      }
    }
  } finally {
    await workspace?.cleanup();
  }
}

async function processRun(client, run) {
  console.log(`Starting hidden builder run: ${run._id}`);
  const approvedAction = await client.query(api.approvals.getApprovedActionForRun, {
    runId: run._id,
    workerToken: workerToken(),
  });
  if (approvedAction) {
    await append(client, run._id, "I'm resuming the approved step.");
    await sleep(400);
    if (await publishApprovedDeployment(client, run, approvedAction)) {
      console.log(`Hidden builder run completed approved deployment: ${run._id}`);
      return;
    }
    await client.mutation(api.approvals.resumeApprovedActionWithoutConnector, {
      approvalId: approvedAction.approvalId,
      runId: run._id,
      leaseId: run.leaseId,
      workerToken: workerToken(),
    });
    console.log(`Hidden builder run returned approved action to review: ${run._id}`);
    return;
  }

  const directive = await client.query(api.directives.getDirectiveById, {
    directiveId: run.directiveId,
    workerToken: workerToken(),
  });
  if (!directive) throw new Error("Task not found.");

  const builderAgent = await builderAgentForRun(client, run, directive);
  const builderAdapter = builderAgent.adapter;
  const builderProvider = builderAgent.provider;

  if (builderAdapter === "simulated") {
    await simulateRun(client, run);
    console.log(`Hidden builder run ready for review: ${run._id}`);
    return;
  }

  if (builderAdapter === "opencode") {
    await runOpenCodeBuilder(client, run, directive, builderAgent);
  } else if (builderAdapter === "llm") {
    await runLlmBuilder(client, run, directive);
  } else if (builderAdapter === "codex") {
    await runCodex(client, run, directive);
  } else {
    throw new Error(builderProviderHelp(builderProvider));
  }
  console.log(`Hidden builder run ready for review: ${run._id}`);
}

async function tick(client) {
  const run = await client.mutation(api.workRuns.leaseNext, {
    kinds: ["code_preview"],
    workerId: WORKER_ID,
    leaseMs: LEASE_MS,
    workerToken: workerToken(),
  });
  if (!run) return false;

  try {
    await processRun(client, run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hidden builder run failed: ${message}`);
    await client.mutation(api.workRuns.markFailed, {
      runId: run._id,
      leaseId: run.leaseId,
      failureReason: "FounderOS could not prepare the preview yet.",
      internalError: message,
      workerToken: workerToken(),
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
  buildCodexPrompt,
  buildOpenCodePrompt,
  buildLlmPrompt,
  buildLibraryContent,
  buildResultMetadata,
  buildTaskSpec,
  captureChangedFiles,
  createBuildWorkspace,
  createReviewPreviewStatus,
  detectSensitiveExternalAction,
  diffWorkspaceSnapshots,
  ensurePreviewStatus,
  extractCodexResult,
  extractLlmJson,
  outputKindForRun,
  planProductBuild,
  runTestCommands,
  snapshotWorkspaceFiles,
  toPlainFounderText,
};
