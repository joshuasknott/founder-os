#!/usr/bin/env node

import { spawn } from "node:child_process";
import { EOL } from "node:os";

const includeBuilder = !process.argv.includes("--no-builder");

const commands = [
  {
    name: "convex",
    command: "npx",
    args: ["convex", "dev"],
  },
  {
    name: "web",
    command: "npm",
    args: ["run", "dev"],
  },
  {
    name: "runner",
    command: "npm",
    args: ["run", "local-runner"],
  },
  ...(includeBuilder
    ? [
        {
          name: "builder",
          command: "npm",
          args: ["run", "builder"],
        },
      ]
    : []),
];

const colors = {
  convex: "\x1b[35m",
  web: "\x1b[36m",
  runner: "\x1b[32m",
  builder: "\x1b[33m",
  reset: "\x1b[0m",
};

const children = new Map();
let stopping = false;

function prefixStream(name, stream, target) {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line) continue;
      target.write(`${colors[name] ?? ""}[${name}]${colors.reset} ${line}${EOL}`);
    }
  });

  stream.on("end", () => {
    if (buffer) {
      target.write(`${colors[name] ?? ""}[${name}]${colors.reset} ${buffer}${EOL}`);
    }
  });
}

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: false,
    });
    return;
  }

  child.kill("SIGTERM");
}

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;

  for (const child of children.values()) {
    stopChild(child);
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 500);
}

console.log(
  `Starting FounderOS: Convex, web app, local runner${includeBuilder ? ", and builder" : ""}.`,
);
console.log("Open http://localhost:3000 once the web app is ready.");
console.log("Press Ctrl+C to stop everything.");

for (const entry of commands) {
  const child = spawn(entry.command, entry.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === "win32",
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.set(entry.name, child);
  prefixStream(entry.name, child.stdout, process.stdout);
  prefixStream(entry.name, child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    children.delete(entry.name);
    if (stopping) return;

    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
    console.error(`${entry.name} stopped unexpectedly with ${reason}. Stopping the rest.`);
    stopAll(code ?? 1);
  });

  child.on("error", (error) => {
    if (stopping) return;
    console.error(`${entry.name} failed to start: ${error.message}`);
    stopAll(1);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
