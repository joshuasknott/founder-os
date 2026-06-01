import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadAuthRuntimeModule() {
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-auth-runtime-"));
  for (const name of ["connectorRuntime", "connectorProviderRuntime", "connectorAuthRuntime"]) {
    const sourcePath = resolve(process.cwd(), "convex", `${name}.ts`);
    const source = await readFile(sourcePath, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const output = compiled.outputText
      .replace("./connectorRuntime", "./connectorRuntime.mjs")
      .replace("./connectorProviderRuntime", "./connectorProviderRuntime.mjs");
    await writeFile(join(outputDir, `${name}.mjs`), output, "utf8");
  }
  return import(pathToFileURL(join(outputDir, "connectorAuthRuntime.mjs")).href);
}

const authRuntime = await loadAuthRuntimeModule();

test("oauth authorization URLs include connector scopes and state", () => {
  const googleUrl = new URL(authRuntime.buildOAuthAuthorizationUrl({
    connectorId: "google_workspace",
    clientId: "google-client",
    redirectUri: "https://app.example.com/callback",
    state: "state123",
  }));

  assert.equal(googleUrl.origin, "https://accounts.google.com");
  assert.equal(googleUrl.searchParams.get("client_id"), "google-client");
  assert.equal(googleUrl.searchParams.get("state"), "state123");
  assert.equal(googleUrl.searchParams.get("access_type"), "offline");
  assert.equal(googleUrl.searchParams.get("scope").includes("gmail.readonly"), true);
});

test("oauth token exchange and refresh use form encoded provider requests", async () => {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ access_token: "access", refresh_token: "refresh" }) };
  };

  await authRuntime.exchangeOAuthCode({
    connectorId: "google_workspace",
    clientId: "client",
    clientSecret: "secret",
    code: "code",
    redirectUri: "https://app.example.com/callback",
    request,
  });
  await authRuntime.refreshOAuthToken({
    connectorId: "google_workspace",
    clientId: "client",
    clientSecret: "secret",
    refreshToken: "refresh",
    request,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.body.includes("grant_type=authorization_code"), true);
  assert.equal(calls[0].init.body.includes("client_secret"), true);
  assert.equal(calls[1].init.body.includes("grant_type=refresh_token"), true);
  assert.equal(calls[1].init.body.includes("client_secret"), true);
});

test("connector setup state is signed and expires safely", async () => {
  const state = await authRuntime.createConnectorSetupState({
    workspaceId: "workspace1",
    providerId: "google_workspace",
    connectorIds: ["gmail"],
    nonce: "nonce",
    issuedAt: 1000,
  }, "state-secret");

  const payload = await authRuntime.verifyConnectorSetupState({
    state,
    secret: "state-secret",
    now: 2000,
  });
  assert.equal(payload.workspaceId, "workspace1");
  assert.equal(state.includes("state-secret"), false);

  await assert.rejects(
    () => authRuntime.verifyConnectorSetupState({
      state: `${state}tampered`,
      secret: "state-secret",
      now: 2000,
    }),
    /Settings/,
  );
  await assert.rejects(
    () => authRuntime.verifyConnectorSetupState({
      state,
      secret: "state-secret",
      now: 20 * 60 * 1000,
      maxAgeMs: 5 * 60 * 1000,
    }),
    /Settings/,
  );
});

test("oauth callback token parsing maps provider scopes to safe connector scopes", () => {
  const google = authRuntime.parseOAuthTokenResult({
    connectorId: "google_workspace",
    now: 1000,
    payload: {
      access_token: "ya29.private_access_token",
      refresh_token: "private_refresh_token",
      expires_in: 3600,
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/calendar.events",
      ].join(" "),
    },
  });

  assert.deepEqual(google.grantedScopes.sort(), [
    "google.calendar.events",
    "google.gmail.read",
    "google.gmail.send",
  ].sort());
  assert.equal(google.expiresAt, 3601000);
});

test("github app install url carries state without exposing secrets", () => {
  const url = new URL(authRuntime.buildGitHubAppInstallUrl({
    appName: "founderos",
    state: "state789",
    targetId: "123",
  }));

  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/apps/founderos/installations/new");
  assert.equal(url.searchParams.get("state"), "state789");
  assert.equal(url.searchParams.get("target_id"), "123");
});
