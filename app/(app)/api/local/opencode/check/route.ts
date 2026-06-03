import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_OUTPUT_LENGTH = 180;
const DEFAULT_OPENCODE_READINESS_MODEL = "zai-coding-plan/glm-4.7";
const FREE_OPENCODE_MODELS = new Set([
  "opencode/deepseek-v4-flash-free",
  "opencode/nemotron-3-super-free",
  "opencode/minimax-m3-free",
  "opencode/mimo-v2.5-free",
  "opencode/big-pickle",
]);
let activeCheck: Promise<{ version?: string }> | null = null;

function safeText(value: unknown) {
  return String(value ?? "")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(sk|pk|rk|ghp|github_pat|ya29)[-_A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_OUTPUT_LENGTH);
}

function commandParts(commandValue: unknown) {
  const raw = typeof commandValue === "string" && commandValue.trim()
    ? commandValue.trim()
    : "opencode";

  if (/[&|<>`$;\r\n]/.test(raw)) {
    throw new Error("Use a plain local opencode command.");
  }

  const parts = raw.match(/"[^"]+"|\S+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];
  const executableName = (parts[0] || "opencode").split(/[\\/]/).pop()?.toLowerCase();
  const allowedExecutables = new Set(["opencode", "opencode.exe", "opencode.cmd", "opencode.ps1"]);
  if (!executableName || !allowedExecutables.has(executableName)) {
    throw new Error("Use the supported local opencode command.");
  }

  return {
    command: parts[0] || "opencode",
    baseArgs: parts.slice(1),
  };
}

function safeModel(value: unknown) {
  const raw = typeof value === "string" && value.trim()
    ? value.trim()
    : process.env.FOUNDEROS_OPENCODE_BUSINESS_MODEL?.trim() || DEFAULT_OPENCODE_READINESS_MODEL;
  if (/[\r\n]/.test(raw) || FREE_OPENCODE_MODELS.has(raw) || /\bdeepseek\b/i.test(raw)) {
    return DEFAULT_OPENCODE_READINESS_MODEL;
  }
  return raw.slice(0, 200);
}

function killProcessTree(pid?: number) {
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

function execFileWithTreeTimeout(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout: number;
    maxBuffer: number;
    env?: NodeJS.ProcessEnv;
  },
) {
  return new Promise<{ ok: boolean; stdout: string; stderr: string; message: string }>((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const child = execFile(
      command,
      args,
      {
        cwd: options.cwd,
        windowsHide: true,
        maxBuffer: options.maxBuffer,
        shell: process.platform === "win32",
        env: options.env ?? process.env,
      },
      (error, stdout, stderr) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          ok: !error,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          message: safeText(stdout) || safeText(stderr) || safeText(error?.message),
        });
      },
    );
    if (!settled) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        killProcessTree(child.pid);
        resolve({
          ok: false,
          stdout: "",
          stderr: "",
          message: "opencode took too long to respond on this computer.",
        });
      }, options.timeout);
    }
  });
}

async function checkOpenCodeVersion(command: string, baseArgs: string[]) {
  const result = await execFileWithTreeTimeout(command, [...baseArgs, "--version"], {
    timeout: 8000,
    maxBuffer: 256 * 1024,
  });
  if (!result.ok) {
    throw new Error(result.message || "opencode did not respond on this computer.");
  }
  return { version: result.message };
}

async function checkOpenCodeReadiness(command: string, baseArgs: string[], model: string) {
  const workspaceDir = await mkdtemp(join(tmpdir(), "founderos-opencode-check-"));
  const prompt = [
    "FounderOS setup check.",
    "Reply with READY only.",
    "Do not inspect, create, edit, delete, install, publish, or run any other command.",
  ].join(" ");

  try {
    const result = await execFileWithTreeTimeout(
      command,
      [
        ...baseArgs,
        "run",
        "--dir",
        workspaceDir,
        "--title",
        "FounderOS setup check",
        "--model",
        model,
        prompt,
      ],
      {
        cwd: workspaceDir,
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          CI: process.env.CI ?? "true",
        },
      },
    );
    const fullOutput = `${result.stdout}\n${result.stderr}`;
    if (!result.ok || !/\bREADY\b/i.test(fullOutput)) {
      throw new Error(result.message || "opencode could not complete a setup check.");
    }
  } finally {
    await rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runOpenCodeCheck(commandValue: unknown) {
  const { command, baseArgs } = commandParts(commandValue);
  const result = await checkOpenCodeVersion(command, baseArgs);
  await checkOpenCodeReadiness(command, baseArgs, safeModel(undefined));
  return result;
}

async function checkOpenCode(commandValue: unknown) {
  if (activeCheck) return await activeCheck;
  activeCheck = runOpenCodeCheck(commandValue);
  try {
    return await activeCheck;
  } finally {
    activeCheck = null;
  }
}

export async function POST(request: NextRequest) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) {
    return NextResponse.json({ ok: false, safeMessage: "Sign in to continue." }, { status: 401 });
  }

  let body: { command?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const result = await checkOpenCode(body.command);
    return NextResponse.json({
      ok: true,
      healthy: true,
      safeMessage: result.version
        ? "opencode is ready on this computer."
        : "opencode is ready on this computer.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        healthy: false,
        safeMessage: safeText(error instanceof Error ? error.message : error) || "opencode is not responding on this computer.",
      },
      { status: 200 },
    );
  }
}
