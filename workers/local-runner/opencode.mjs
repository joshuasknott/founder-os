import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_SAFE_TEXT = 220;

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

function execFileResult(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        windowsHide: true,
        timeout: options.timeoutMs ?? 8000,
        maxBuffer: options.maxBuffer ?? 1024 * 1024,
        shell: process.platform === "win32",
        cwd: options.cwd,
        env: options.env ?? process.env,
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          message: safeText(stdout) || safeText(stderr) || safeText(error?.message),
        });
      },
    );
  });
}

export async function checkOpenCode(commandValue) {
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
    const readiness = await execFileResult(
      command,
      [
        ...baseArgs,
        "run",
        "--dir",
        workspaceDir,
        "--title",
        "FounderOS setup check",
        prompt,
      ],
      {
        cwd: workspaceDir,
        timeoutMs: 60000,
        maxBuffer: 1024 * 1024,
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
