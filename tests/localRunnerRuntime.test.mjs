import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadLocalRunnerRuntimeModule() {
  const sourcePath = resolve(process.cwd(), "convex", "localRunnerRuntime.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-local-runner-runtime-"));
  const outputPath = join(outputDir, "localRunnerRuntime.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const runtime = await loadLocalRunnerRuntimeModule();

test("local runner heartbeat expiry is explicit and conservative", () => {
  const patch = runtime.localRunnerHeartbeatPatch({
    now: 1000,
    heartbeatTtlMs: 3000,
  });

  assert.equal(patch.status, "online");
  assert.equal(patch.lastHeartbeatAt, 1000);
  assert.equal(patch.heartbeatExpiresAt, 6000);
  assert.equal(runtime.localRunnerIsAlive(patch, 5999), true);
  assert.equal(runtime.localRunnerIsAlive(patch, 6000), false);
  assert.equal(runtime.localRunnerIsAlive({ ...patch, status: "offline" }, 2000), false);
});

test("local runner offline patch clears current work without exposing internals", () => {
  const patch = runtime.localRunnerOfflinePatch(5000, "Stopped.");

  assert.equal(patch.status, "offline");
  assert.equal(patch.currentRunId, undefined);
  assert.equal(patch.lastSafeMessage, "Stopped.");
  assert.equal(patch.stoppedAt, 5000);
});

test("local runner startup normalizers keep supported capabilities only", () => {
  assert.deepEqual(runtime.normalizeRunnerCapabilities(["coding", "bad", "document"]), ["coding", "document"]);
  assert.equal(runtime.normalizeRunnerCapabilities([]).includes("debugging"), true);
  assert.equal(runtime.normalizeRunnerCapabilities([]).includes("planning"), true);
  assert.deepEqual(runtime.normalizeRunnerOutputContracts(["library_item", "bad"]), ["library_item"]);
  assert.equal(runtime.normalizeRunnerSensitivity("confidential"), "confidential");
  assert.equal(runtime.normalizeRunnerSensitivity("bad"), "restricted");
  assert.deepEqual(runtime.normalizeApprovalCapabilities(["send_email", "bad"]), ["send_email"]);
});
