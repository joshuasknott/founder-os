import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_SAFE_TEXT = 220;
const DEFAULT_OPENCODE_CHAT_MODEL = "zai-coding-plan/glm-4.7";
const DEFAULT_OPENCODE_READINESS_TIMEOUT_MS = 120000;
const FREE_OPENCODE_MODELS = new Set([
  "opencode/deepseek-v4-flash-free",
  "opencode/nemotron-3-super-free",
  "opencode/minimax-m3-free",
  "opencode/mimo-v2.5-free",
  "opencode/big-pickle",
]);
let activeOpenCodeCheck = null;

export function safeText(value, maxLength = MAX_SAFE_TEXT) {
  return String(value ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(sk|pk|rk|ghp|github_pat|ya29)[-_A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\bOpenCode\b|\bCodex\b/gi, "FounderOS")
    .replace(/\bCLI\b|\bterminal\b|\bcommand line\b/gi, "workspace")
    .replace(/\bmodel(s)?\b|\bprovider(s)?\b|\broute(s)?\b/gi, "setting$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function opencodeCommandParts(commandValue) {
  const raw = typeof commandValue === "string" && commandValue.trim()
    ? commandValue.trim()
    : "opencode";

  if (/[&|<>`$;\r\n]/.test(raw)) {
    throw new Error("Use a plain local FounderOS command.");
  }

  const parts = raw.match(/"[^"]+"|\S+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];
  const executableName = (parts[0] || "opencode").split(/[\\/]/).pop()?.toLowerCase();
  const allowedExecutables = new Set(["opencode", "opencode.exe", "opencode.cmd", "opencode.ps1"]);
  if (!executableName || !allowedExecutables.has(executableName)) {
    throw new Error("Use the supported local FounderOS command.");
  }

  return {
    command: parts[0] || "opencode",
    baseArgs: parts.slice(1),
  };
}

function killProcessTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => {});
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // The process may already have exited.
  }
}

function powerShellQuote(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function windowsPowerShellLaunch(command, args) {
  const script = `& ${[command, ...args].map(powerShellQuote).join(" ")}; exit $LASTEXITCODE`;
  return {
    command: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
  };
}

function execFileResult(command, args, options = {}) {
  return new Promise((resolve) => {
    const execFileImpl = options.execFileImpl ?? execFile;
    const launch = !options.execFileImpl && process.platform === "win32"
      ? windowsPowerShellLaunch(command, args)
      : { command, args };
    let settled = false;
    let timer;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const maybeResolveOnOutput = () => {
      if (!options.resolveOnOutput || settled) return;
      const output = `${stdoutBuffer}\n${stderrBuffer}`;
      if (!options.resolveOnOutput.test(output)) return;
      killProcessTree(child?.pid);
      settle({
        ok: true,
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
        message: safeText(stdoutBuffer) || safeText(stderrBuffer),
      });
    };
    const child = execFileImpl(
      launch.command,
      launch.args,
      {
        windowsHide: true,
        maxBuffer: options.maxBuffer ?? 1024 * 1024,
        shell: false,
        cwd: options.cwd,
        env: options.env ?? process.env,
      },
      (error, stdout, stderr) => {
        if (settled) return;
        settle({
          ok: !error,
          stdout: stdout || stdoutBuffer,
          stderr: stderr || stderrBuffer,
          message: safeText(stdout) || safeText(stderr) || safeText(error?.message),
        });
      },
    );
    child?.stdout?.on?.("data", (chunk) => {
      stdoutBuffer += String(chunk ?? "");
      maybeResolveOnOutput();
    });
    child?.stderr?.on?.("data", (chunk) => {
      stderrBuffer += String(chunk ?? "");
      maybeResolveOnOutput();
    });
    if (!settled) {
      timer = setTimeout(() => {
        if (settled) return;
        killProcessTree(child?.pid);
        settle({
          ok: false,
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          message: "FounderOS took too long to respond on this computer.",
        });
      }, options.timeoutMs ?? 8000);
    }
  });
}

function spawnUntilOutput(command, args, options = {}) {
  return new Promise((resolve) => {
    const launch = process.platform === "win32"
      ? windowsPowerShellLaunch(command, args)
      : { command, args };
    let settled = false;
    let timer;
    let finalTimer;
    let stdout = "";
    let stderr = "";
    const child = spawn(launch.command, launch.args, {
      windowsHide: true,
      shell: false,
      cwd: options.cwd,
      env: options.env ?? process.env,
    });

    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(finalTimer);
      resolve(result);
    };
    const maybeResolve = () => {
      const output = `${stdout}\n${stderr}`;
      if (!options.resolveOnOutput?.test(output)) return;
      killProcessTree(child.pid);
      settle({
        ok: true,
        stdout,
        stderr,
        message: safeText(stdout) || safeText(stderr),
      });
    };

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk ?? "");
      maybeResolve();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk ?? "");
      maybeResolve();
    });
    child.on("error", (error) => {
      settle({
        ok: false,
        stdout,
        stderr,
        message: safeText(error?.message),
      });
    });
    child.on("close", (code, signal) => {
      if (options.resolveOnOutput?.test(`${stdout}\n${stderr}`)) {
        settle({
          ok: true,
          stdout,
          stderr,
          message: safeText(stdout) || safeText(stderr),
        });
        return;
      }
      settle({
        ok: code === 0,
        stdout,
        stderr,
        message: safeText(stdout) || safeText(stderr) || safeText(signal) || safeText(code),
      });
    });
    timer = setTimeout(() => {
      if (options.acceptOutputAfterKill) {
        child.kill();
        finalTimer = setTimeout(() => {
          killProcessTree(child.pid);
          settle({
            ok: false,
            stdout,
            stderr,
            message: "FounderOS took too long to respond on this computer.",
          });
        }, 8000);
        return;
      }
      settle({
        ok: false,
        stdout,
        stderr,
        message: "FounderOS took too long to respond on this computer.",
      });
    }, options.timeoutMs ?? 8000);
  });
}

function optionArg(value, label) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (/[\r\n]/.test(value)) throw new Error(`Use a plain ${label}.`);
  return value.trim().slice(0, 200);
}

function attachArg(value) {
  const attachUrl = optionArg(value, "attach URL");
  if (!attachUrl) return undefined;
  const url = new URL(attachUrl);
  const hostname = url.hostname.toLowerCase();
  const isLocalHttp =
    url.protocol === "http:" &&
    (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("Use a local FounderOS attach URL.");
  }
  return url.toString();
}

function cleanPromptText(value, maxLength) {
  return String(value ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(sk|pk|rk|ghp|github_pat|ya29)[-_A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\s+\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function cleanDocumentText(value, maxLength) {
  return String(value ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted credential]")
    .replace(/\b(sk|pk|rk|ghp|github_pat|ya29)[-_A-Za-z0-9]{8,}\b/gi, "[redacted credential]")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function readinessTimeoutMs(value = process.env.FOUNDEROS_OPENCODE_READINESS_TIMEOUT_MS) {
  const timeoutMs = Number(value);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 10000) {
    return DEFAULT_OPENCODE_READINESS_TIMEOUT_MS;
  }
  return timeoutMs;
}

export function safeFounderReply(value, maxLength = 8000) {
  return cleanPromptText(value, maxLength)
    .replace(/\bOpenCode\b|\bCodex\b|\bDeepSeek\b|\bOpenRouter\b|\bZ\.ai\b|\bZAI\b/gi, "FounderOS")
    .replace(/\bmodel(s)?\b|\bprovider(s)?\b|\broute(s)?\b/gi, "setting$1")
    .replace(/\btool calls?\b|\bterminal\b|\bcommand line\b|\bstdout\b|\bstderr\b/gi, "workspace")
    .trim();
}

export function isFreeOpenCodeModel(model) {
  return FREE_OPENCODE_MODELS.has(String(model ?? "").trim());
}

function isDeepSeekRoutineModel(model) {
  return /\bdeepseek\b/i.test(String(model ?? ""));
}

export function selectOpenCodeChatModel({
  requestedModel,
  routeModel,
  sensitivity = "internal",
  allowFreeRoute = false,
  verifierRequired = false,
  env = process.env,
} = {}) {
  const configured = optionArg(requestedModel, "chat setting") ||
    optionArg(env.FOUNDEROS_OPENCODE_BUSINESS_MODEL, "chat setting") ||
    optionArg(routeModel, "chat setting") ||
    DEFAULT_OPENCODE_CHAT_MODEL;
  const routeDefault = optionArg(routeModel, "chat setting") || DEFAULT_OPENCODE_CHAT_MODEL;
  const lowEnough = sensitivity === "public" || sensitivity === "low";
  const freeAllowed = allowFreeRoute === true && verifierRequired === true && lowEnough;

  if (isFreeOpenCodeModel(configured) && !freeAllowed) {
    return {
      model: routeDefault,
      requestedModel: configured,
      freeRouteBlocked: true,
      deepSeekBlocked: false,
    };
  }

  if (isDeepSeekRoutineModel(configured) && !freeAllowed) {
    return {
      model: routeDefault,
      requestedModel: configured,
      freeRouteBlocked: isFreeOpenCodeModel(configured),
      deepSeekBlocked: true,
    };
  }

  return {
    model: configured,
    requestedModel: configured,
    freeRouteBlocked: false,
    deepSeekBlocked: false,
  };
}

export function buildOpenCodeChatPrompt({ systemPrompt, userPrompt, requiresWork = false }) {
  const system = cleanPromptText(systemPrompt, 12000);
  const user = cleanPromptText(userPrompt, 4000);
  if (!system || !user) {
    throw new Error("FounderOS needs a current prompt.");
  }

  return [
    system,
    "",
    "Answer in FounderOS chat mode. Stay read-only. Do not edit files, run tasks, publish, send messages, schedule events, or mention hidden systems.",
    requiresWork
      ? "This request has already been added to Work. Acknowledge that plainly and help the founder understand the next useful step without claiming the work is finished."
      : "Give a concise, practical response for the founder.",
    "",
    "Founder message:",
    user,
  ].join("\n");
}

export async function runOpenCodeChat({
  commandValue,
  model,
  agent,
  attachUrl,
  systemPrompt,
  userPrompt,
  requiresWork,
  timeoutMs = 120000,
  execFileImpl,
} = {}) {
  const { command, baseArgs } = opencodeCommandParts(commandValue);
  const selectedModel = optionArg(model, "chat setting") || DEFAULT_OPENCODE_CHAT_MODEL;
  const selectedAgent = optionArg(agent, "agent");
  const selectedAttachUrl = attachArg(attachUrl);
  const workspaceDir = await mkdtemp(join(tmpdir(), "founderos-opencode-chat-"));
  const prompt = buildOpenCodeChatPrompt({ systemPrompt, userPrompt, requiresWork });
  const commandArgs = [
    ...baseArgs,
    "run",
    "--dir",
    workspaceDir,
    "--title",
    "FounderOS chat",
    "--model",
    selectedModel,
    ...(selectedAgent ? ["--agent", selectedAgent] : []),
    ...(selectedAttachUrl ? ["--attach", selectedAttachUrl] : []),
    prompt,
  ];

  try {
    const result = await execFileResult(command, commandArgs, {
      cwd: workspaceDir,
      timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
      execFileImpl,
      env: {
        ...process.env,
        CI: process.env.CI ?? "true",
      },
    });
    const content = safeFounderReply(result.stdout) || safeFounderReply(result.stderr);
    if (!result.ok || !content) {
      throw new Error(content || "FounderOS did not return a chat response.");
    }

    return {
      content,
      model: selectedModel,
    };
  } finally {
    await rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function runOpenCodeDocument({
  commandValue,
  model,
  agent,
  attachUrl,
  prompt,
  title = "FounderOS document",
  timeoutMs = 180000,
  execFileImpl,
} = {}) {
  const { command, baseArgs } = opencodeCommandParts(commandValue);
  const selectedModel = optionArg(model, "document setting") || DEFAULT_OPENCODE_CHAT_MODEL;
  const selectedAgent = optionArg(agent, "agent");
  const selectedAttachUrl = attachArg(attachUrl);
  const workspaceDir = await mkdtemp(join(tmpdir(), "founderos-opencode-document-"));
  const cleanPrompt = cleanPromptText(prompt, 28000);
  if (!cleanPrompt) throw new Error("FounderOS needs a document request.");

  const commandArgs = [
    ...baseArgs,
    "run",
    "--dir",
    workspaceDir,
    "--title",
    optionArg(title, "document title") || "FounderOS document",
    "--model",
    selectedModel,
    ...(selectedAgent ? ["--agent", selectedAgent] : []),
    ...(selectedAttachUrl ? ["--attach", selectedAttachUrl] : []),
    cleanPrompt,
  ];

  try {
    const result = await execFileResult(command, commandArgs, {
      cwd: workspaceDir,
      timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      execFileImpl,
      env: {
        ...process.env,
        CI: process.env.CI ?? "true",
      },
    });
    const content = cleanDocumentText(result.stdout, 50000) || cleanDocumentText(result.stderr, 50000);
    if (!result.ok || !content) {
      throw new Error(safeText(content) || "FounderOS did not return a document.");
    }

    return {
      content: content.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "").trim(),
      model: selectedModel,
    };
  } finally {
    await rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runOpenCodeCheck(commandValue, { timeoutMs } = {}) {
  const { command, baseArgs } = opencodeCommandParts(commandValue);
  const version = await execFileResult(command, [...baseArgs, "--version"], {
    timeoutMs: 8000,
    maxBuffer: 256 * 1024,
  });
  if (!version.ok) {
    throw new Error(version.message || "FounderOS could not find the local OpenCode app.");
  }

  const workspaceDir = await mkdtemp(join(tmpdir(), "founderos-opencode-check-"));
  const prompt = [
    "FounderOS setup check.",
    "Reply with READY only.",
    "Do not inspect, create, edit, delete, install, publish, or run any other command.",
  ].join(" ");

  try {
    const readiness = await spawnUntilOutput(
      command,
      [
        ...baseArgs,
        "run",
        "--dir",
        workspaceDir,
        "--title",
        "FounderOS setup check",
        "--model",
        selectOpenCodeChatModel({
          requestedModel: process.env.FOUNDEROS_OPENCODE_BUSINESS_MODEL,
          routeModel: DEFAULT_OPENCODE_CHAT_MODEL,
          sensitivity: "internal",
        }).model,
        prompt,
      ],
      {
        cwd: workspaceDir,
        timeoutMs: readinessTimeoutMs(timeoutMs),
        maxBuffer: 1024 * 1024,
        resolveOnOutput: /\bREADY\b/i,
        acceptOutputAfterKill: true,
        env: {
          ...process.env,
          CI: process.env.CI ?? "true",
        },
      },
    );
    const fullOutput = `${readiness.stdout}\n${readiness.stderr}`;
    if (!readiness.ok || !/\bREADY\b/i.test(fullOutput)) {
      throw new Error(readiness.message || "FounderOS could not validate local OpenCode auth.");
    }

    return {
      ok: true,
      version: safeText(version.stdout) || safeText(version.stderr),
      safeMessage: "Local OpenCode is ready.",
    };
  } finally {
    await rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function checkOpenCode(commandValue, options = {}) {
  if (activeOpenCodeCheck) return await activeOpenCodeCheck;
  activeOpenCodeCheck = runOpenCodeCheck(commandValue, options);
  try {
    return await activeOpenCodeCheck;
  } finally {
    activeOpenCodeCheck = null;
  }
}
