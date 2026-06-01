import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/auth-server";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength = 8000) {
  return String(value ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(sk|pk|rk|ghp|github_pat|ya29)[-_A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\bOpenCode\b|\bCodex\b/gi, "FounderOS")
    .replace(/\bCLI\b|\bterminal\b|\bcommand line\b/gi, "workspace")
    .replace(/\s+\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function commandParts(commandValue: unknown) {
  const raw = typeof commandValue === "string" && commandValue.trim()
    ? commandValue.trim()
    : "opencode";

  if (/[&|<>`$;\r\n]/.test(raw)) {
    throw new Error("Use a plain OpenCode command, such as opencode.");
  }

  const parts = raw.match(/"[^"]+"|\S+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];
  const executableName = (parts[0] || "opencode").split(/[\\/]/).pop()?.toLowerCase();
  const allowedExecutables = new Set(["opencode", "opencode.exe", "opencode.cmd", "opencode.ps1"]);
  if (!executableName || !allowedExecutables.has(executableName)) {
    throw new Error("Use the OpenCode command for this local connector.");
  }

  return {
    command: parts[0] || "opencode",
    baseArgs: parts.slice(1),
  };
}

function modelArg(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (/[\r\n]/.test(value)) throw new Error("Use a plain OpenCode model name.");
  return value.trim();
}

function optionArg(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  if (/[\r\n]/.test(value)) throw new Error(`Use a plain OpenCode ${label}.`);
  return value.trim().slice(0, 200);
}

function attachArg(value: unknown) {
  const attachUrl = optionArg(value, "attach URL");
  if (!attachUrl) return undefined;
  const url = new URL(attachUrl);
  const hostname = url.hostname.toLowerCase();
  const isLocalHttp =
    url.protocol === "http:" &&
    (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("Use a local OpenCode attach URL.");
  }
  return url.toString();
}

async function runOpenCodeChat(args: {
  command?: unknown;
  model?: unknown;
  agent?: unknown;
  attachUrl?: unknown;
  systemPrompt?: unknown;
  userPrompt?: unknown;
}) {
  const { command, baseArgs } = commandParts(args.command);
  const systemPrompt = cleanText(args.systemPrompt, 12000);
  const userPrompt = cleanText(args.userPrompt, 4000);
  if (!systemPrompt || !userPrompt) {
    throw new Error("OpenCode chat needs a current FounderOS prompt.");
  }

  const prompt = [
    systemPrompt,
    "",
    "Answer in FounderOS chat mode. Stay read-only. Do not edit files, run tasks, publish, send messages, schedule events, or describe yourself as a coding agent.",
    "",
    "Founder message:",
    userPrompt,
  ].join("\n");
  const selectedModel = modelArg(args.model);
  const selectedAgent = optionArg(args.agent, "agent");
  const selectedAttachUrl = attachArg(args.attachUrl);
  const workspaceDir = await mkdtemp(join(tmpdir(), "founderos-opencode-chat-"));
  const commandArgs = [
    ...baseArgs,
    "run",
    "--dir",
    workspaceDir,
    "--title",
    "FounderOS chat",
    ...(selectedModel ? ["--model", selectedModel] : []),
    ...(selectedAgent ? ["--agent", selectedAgent] : []),
    ...(selectedAttachUrl ? ["--attach", selectedAttachUrl] : []),
    prompt,
  ];

  return new Promise<{ content: string }>((resolve, reject) => {
    execFile(
      command,
      commandArgs,
      {
        cwd: workspaceDir,
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 2 * 1024 * 1024,
        shell: process.platform === "win32",
        env: {
          ...process.env,
          CI: process.env.CI ?? "true",
        },
      },
      async (error, stdout, stderr) => {
        await rm(workspaceDir, { recursive: true, force: true }).catch(() => {});
        const content = cleanText(stdout) || cleanText(stderr);
        if (error) {
          reject(new Error(content || "OpenCode did not return a chat response."));
          return;
        }
        resolve({ content });
      },
    );
  });
}

export async function POST(request: NextRequest) {
  if (!(await serverAuth.isAuthenticated())) {
    return NextResponse.json({ ok: false, safeMessage: "Sign in to continue." }, { status: 401 });
  }

  let body: {
    command?: unknown;
    model?: unknown;
    agent?: unknown;
    attachUrl?: unknown;
    systemPrompt?: unknown;
    userPrompt?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const result = await runOpenCodeChat(body);
    return NextResponse.json({
      ok: true,
      content: result.content || "I could not prepare a useful response yet.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        safeMessage: cleanText(error instanceof Error ? error.message : error, 240) || "OpenCode is not responding locally.",
      },
      { status: 200 },
    );
  }
}
