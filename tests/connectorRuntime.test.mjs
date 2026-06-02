import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadConnectorRuntimeModule() {
  const sourcePath = resolve(process.cwd(), "convex", "connectorRuntime.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-connectors-"));
  const outputPath = join(outputDir, "connectorRuntime.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const runtime = await loadConnectorRuntimeModule();

const activeConnectorIds = [
  "gmail",
  "google_calendar",
  "google_drive",
  "google_docs",
  "google_sheets",
  "github",
  "opencode",
  "vercel",
];

const removedConnectorIds = ["posthog", "resend", "slack", "canva", "notion", "stripe"];

test("registry exposes only active founder-facing connectors", () => {
  assert.deepEqual(
    runtime.listConnectorDefinitions().map((connector) => connector.id),
    activeConnectorIds,
  );

  for (const connectorId of activeConnectorIds) {
    const definition = runtime.getConnectorDefinition(connectorId);
    assert.equal(definition.id, connectorId);
    const publicDefinition = runtime.publicConnectorDefinition(definition);
    assert.equal("requiredScopes" in publicDefinition, false);
    assert.equal(JSON.stringify(publicDefinition).includes("handlerKey"), false);
  }

  for (const connectorId of removedConnectorIds) {
    assert.equal(runtime.getConnectorDefinition(connectorId), undefined);
  }
});

test("removed connector setup and evaluation are safely unavailable", () => {
  for (const connectorId of removedConnectorIds) {
    const setup = runtime.validateApiKeyConnectorSetup({
      connectorId,
      credential: "private_token_1234567890",
    });
    assert.equal(setup.ok, false);
    assert.equal(setup.safeMessage, "That service is not available for private key setup.");

    const evaluation = runtime.evaluateConnectorActionRequest({
      connectorId,
      actionType: "import_content",
      connection: {
        status: "connected",
        credentialRef: "vault:removed",
        grantedScopes: ["legacy.scope"],
      },
    });
    assert.equal(evaluation.allowed, false);
    assert.equal(evaluation.reason, "unknown_connector");
    assert.equal(evaluation.safeMessage, "That service is not available yet.");
  }
});

test("google workspace connectors draft/import freely and gate external actions", () => {
  const gmailConnection = {
    status: "connected",
    credentialRef: "vault:gmail",
    grantedScopes: ["google.gmail.read", "google.gmail.compose", "google.gmail.send"],
  };

  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "gmail",
    actionType: "read_email",
    connection: gmailConnection,
  }).allowed, true);
  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "gmail",
    actionType: "draft_email",
    connection: gmailConnection,
  }).allowed, true);

  const pendingSend = runtime.evaluateConnectorActionRequest({
    connectorId: "gmail",
    actionType: "send_email",
    connection: gmailConnection,
  });
  assert.equal(pendingSend.allowed, false);
  assert.equal(pendingSend.reason, "approval_required");
  assert.equal(pendingSend.sensitiveActionKind, "send_email");

  const calendarConnection = {
    status: "connected",
    credentialRef: "vault:google-calendar",
    grantedScopes: ["google.calendar.read", "google.calendar.events"],
  };
  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "google_calendar",
    actionType: "check_availability",
    connection: calendarConnection,
  }).allowed, true);

  const pendingEvent = runtime.evaluateConnectorActionRequest({
    connectorId: "google_calendar",
    actionType: "create_calendar_event",
    connection: calendarConnection,
  });
  assert.equal(pendingEvent.allowed, false);
  assert.equal(pendingEvent.reason, "approval_required");

  for (const connectorId of ["google_drive", "google_docs", "google_sheets"]) {
    const definition = runtime.getConnectorDefinition(connectorId);
    assert.deepEqual(
      definition.actions.map((action) => action.type),
      ["import_content", "write_record", "export_content", "update_external_record"],
    );
    assert.equal(runtime.evaluateConnectorActionRequest({
      connectorId,
      actionType: "export_content",
      connection: {
        status: "connected",
        credentialRef: `vault:${connectorId}`,
        grantedScopes: definition.requiredScopes,
      },
    }).allowed, true);

    const missingWriteScope = runtime.evaluateConnectorActionRequest({
      connectorId,
      actionType: "write_record",
      connection: {
        status: "connected",
        credentialRef: `vault:${connectorId}`,
        grantedScopes: definition.requiredScopes,
      },
      approvalGranted: true,
    });
    assert.equal(missingWriteScope.reason, "missing_permission");

    const writeScopes = {
      google_drive: ["google.drive.read", "google.drive.file"],
      google_docs: ["google.drive.read", "google.docs.read", "google.docs.file"],
      google_sheets: ["google.drive.read", "google.sheets.read", "google.sheets.write"],
    }[connectorId];
    const pendingWrite = runtime.evaluateConnectorActionRequest({
      connectorId,
      actionType: "write_record",
      connection: {
        status: "connected",
        credentialRef: `vault:${connectorId}`,
        grantedScopes: writeScopes,
      },
    });
    assert.equal(pendingWrite.reason, "approval_required");
    assert.equal(pendingWrite.sensitiveActionKind, "change_live_asset");
    assert.equal(runtime.evaluateConnectorActionRequest({
      connectorId,
      actionType: "write_record",
      connection: {
        status: "connected",
        credentialRef: `vault:${connectorId}`,
        grantedScopes: writeScopes,
      },
      approvalGranted: true,
    }).allowed, true);
  }
});

test("github and website preview connections keep approval boundaries", () => {
  const githubConnection = {
    status: "connected",
    credentialRef: "vault:github",
    grantedScopes: ["github.metadata", "github.contents.read"],
    settings: { installationId: "123", repositoryOwner: "founder", repositoryName: "os" },
  };
  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "github",
    actionType: "import_repository_context",
    connection: githubConnection,
  }).allowed, true);

  const pullRequest = runtime.evaluateConnectorActionRequest({
    connectorId: "github",
    actionType: "create_pull_request",
    connection: githubConnection,
  });
  assert.equal(pullRequest.allowed, false);
  assert.equal(pullRequest.reason, "approval_required");
  assert.equal(pullRequest.safeMessage, "This needs your approval first.");
  assert.equal(pullRequest.sensitiveActionKind, "change_live_asset");

  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "github",
    actionType: "create_pull_request",
    connection: githubConnection,
    approvalGranted: true,
  }).allowed, true);

  const pendingIssue = runtime.evaluateConnectorActionRequest({
    connectorId: "github",
    actionType: "create_issue",
    connection: githubConnection,
  });
  assert.equal(pendingIssue.allowed, false);
  assert.equal(pendingIssue.reason, "approval_required");
  assert.equal(pendingIssue.sensitiveActionKind, "change_live_asset");

  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "github",
    actionType: "create_issue",
    connection: githubConnection,
    approvalGranted: true,
  }).allowed, true);

  assert.equal(runtime.testConnectorConnection(runtime.getConnectorDefinition("github"), {
    status: "connected",
    credentialRef: "vault:github",
    grantedScopes: ["github.metadata", "github.contents.read"],
    settings: { installationId: "123", repositoryName: "os" },
  }).status, "needs_attention");

  const vercel = runtime.getConnectorDefinition("vercel");
  const vercelSettings = runtime.sanitizeConnectorConnectionSettings("vercel", {
    projectId: " prj_abc ",
    projectName: " founder-os ",
    productionDomain: "https://Founder.example/path",
    token: "vercel_secret_should_not_store",
  });
  assert.equal(vercelSettings.projectId, "prj_abc");
  assert.equal(vercelSettings.productionDomain, "founder.example");
  assert.equal(JSON.stringify(runtime.publicConnectionCard(vercel, { settings: vercelSettings })).includes("prj_abc"), false);

  const vercelConnection = {
    status: "connected",
    credentialRef: "vault:vercel",
    grantedScopes: ["web.preview", "web.publish"],
    settings: vercelSettings,
  };
  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "vercel",
    actionType: "create_preview_deployment",
    connection: vercelConnection,
  }).reason, "blocked_by_policy");
  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "vercel",
    actionType: "publish_live_deployment",
    connection: vercelConnection,
    approvalGranted: true,
  }).reason, "blocked_by_policy");
});

test("opencode managed setup defaults to local command and hides advanced details", () => {
  const definition = runtime.getConnectorDefinition("opencode");
  const settings = runtime.sanitizeOpenCodeConnectionSettings({
    model: "provider/private-model",
    attachUrl: "http://localhost:4096",
  });
  assert.equal(settings.command, "opencode");
  assert.equal(settings.attachUrl, "http://localhost:4096");
  assert.equal(runtime.sanitizeOpenCodeConnectionSettings({ attachUrl: "http://example.com" }).attachUrl, undefined);

  const connection = {
    status: "connected",
    grantedScopes: ["opencode.run"],
    settings,
  };
  const status = runtime.testConnectorConnection(definition, connection);
  assert.equal(status.status, "connected");
  assert.equal(status.healthy, true);

  const publicCard = runtime.publicConnectionCard(definition, connection);
  assert.equal(publicCard.safeSettings.command, "opencode");
  assert.equal(JSON.stringify(publicCard).includes("provider/private-model"), false);

  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "opencode",
    actionType: "run_code_builder",
    connection,
  }).allowed, true);
  assert.equal(runtime.evaluateConnectorActionRequest({
    connectorId: "opencode",
    actionType: "update_live_asset",
    connection,
  }).reason, "approval_required");
});

test("api-key setup validation is limited to website previews", () => {
  const vercelNeedsProject = runtime.validateApiKeyConnectorSetup({
    connectorId: "vercel",
    credential: "vercel_private_token_1234567890",
  });
  assert.equal(vercelNeedsProject.ok, true);
  assert.equal(vercelNeedsProject.status, "needs_attention");

  const vercelReady = runtime.validateApiKeyConnectorSetup({
    connectorId: "vercel",
    credential: "vercel_private_token_1234567890",
    settings: { projectId: " prj_123 ", token: "should_not_store" },
  });
  assert.equal(vercelReady.status, "connected");
  assert.deepEqual(vercelReady.grantedScopes, ["web.preview", "web.publish"]);
  assert.equal(JSON.stringify(vercelReady.settings).includes("should_not_store"), false);
});

test("credential storage abstraction encrypts secrets and returns only safe metadata", async () => {
  const rawSecret = "private_secret_1234567890";
  const envelope = await runtime.connectorCredentialStorage.seal({
    workspaceId: "workspace1",
    connectorId: "vercel",
    secret: rawSecret,
    now: 1000,
    keyMaterial: "unit-test-key",
  });
  const publicMetadata = runtime.connectorCredentialStorage.publicMetadata(envelope);

  assert.equal(envelope.sealedReference.includes(rawSecret), false);
  assert.equal(envelope.vaultKey.includes(rawSecret), false);
  assert.equal(envelope.encryptedSecret.includes(rawSecret), false);
  assert.equal(JSON.stringify(publicMetadata).includes(rawSecret), false);
  assert.equal(publicMetadata.secretPreview, "****7890");
  assert.equal(
    await runtime.connectorCredentialStorage.unseal({
      encryptedSecret: envelope.encryptedSecret,
      encryptionNonce: envelope.encryptionNonce,
      keyMaterial: "unit-test-key",
    }),
    rawSecret,
  );
});

test("safe errors strip secrets, responses, URLs, and technical logs", () => {
  const error = new Error(
    'HTTP 401 from https://api.example.com/v1/resources with Bearer private_secret_1234567890 stack trace {"error":"raw response"}',
  );

  const safe = runtime.safeConnectorError(error);
  assert.equal(safe, "The connection could not finish that step.");
  assert.equal(safe.includes("private_secret"), false);
  assert.equal(safe.includes("api.example.com"), false);
  assert.equal(safe.includes("raw response"), false);

  assert.equal(
    runtime.safeConnectorError(new Error("Please reconnect this service.")),
    "Please reconnect this service.",
  );
});

test("registered connector handlers do not fake unsupported success", async () => {
  for (const definition of runtime.listConnectorDefinitions()) {
    for (const action of definition.actions) {
      if (action.approval === "blocked") continue;
      const handler = runtime.getConnectorActionHandler(action.handlerKey);
      assert.equal(typeof handler, "function", `${definition.id}:${action.type} has a handler`);
      const result = await handler({
        connectorId: definition.id,
        actionType: action.type,
        approved: true,
      });
      assert.notEqual(result.status, "completed", `${definition.id}:${action.type} should not report live success from the placeholder handler`);
      assert.match(result.safeSummary, /not connected to a live provider yet|blocked by policy/);
    }
  }
});
