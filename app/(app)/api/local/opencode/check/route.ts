import { execFile } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_OUTPUT_LENGTH = 180;

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
    throw new Error("Use a plain OpenCode command, such as opencode.");
  }

  const parts = raw.match(/"[^"]+"|\S+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];
  return {
    command: parts[0] || "opencode",
    args: [...parts.slice(1), "--version"],
  };
}

function checkOpenCode(commandValue: unknown) {
  const { command, args } = commandParts(commandValue);
  return new Promise<{ version?: string }>((resolve, reject) => {
    execFile(
      command,
      args,
      {
        windowsHide: true,
        timeout: 8000,
        maxBuffer: 256 * 1024,
        shell: process.platform === "win32",
      },
      (error, stdout, stderr) => {
        const output = safeText(stdout) || safeText(stderr);
        if (error) {
          reject(new Error(output || "OpenCode did not respond."));
          return;
        }
        resolve({ version: output });
      },
    );
  });
}

export async function POST(request: NextRequest) {
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
        ? `OpenCode responded: ${result.version}`
        : "OpenCode is installed and responding.",
      version: result.version,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        healthy: false,
        safeMessage: safeText(error instanceof Error ? error.message : error) || "OpenCode is not responding locally.",
      },
      { status: 200 },
    );
  }
}
