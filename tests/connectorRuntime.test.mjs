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
  assert.equal("requiredScopes" in publicEmail, false);
  assert.equal(JSON.stringify(publicEmail).includes("handlerKey"), false);
  assert.equal(JSON.stringify(publicEmail).includes("private credential"), false);

  const gmail = runtime.getConnectorDefinition("gmail");
  assert.equal(gmail.safeDisplayName, "Gmail");
  assert.deepEqual(gmail.capabilities, ["read_email", "draft_email", "send_email"]);
  assert.equal(gmail.approvalPolicy, "per_sensitive_action");
  assert.equal(JSON.stringify(runtime.publicConnectorDefinition(gmail)).includes("google.gmail"), false);

  const googleCalendar = runtime.getConnectorDefinition("google_calendar");
  assert.equal(googleCalendar.safeDisplayName, "Google Calendar");
  assert.deepEqual(googleCalendar.capabilities, [
    "read_calendar",
    "check_availability",
    "create_calendar_event",
  ]);
  assert.equal(JSON.stringify(runtime.publicConnectorDefinition(googleCalendar)).includes("google.calendar"), false);

  for (const connector of runtime.listConnectorDefinitions()) {
    for (const action of connector.actions) {
      assert.equal(typeof runtime.getConnectorActionHandler(action.handlerKey), "function");
    }
  }
});

test("google workspace connectors draft/import freely and gate external actions", () => {
  const gmailConnection = {
    status: "connected",
    credentialRef: "vault:gmail",
    grantedScopes: ["google.gmail.read", "google.gmail.compose", "google.gmail.send"],
  };

  const read = runtime.evaluateConnectorActionRequest({
    connectorId: "gmail",
    actionType: "read_email",
    connection: gmailConnection,
  });
  assert.equal(read.allowed, true);
  assert.equal(read.approvalRequired, false);

  const draft = runtime.evaluateConnectorActionRequest({
    connectorId: "gmail",
    actionType: "draft_email",
    connection: gmailConnection,
  });
  assert.equal(draft.allowed, true);
  assert.equal(draft.approvalRequired, false);

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
  const availability = runtime.evaluateConnectorActionRequest({
    connectorId: "google_calendar",
    actionType: "check_availability",
    connection: calendarConnection,
  });
  assert.equal(availability.allowed, true);
  assert.equal(availability.approvalRequired, false);

  const pendingEvent = runtime.evaluateConnectorActionRequest({
    connectorId: "google_calendar",
    actionType: "create_calendar_event",
    connection: calendarConnection,
  });
  assert.equal(pendingEvent.allowed, false);
  assert.equal(pendingEvent.reason, "approval_required");
  assert.equal(pendingEvent.sensitiveActionKind, "create_calendar_event");
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

test("vercel connector creates previews without approval and gates live publishing", () => {
  const vercel = runtime.getConnectorDefinition("vercel");
  assert.equal(vercel.safeDisplayName, "Website previews");
  assert.equal(vercel.authType, "api_key");
  assert.equal(JSON.stringify(runtime.publicConnectorDefinition(vercel)).includes("Vercel"), false);

  const connection = {
    status: "connected",
    credentialRef: "vault:vercel",
    grantedScopes: ["web.preview", "web.publish"],
    settings: {
      projectId: "prj_123",
      productionDomain: "founder.example",
    },
  };

  const preview = runtime.evaluateConnectorActionRequest({
    connectorId: "vercel",
    actionType: "create_preview_deployment",
    connection,
  });
  assert.equal(preview.allowed, true);
  assert.equal(preview.approvalRequired, false);

  const live = runtime.evaluateConnectorActionRequest({
    connectorId: "vercel",
    actionType: "publish_live_deployment",
    connection,
  });
  assert.equal(live.allowed, false);
  assert.equal(live.reason, "approval_required");
  assert.equal(live.sensitiveActionKind, "change_live_asset");

  const approved = runtime.evaluateConnectorActionRequest({
    connectorId: "vercel",
    actionType: "publish_live_deployment",
    connection,
    approvalGranted: true,
  });
  assert.equal(approved.allowed, true);
  assert.equal(approved.approvalRequired, true);
});

test("vercel connection settings are internal, sanitized, and required", () => {
  const vercel = runtime.getConnectorDefinition("vercel");
  const sanitized = runtime.sanitizeConnectorConnectionSettings("vercel", {
    projectId: " prj_abc ",
    projectName: " founder-os ",
    teamId: " team_123 ",
    productionDomain: "https://Founder.example/path",
    rootDirectory: "../apps/web",
    token: "vercel_secret_should_not_store",
  });

  assert.equal(sanitized.projectId, "prj_abc");
  assert.equal(sanitized.productionDomain, "founder.example");
  assert.equal(JSON.stringify(sanitized).includes("secret"), false);
  assert.equal(JSON.stringify(runtime.publicConnectionCard(vercel, { settings: sanitized })).includes("prj_abc"), false);

  const missingSettings = runtime.testConnectorConnection(vercel, {
    status: "connected",
    credentialRef: "vault:vercel",
    grantedScopes: ["web.preview", "web.publish"],
  });
  assert.equal(missingSettings.status, "needs_attention");
  assert.equal(missingSettings.safeMessage.includes("project"), false);

  const ready = runtime.testConnectorConnection(vercel, {
    status: "connected",
    credentialRef: "vault:vercel",
    grantedScopes: ["web.preview", "web.publish"],
    settings: sanitized,
  });
  assert.equal(ready.status, "connected");
});

test("google workspace settings are sanitized and kept out of public cards", () => {
  const gmail = runtime.getConnectorDefinition("gmail");
  const sanitized = runtime.sanitizeConnectorConnectionSettings("gmail", {
    accountEmail: " Founder@Example.COM ",
    calendarName: " Primary calendar ",
    accessToken: "ya29.private_token_should_not_store",
  });

  assert.equal(sanitized.accountEmail, "founder@example.com");
  assert.equal(sanitized.calendarName, "Primary calendar");
  assert.equal(JSON.stringify(sanitized).includes("private_token"), false);
  assert.equal(JSON.stringify(runtime.publicConnectionCard(gmail, { settings: sanitized })).includes("founder@example.com"), false);
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
