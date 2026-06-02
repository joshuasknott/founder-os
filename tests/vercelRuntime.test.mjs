import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadVercelRuntime() {
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-vercel-runtime-"));
  for (const name of ["connectorRuntime", "connectorProviderRuntime", "vercelRuntime"]) {
    const source = await readFile(resolve(process.cwd(), "convex", `${name}.ts`), "utf8");
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
  return import(pathToFileURL(join(outputDir, "vercelRuntime.mjs")).href);
}

const runtime = await loadVercelRuntime();

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

test("vercel validation clearly reports missing config", async () => {
  const result = await runtime.validateVercelConnection({
    settings: runtime.vercelSettingsFromConnection({ token: "vercel_private_token" }),
    request: async () => jsonResponse(200, {}),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "needs_attention");
  assert.equal(result.safeMessage, "Missing project ID or project name.");
});

test("vercel project confirmation validates the saved provider project", async () => {
  const requests = [];
  const result = await runtime.validateVercelConnection({
    settings: runtime.vercelSettingsFromConnection({
      token: "vercel_private_token",
      settings: { projectId: "prj_123", teamId: "team_123" },
    }),
    request: async (url, init) => {
      requests.push({ url, init });
      return jsonResponse(200, {
        id: "prj_123",
        name: "founder-os",
        framework: "nextjs",
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.project.projectName, "founder-os");
  assert.equal(requests[0].url, "https://api.vercel.com/v9/projects/prj_123?teamId=team_123");
  assert.equal(requests[0].init.headers.Authorization, "Bearer vercel_private_token");
});

test("vercel project selection lists provider projects", async () => {
  const projects = await runtime.listVercelProjects({
    settings: runtime.vercelSettingsFromConnection({
      token: "vercel_private_token",
      settings: { teamId: "team_123" },
    }),
    request: async (url) => {
      assert.equal(url, "https://api.vercel.com/v10/projects?teamId=team_123&limit=20");
      return jsonResponse(200, {
        projects: [
          { id: "prj_1", name: "first" },
          { id: "prj_2", name: "second" },
        ],
      });
    },
  });

  assert.deepEqual(projects.map((project) => project.projectName), ["first", "second"]);
});

test("vercel provider failures are safe and not placeholder success", async () => {
  await assert.rejects(
    runtime.confirmVercelProject({
      settings: runtime.vercelSettingsFromConnection({
        token: "vercel_private_token",
        settings: { projectId: "prj_missing" },
      }),
      request: async () => jsonResponse(404, { error: { message: "Project not found" } }),
    }),
    /Project not found/,
  );

  assert.equal(
    runtime.safeVercelProviderError(new Error("HTTP 401 with Bearer vercel_private_token raw response")),
    "Vercel could not finish that step.",
  );
});

test("vercel preview creation requires a real file bundle", async () => {
  await assert.rejects(
    runtime.createVercelDeploymentFromFiles({
      settings: runtime.vercelSettingsFromConnection({
        token: "vercel_private_token",
        settings: { projectId: "prj_123" },
      }),
      files: [],
      request: async () => jsonResponse(200, {}),
    }),
    /generated preview bundle/,
  );

  const requests = [];
  const result = await runtime.createVercelDeploymentFromFiles({
    settings: runtime.vercelSettingsFromConnection({
      token: "vercel_private_token",
      settings: { projectId: "prj_123", projectName: "founder-os", teamId: "team_123" },
    }),
    files: [{ file: "index.html", data: Buffer.from("<h1>Preview</h1>").toString("base64") }],
    request: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return jsonResponse(200, {
        id: "dpl_123",
        url: "founder-preview.vercel.app",
        readyState: "READY",
      });
    },
    now: 1000,
  });

  assert.equal(result.status, "completed");
  assert.equal(result.providerUrl, "https://founder-preview.vercel.app");
  assert.equal(result.metadata.publishRequiresApproval, true);
  assert.equal(requests[0].url, "https://api.vercel.com/v13/deployments?teamId=team_123");
  assert.equal(requests[0].body.project, "prj_123");
  assert.equal(JSON.stringify(result).includes("vercel_private_token"), false);
});

test("vercel live publish requires deployment id and production domain", async () => {
  const settings = runtime.vercelSettingsFromConnection({
    token: "vercel_private_token",
    settings: { projectId: "prj_123" },
  });

  await assert.rejects(
    runtime.publishVercelDeploymentFromSettings({
      settings,
      deploymentId: "dpl_123",
      request: async () => jsonResponse(200, {}),
    }),
    /production domain/,
  );

  const result = await runtime.publishVercelDeploymentFromSettings({
    settings: runtime.vercelSettingsFromConnection({
      token: "vercel_private_token",
      settings: { projectId: "prj_123", teamId: "team_123", productionDomain: "https://founder.example/path" },
    }),
    deploymentId: "dpl_123",
    request: async (url, init) => {
      assert.equal(url, "https://api.vercel.com/v2/deployments/dpl_123/aliases?teamId=team_123");
      assert.equal(JSON.parse(init.body).alias, "founder.example");
      return jsonResponse(200, { alias: "founder.example" });
    },
    now: 2000,
  });

  assert.equal(result.status, "completed");
  assert.equal(result.safeSummary, "Approved site update published.");
  assert.equal(result.metadata.publishRequiresApproval, false);
});
