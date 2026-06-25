import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadReadinessRuntime() {
  const sourcePath = resolve(process.cwd(), "convex", "readinessRuntime.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-readiness-"));
  const outputPath = join(outputDir, "readinessRuntime.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const readiness = await loadReadinessRuntime();
const now = 1_000_000;
const googleIds = ["gmail", "google_calendar", "google_drive", "google_docs", "google_sheets"];

function healthyConnection(connectorId, extra = {}) {
  return {
    connectorId,
    status: "connected",
    credentialRef: `vault:${connectorId}`,
    grantedScopes: ["required.scope"],
    requiredScopes: ["required.scope"],
    lastHealthyAt: now - 10,
    ...extra,
  };
}

function readyInput() {
  return {
    workspace: { name: "Acme", reviewExternalActions: true },
    founder: { name: "Ada" },
    connections: [
      ...googleIds.map((connectorId) => healthyConnection(connectorId)),
      healthyConnection("github", {
        settings: {
          installationId: "123",
          repositoryOwner: "acme",
          repositoryName: "founder-os",
        },
      }),
      { connectorId: "vercel", status: "not_connected", grantedScopes: [], requiredScopes: [] },
    ],
    syncStates: [...googleIds, "github"].map((connectorId) => ({
      connectorId,
      entityType: "connection",
      status: "idle",
      lastSuccessfulSyncAt: now - 10,
    })),
    setupSessions: [
      { providerId: "google_workspace", connectorIds: googleIds, status: "completed", completedAt: now - 10 },
      { providerId: "github_app", connectorIds: ["github"], status: "completed", completedAt: now - 10 },
    ],
    runners: [{
      status: "online",
      heartbeatExpiresAt: now + 30_000,
      opencodeReady: true,
      capabilities: ["business_reasoning", "product_marketing_docs", "planning", "document", "coding"],
      outputContracts: ["library_item", "public_draft"],
    }],
    now,
  };
}

test("a fully configured workspace is ready and keeps optional services separate", () => {
  const result = readiness.evaluateWorkspaceReadiness(readyInput());

  assert.equal(result.ready, true);
  assert.equal(result.blockingReason, null);
  assert.deepEqual(result.gates.map((gate) => gate.status), ["ready", "ready", "ready", "ready", "ready"]);
  assert.deepEqual(result.optionalServices, [{ id: "vercel", status: "not_connected", message: "Not connected yet." }]);
});

test("each required readiness gate returns a founder-safe blocker", () => {
  const blockedCases = [
    ["founder_profile", (input) => { input.founder.name = ""; }],
    ["google_workspace", (input) => { input.syncStates = input.syncStates.filter((state) => state.connectorId !== "google_docs"); }],
    ["github_repository", (input) => { input.connections.find((connection) => connection.connectorId === "github").settings = { installationId: "123" }; }],
    ["work_engine", (input) => { input.runners[0].heartbeatExpiresAt = now; }],
    ["external_action_approval", (input) => { input.workspace.reviewExternalActions = false; }],
  ];

  for (const [gateId, block] of blockedCases) {
    const input = readyInput();
    block(input);
    if (gateId === "github_repository") {
      assert.deepEqual(input.connections.find((connection) => connection.connectorId === "github").settings, { installationId: "123" });
    }
    const result = readiness.evaluateWorkspaceReadiness(input);
    assert.equal(result.ready, false, gateId);
    assert.equal(result.gates.find((gate) => gate.status === "blocked").id, gateId);
    assert.ok(result.blockingReason.length > 0);
  }
});

test("client completion markers and claimed connector choices cannot bypass server readiness", () => {
  const input = readyInput();
  input.workspace = {
    name: "Acme",
    reviewExternalActions: true,
    onboardingCompletedAt: now,
    onboardingConnectorIds: ["gmail", "github", "vercel"],
  };
  input.connections = [];
  input.syncStates = [];
  input.setupSessions = [];
  input.runners = [];

  const result = readiness.evaluateWorkspaceReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.gates.find((gate) => gate.status === "blocked").id, "google_workspace");
});

test("readiness becomes invalid after setup when a required integration or runner is unavailable", () => {
  const googleUnavailable = readyInput();
  googleUnavailable.connections.find((connection) => connection.connectorId === "gmail").status = "needs_attention";
  assert.equal(readiness.evaluateWorkspaceReadiness(googleUnavailable).ready, false);

  const engineUnavailable = readyInput();
  engineUnavailable.runners[0].status = "offline";
  assert.equal(readiness.evaluateWorkspaceReadiness(engineUnavailable).ready, false);
});
