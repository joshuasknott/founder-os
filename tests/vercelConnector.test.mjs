import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectVercelDeploymentFiles,
  createVercelPreviewDeployment,
  publishVercelDeployment,
  safeVercelFailureMessage,
  vercelIsConfigured,
  vercelSettingsFromEnv,
} from "../workers/builder/vercelConnector.mjs";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

test("vercel settings require explicit preview enablement and credentials", () => {
  const disabled = vercelSettingsFromEnv({
    VERCEL_TOKEN: "token",
    VERCEL_PROJECT_ID: "prj_123",
  });
  assert.equal(vercelIsConfigured(disabled), false);

  const enabled = vercelSettingsFromEnv({
    BUILDER_VERCEL_PREVIEWS: "true",
    VERCEL_TOKEN: "token",
    VERCEL_PROJECT_ID: "prj_123",
    VERCEL_PRODUCTION_DOMAIN: "https://Founder.example/path",
  });
  assert.equal(vercelIsConfigured(enabled), true);
  assert.equal(enabled.productionDomain, "founder.example");
});

test("preview deployment sends a sanitized request and returns safe metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "founderos-vercel-preview-"));
  try {
    await writeFile(join(root, "package.json"), "{\"scripts\":{\"build\":\"next build\"}}", "utf8");
    await mkdir(join(root, "app"));
    await writeFile(join(root, "app", "page.tsx"), "export default function Page() { return 'ok'; }", "utf8");
    await writeFile(join(root, ".env.local"), "VERCEL_TOKEN=secret", "utf8");

    const requests = [];
    const result = await createVercelPreviewDeployment({
      workspaceDir: root,
      settings: {
        enabled: true,
        token: "vercel_private_token",
        projectId: "prj_123",
        projectName: "founderos",
        teamId: "team_123",
        apiBaseUrl: "https://api.vercel.com",
      },
      metadata: { runId: "run1" },
      now: 1000,
      request: async (url, init) => {
        requests.push({ url, init });
        return jsonResponse({
          id: "dpl_123",
          url: "founderos-preview.vercel.app",
          readyState: "READY",
        });
      },
    });

    assert.equal(result.provider, "vercel");
    assert.equal(result.previewUrl, "https://founderos-preview.vercel.app");
    assert.equal(result.publishRequiresApproval, true);
    assert.equal(JSON.stringify(result).includes("vercel_private_token"), false);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.vercel.com/v13/deployments?teamId=team_123");

    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.target, undefined);
    assert.equal(body.meta.runId, "run1");
    assert.equal(JSON.stringify(body).includes("VERCEL_TOKEN"), false);
    assert.equal(body.files.some((file) => file.file === ".env.local"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("publish deployment uses production alias after approval", async () => {
  const requests = [];
  const result = await publishVercelDeployment({
    deploymentId: "dpl_123",
    productionDomain: "founder.example",
    settings: {
      enabled: true,
      token: "vercel_private_token",
      projectId: "prj_123",
      teamId: "team_123",
      apiBaseUrl: "https://api.vercel.com",
    },
    now: 2000,
    request: async (url, init) => {
      requests.push({ url, init });
      return jsonResponse({ alias: "founder.example" });
    },
  });

  assert.equal(result.target, "production");
  assert.equal(result.status, "live");
  assert.equal(result.liveUrl, "https://founder.example");
  assert.equal(result.publishRequiresApproval, false);
  assert.equal(requests[0].url, "https://api.vercel.com/v2/deployments/dpl_123/aliases?teamId=team_123");
  assert.equal(JSON.parse(requests[0].init.body).alias, "founder.example");
});

test("vercel failures are safe and deployment files omit private files", async () => {
  const root = await mkdtemp(join(tmpdir(), "founderos-vercel-files-"));
  try {
    await writeFile(join(root, "index.html"), "<h1>ok</h1>", "utf8");
    await writeFile(join(root, ".env.production"), "SECRET=1", "utf8");

    const files = await collectVercelDeploymentFiles(root);
    assert.deepEqual(files.map((file) => file.file), ["index.html"]);

    const safe = safeVercelFailureMessage(
      new Error("HTTP 401 from https://api.vercel.com with Bearer vercel_private_token and raw response"),
    );
    assert.equal(safe, "FounderOS could not create the preview link yet.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
