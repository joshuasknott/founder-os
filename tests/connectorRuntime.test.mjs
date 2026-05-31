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

  const drive = runtime.getConnectorDefinition("google_drive");
  assert.equal(drive.safeDisplayName, "Google Drive");
  assert.deepEqual(
    drive.actions.map((action) => action.type),
    ["import_content", "export_content", "update_external_record"],
  );

  const docs = runtime.getConnectorDefinition("google_docs");
  assert.equal(docs.safeDisplayName, "Google Docs");
  assert.deepEqual(
    docs.actions.map((action) => action.type),
    ["import_content", "export_content", "update_external_record"],
  );

  const sheets = runtime.getConnectorDefinition("google_sheets");
  assert.equal(sheets.safeDisplayName, "Google Sheets");
  assert.deepEqual(
    sheets.actions.map((action) => action.type),
    ["import_content", "export_content", "update_external_record"],
  );

  const github = runtime.getConnectorDefinition("github");
  assert.equal(github.authType, "github_app");
  assert.equal(JSON.stringify(runtime.publicConnectorDefinition(github)).includes("github.contents"), false);

  const posthog = runtime.getConnectorDefinition("posthog");
  assert.equal(posthog.safeDisplayName, "PostHog");
  assert.equal(posthog.actions.some((action) => action.approval === "blocked"), true);

  const resend = runtime.getConnectorDefinition("resend");
  assert.equal(resend.safeDisplayName, "Resend");

  const canva = runtime.getConnectorDefinition("canva");
  assert.equal(canva.safeDisplayName, "Canva");

  const opencode = runtime.getConnectorDefinition("opencode");
  assert.equal(opencode.authType, "managed");

  const stripe = runtime.getConnectorDefinition("stripe");
  assert.equal(stripe.safeDisplayName, "Stripe");
  assert.equal(stripe.authType, "api_key");
  assert.deepEqual(stripe.requiredScopes, ["stripe.read"]);
  assert.equal(stripe.approvalPolicy, "per_sensitive_action");
  assert.equal(JSON.stringify(runtime.publicConnectorDefinition(stripe)).includes("stripe.read"), false);
  assert.equal(stripe.actions.some((action) => action.approval === "blocked"), true);

  for (const connector of runtime.listConnectorDefinitions()) {
    for (const action of connector.actions) {
      assert.equal(typeof runtime.getConnectorActionHandler(action.handlerKey), "function");
    }
  }
});

test("content connectors import freely and gate external writes", () => {
  const driveConnection = {
    status: "connected",
    credentialRef: "vault:drive",
    grantedScopes: ["google.drive.read", "google.drive.file"],
  };
  const driveImport = runtime.evaluateConnectorActionRequest({
    connectorId: "google_drive",
    actionType: "import_content",
    connection: driveConnection,
  });
  assert.equal(driveImport.allowed, true);
  assert.equal(driveImport.approvalRequired, false);

  const driveExport = runtime.evaluateConnectorActionRequest({
    connectorId: "google_drive",
    actionType: "export_content",
    connection: driveConnection,
  });
  assert.equal(driveExport.allowed, false);
  assert.equal(driveExport.reason, "approval_required");
  assert.equal(driveExport.sensitiveActionKind, "change_live_asset");

  const docsConnection = {
    status: "connected",
    credentialRef: "vault:docs",
    grantedScopes: ["google.docs.read", "google.docs.file"],
  };
  const docsImport = runtime.evaluateConnectorActionRequest({
    connectorId: "google_docs",
    actionType: "import_content",
    connection: docsConnection,
  });
  assert.equal(docsImport.allowed, true);
  assert.equal(docsImport.approvalRequired, false);

  const docsUpdate = runtime.evaluateConnectorActionRequest({
    connectorId: "google_docs",
    actionType: "update_external_record",
    connection: docsConnection,
  });
  assert.equal(docsUpdate.allowed, false);
  assert.equal(docsUpdate.reason, "approval_required");
  assert.equal(docsUpdate.sensitiveActionKind, "change_live_asset");

  const githubConnection = {
    status: "connected",
    credentialRef: "vault:github",
    grantedScopes: ["github.metadata", "github.contents.read", "github.pull_requests.write", "github.issues.write"],
    settings: { installationId: "123", repositoryOwner: "founder", repositoryName: "os" },
  };
  const githubImport = runtime.evaluateConnectorActionRequest({
    connectorId: "github",
    actionType: "import_repository_context",
    connection: githubConnection,
  });
  assert.equal(githubImport.allowed, true);
  assert.equal(githubImport.approvalRequired, false);

  const pullRequest = runtime.evaluateConnectorActionRequest({
    connectorId: "github",
    actionType: "create_pull_request",
    connection: githubConnection,
    approvalGranted: true,
  });
  assert.equal(pullRequest.allowed, true);
  assert.equal(pullRequest.approvalRequired, true);
});

test("stripe sync is read-only and write actions are blocked by policy", () => {
  const connection = {
    status: "connected",
    credentialRef: "vault:stripe",
    grantedScopes: ["stripe.read", "stripe.write"],
  };

  const sync = runtime.evaluateConnectorActionRequest({
    connectorId: "stripe",
    actionType: "sync_stripe_finance_context",
    connection,
  });
  assert.equal(sync.allowed, true);
  assert.equal(sync.approvalRequired, false);

  const charge = runtime.evaluateConnectorActionRequest({
    connectorId: "stripe",
    actionType: "charge_payment",
    connection,
    approvalGranted: true,
  });
  assert.equal(charge.allowed, false);
  assert.equal(charge.reason, "blocked_by_policy");
  assert.equal(charge.approvalRequired, false);
  assert.equal(charge.sensitiveActionKind, "spend_money");
  assert.equal(charge.safeMessage.includes("blocked by policy"), true);

  const refund = runtime.evaluateConnectorActionRequest({
    connectorId: "stripe",
    actionType: "refund_payment",
    connection,
    approvalGranted: true,
  });
  assert.equal(refund.reason, "blocked_by_policy");

  const cancel = runtime.evaluateConnectorActionRequest({
    connectorId: "stripe",
    actionType: "cancel_subscription",
    connection,
    approvalGranted: true,
  });
  assert.equal(cancel.reason, "blocked_by_policy");
  assert.equal(cancel.sensitiveActionKind, "change_live_asset");

  const deletion = runtime.evaluateConnectorActionRequest({
    connectorId: "stripe",
    actionType: "delete_external_record",
    connection,
    approvalGranted: true,
  });
  assert.equal(deletion.reason, "blocked_by_policy");
  assert.equal(deletion.sensitiveActionKind, "delete_data");
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

test("opencode managed setup runs builder work without storing provider keys", () => {
  const missingSetup = runtime.testConnectorConnection(
    runtime.getConnectorDefinition("opencode"),
    {
      status: "connected",
      grantedScopes: ["opencode.run"],
    },
  );
  assert.equal(missingSetup.status, "needs_attention");

  const connection = {
    status: "connected",
    grantedScopes: ["opencode.run"],
    settings: { command: "opencode", model: "openrouter/deepseek/deepseek-chat" },
  };
  const status = runtime.testConnectorConnection(runtime.getConnectorDefinition("opencode"), connection);
  assert.equal(status.status, "connected");
  assert.equal(status.healthy, true);

  const run = runtime.evaluateConnectorActionRequest({
    connectorId: "opencode",
    actionType: "run_code_builder",
    connection,
  });
  assert.equal(run.allowed, true);
  assert.equal(run.approvalRequired, false);

  const apply = runtime.evaluateConnectorActionRequest({
    connectorId: "opencode",
    actionType: "update_live_asset",
    connection,
  });
  assert.equal(apply.allowed, false);
  assert.equal(apply.reason, "approval_required");
});

test("new connector actions follow v1 approval boundaries", () => {
  const posthogConnection = {
    status: "connected",
    credentialRef: "vault:posthog",
    grantedScopes: ["posthog.read", "posthog.write"],
    settings: { host: "https://us.posthog.com", projectId: "12345" },
  };
  const analytics = runtime.evaluateConnectorActionRequest({
    connectorId: "posthog",
    actionType: "query_analytics",
    connection: posthogConnection,
  });
  assert.equal(analytics.allowed, true);
  assert.equal(analytics.approvalRequired, false);
  const posthogWrite = runtime.evaluateConnectorActionRequest({
    connectorId: "posthog",
    actionType: "update_external_record",
    connection: posthogConnection,
    approvalGranted: true,
  });
  assert.equal(posthogWrite.allowed, false);
  assert.equal(posthogWrite.reason, "blocked_by_policy");

  const resendConnection = {
    status: "connected",
    credentialRef: "vault:resend",
    grantedScopes: ["resend.send"],
    settings: { senderEmail: "founder@example.com" },
  };
  const draft = runtime.evaluateConnectorActionRequest({
    connectorId: "resend",
    actionType: "draft_email",
    connection: resendConnection,
  });
  assert.equal(draft.allowed, true);
  assert.equal(draft.approvalRequired, false);
  const send = runtime.evaluateConnectorActionRequest({
    connectorId: "resend",
    actionType: "send_transactional_email",
    connection: resendConnection,
  });
  assert.equal(send.allowed, false);
  assert.equal(send.reason, "approval_required");
  assert.equal(send.sensitiveActionKind, "send_email");

  const canvaConnection = {
    status: "connected",
    credentialRef: "vault:canva",
    grantedScopes: ["canva.design.read", "canva.design.write", "canva.asset.read"],
  };
  const createDesign = runtime.evaluateConnectorActionRequest({
    connectorId: "canva",
    actionType: "create_design",
    connection: canvaConnection,
  });
  assert.equal(createDesign.allowed, true);
  assert.equal(createDesign.approvalRequired, false);
  const updateDesign = runtime.evaluateConnectorActionRequest({
    connectorId: "canva",
    actionType: "update_external_record",
    connection: canvaConnection,
  });
  assert.equal(updateDesign.allowed, false);
  assert.equal(updateDesign.reason, "approval_required");
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

test("content connector settings are sanitized and kept out of public cards", () => {
  const github = runtime.getConnectorDefinition("github");
  const githubSettings = runtime.sanitizeConnectorConnectionSettings("github", {
    accountName: " founder ",
    repositoryOwner: " founderos ",
    repositoryName: " founder-os ",
    installationId: " 12345 ",
    privateKey: "-----BEGIN PRIVATE KEY-----secret",
  });

  assert.equal(githubSettings.accountName, "founder");
  assert.equal(githubSettings.installationId, "12345");
  assert.equal(JSON.stringify(githubSettings).includes("PRIVATE KEY"), false);
  assert.equal(JSON.stringify(runtime.publicConnectionCard(github, { settings: githubSettings })).includes("12345"), false);

  const posthog = runtime.getConnectorDefinition("posthog");
  const posthogSettings = runtime.sanitizeConnectorConnectionSettings("posthog", {
    host: "https://US.posthog.com/project/123",
    projectId: " 12345 ",
    personalApiKey: "phx_private_token_should_not_store",
  });
  assert.equal(posthogSettings.host, "https://us.posthog.com");
  assert.equal(posthogSettings.projectId, "12345");
  assert.equal(JSON.stringify(posthogSettings).includes("private_token"), false);

  const resend = runtime.getConnectorDefinition("resend");
  const resendSettings = runtime.sanitizeConnectorConnectionSettings("resend", {
    accountEmail: " Founder@Example.COM ",
    senderEmail: " founder@example.com ",
    senderDomain: "https://Example.com/path",
    apiKey: "re_private_token_should_not_store",
  });
  assert.equal(resendSettings.senderEmail, "founder@example.com");
  assert.equal(resendSettings.senderDomain, "example.com");
  assert.equal(JSON.stringify(runtime.publicConnectionCard(resend, { settings: resendSettings })).includes("founder@example.com"), false);

  const readyPosthog = runtime.testConnectorConnection(posthog, {
    status: "connected",
    credentialRef: "vault:posthog",
    grantedScopes: ["posthog.read"],
    settings: posthogSettings,
  });
  assert.equal(readyPosthog.status, "connected");
});

test("api-key setup validation stores only allowed connector access", () => {
  const rejectedStripe = runtime.validateApiKeyConnectorSetup({
    connectorId: "stripe",
    credential: "sk_live_broad_secret_should_not_store",
  });
  assert.equal(rejectedStripe.ok, false);
  assert.equal(rejectedStripe.safeMessage.includes("read-only"), true);
  assert.equal(JSON.stringify(rejectedStripe).includes("sk_live"), false);

  const stripe = runtime.validateApiKeyConnectorSetup({
    connectorId: "stripe",
    credential: "rk_test_readonly_1234567890",
  });
  assert.equal(stripe.ok, true);
  assert.deepEqual(stripe.grantedScopes, ["stripe.read"]);
  assert.equal(stripe.status, "connected");

  const vercelNeedsProject = runtime.validateApiKeyConnectorSetup({
    connectorId: "vercel",
    credential: "vercel_private_token_1234567890",
  });
  assert.equal(vercelNeedsProject.ok, true);
  assert.equal(vercelNeedsProject.status, "needs_attention");

  const vercelReady = runtime.validateApiKeyConnectorSetup({
    connectorId: "vercel",
    credential: "vercel_private_token_1234567890",
    settings: {
      projectId: " prj_123 ",
      token: "should_not_store",
    },
  });
  assert.equal(vercelReady.status, "connected");
  assert.deepEqual(vercelReady.grantedScopes, ["web.preview", "web.publish"]);
  assert.equal(JSON.stringify(vercelReady.settings).includes("should_not_store"), false);

  const posthog = runtime.validateApiKeyConnectorSetup({
    connectorId: "posthog",
    credential: "phx_private_1234567890",
    settings: {
      host: "https://US.posthog.com/project/123",
      projectId: " 12345 ",
      personalApiKey: "should_not_store",
    },
  });
  assert.equal(posthog.status, "connected");
  assert.deepEqual(posthog.grantedScopes, ["posthog.read"]);
  assert.equal(JSON.stringify(posthog.settings).includes("should_not_store"), false);

  const resend = runtime.validateApiKeyConnectorSetup({
    connectorId: "resend",
    credential: "re_private_1234567890",
    settings: {
      senderEmail: " founder@example.com ",
      apiKey: "should_not_store",
    },
  });
  assert.equal(resend.status, "connected");
  assert.deepEqual(resend.grantedScopes, ["resend.send"]);
});

test("disconnect and reconnect status remains safe", () => {
  const vercel = runtime.getConnectorDefinition("vercel");
  const disabled = runtime.testConnectorConnection(vercel, {
    status: "disabled",
    disabledAt: 1000,
    credentialRef: "vault:vercel",
    grantedScopes: ["web.preview", "web.publish"],
    settings: { projectId: "prj_123" },
  });
  assert.equal(disabled.status, "disabled");
  assert.equal(disabled.safeMessage, "Turned off.");

  const reconnect = runtime.validateApiKeyConnectorSetup({
    connectorId: "vercel",
    credential: "vercel_private_token_1234567890",
    settings: { projectId: "prj_123" },
  });
  assert.equal(reconnect.ok, true);
  assert.equal(reconnect.status, "connected");
  assert.equal(JSON.stringify(reconnect).includes("vercel_private_token"), false);
});

test("credential storage abstraction encrypts secrets and returns only safe metadata", async () => {
  const rawSecret = "sk_live_super_secret_1234567890";
  const envelope = await runtime.connectorCredentialStorage.seal({
    workspaceId: "workspace1",
    connectorId: "payments",
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
