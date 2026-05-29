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

test("registry exposes safe connector metadata and action handlers", () => {
  const email = runtime.getConnectorDefinition("email");
  assert.equal(email.safeDisplayName, "Email");
  assert.equal(email.authType, "oauth2");
  assert.deepEqual(email.capabilities, ["read_email", "send_email"]);
  assert.deepEqual(email.requiredScopes, ["email.read", "email.send"]);
  assert.equal(email.approvalPolicy, "per_sensitive_action");

  const publicEmail = runtime.publicConnectorDefinition(email);
  assert.equal(publicEmail.safeDisplayName, "Email");
  assert.equal(JSON.stringify(publicEmail).includes("handlerKey"), false);
  assert.equal(JSON.stringify(publicEmail).includes("private credential"), false);

  for (const connector of runtime.listConnectorDefinitions()) {
    for (const action of connector.actions) {
      assert.equal(typeof runtime.getConnectorActionHandler(action.handlerKey), "function");
    }
  }
});

test("connection status is safe and does not expose raw permission names", () => {
  const payments = runtime.getConnectorDefinition("payments");

  assert.deepEqual(runtime.testConnectorConnection(payments), {
    status: "not_connected",
    safeMessage: "Not connected yet.",
    healthy: false,
  });

  const missing = runtime.testConnectorConnection(payments, {
    status: "connected",
    credentialRef: "vault:payments",
    grantedScopes: ["payments.read"],
  });
  assert.equal(missing.status, "needs_attention");
  assert.equal(missing.safeMessage.includes("payments.charge"), false);

  const ready = runtime.testConnectorConnection(payments, {
    status: "connected",
    credentialRef: "vault:payments",
    grantedScopes: ["payments.read", "payments.charge"],
  });
  assert.equal(ready.status, "connected");
  assert.equal(ready.healthy, true);
});

test("permissions block missing scopes before actions run", () => {
  const result = runtime.evaluateConnectorActionRequest({
    connectorId: "email",
    actionType: "send_email",
    connection: {
      status: "connected",
      credentialRef: "vault:email",
      grantedScopes: ["email.read"],
    },
    approvalGranted: true,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "missing_permission");
  assert.equal(result.safeMessage, "This service needs updated access before FounderOS can do that.");
  assert.equal(result.safeMessage.includes("email.send"), false);
});

test("sensitive actions require approval and approved actions are allowed", () => {
  const connection = {
    status: "connected",
    credentialRef: "vault:email",
    grantedScopes: ["email.read", "email.send"],
  };

  const pending = runtime.evaluateConnectorActionRequest({
    connectorId: "email",
    actionType: "send_email",
    connection,
  });
  assert.equal(pending.allowed, false);
  assert.equal(pending.approvalRequired, true);
  assert.equal(pending.reason, "approval_required");
  assert.equal(pending.sensitiveActionKind, "send_email");

  const approved = runtime.evaluateConnectorActionRequest({
    connectorId: "email",
    actionType: "send_email",
    connection,
    approvalGranted: true,
  });
  assert.equal(approved.allowed, true);
  assert.equal(approved.approvalRequired, true);

  const readOnly = runtime.evaluateConnectorActionRequest({
    connectorId: "email",
    actionType: "read_email",
    connection,
  });
  assert.equal(readOnly.allowed, true);
  assert.equal(readOnly.approvalRequired, false);
});

test("credential storage abstraction returns only safe metadata", () => {
  const rawSecret = "sk_live_super_secret_1234567890";
  const envelope = runtime.connectorCredentialStorage.seal({
    workspaceId: "workspace1",
    connectorId: "payments",
    secret: rawSecret,
    now: 1000,
  });
  const publicMetadata = runtime.connectorCredentialStorage.publicMetadata(envelope);

  assert.equal(envelope.sealedReference.includes(rawSecret), false);
  assert.equal(envelope.vaultKey.includes(rawSecret), false);
  assert.equal(JSON.stringify(publicMetadata).includes(rawSecret), false);
  assert.equal(publicMetadata.secretPreview, "****7890");
});

test("safe errors strip secrets, responses, URLs, and technical logs", () => {
  const error = new Error(
    'HTTP 401 from https://api.stripe.com/v1/customers with Bearer sk_live_abc1234567890 stack trace {"error":"raw response"}',
  );

  const safe = runtime.safeConnectorError(error);
  assert.equal(safe, "The connection could not finish that step.");
  assert.equal(safe.includes("sk_live"), false);
  assert.equal(safe.includes("stripe.com"), false);
  assert.equal(safe.includes("raw response"), false);

  assert.equal(
    runtime.safeConnectorError(new Error("Please reconnect this service.")),
    "Please reconnect this service.",
  );
});
