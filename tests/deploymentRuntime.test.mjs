import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadDeploymentRuntimeModule() {
  const sourcePath = resolve(process.cwd(), "convex", "deploymentRuntime.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-deployments-"));
  const outputPath = join(outputDir, "deploymentRuntime.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const runtime = await loadDeploymentRuntimeModule();

test("deployment history records preview and live events without logs", () => {
  const preview = runtime.appendDeploymentHistory(
    { classification: { outputItemKind: "website" } },
    {
      deployment: {
        provider: "vercel",
        target: "preview",
        status: "ready",
        deploymentId: "dpl_123",
        previewUrl: "https://preview.example",
        safeMessage: "Preview created for review.",
        publishRequiresApproval: true,
        rawResponse: { token: "secret" },
      },
    },
    1000,
  );

  assert.equal(preview.deploymentHistory.length, 1);
  assert.equal(preview.deploymentHistory[0].event, "preview_created");
  assert.equal(preview.deploymentHistory[0].previewUrl, "https://preview.example");
  assert.equal(JSON.stringify(preview.deploymentHistory).includes("rawResponse"), false);
  assert.equal(JSON.stringify(preview.deploymentHistory).includes("secret"), false);

  const live = runtime.appendDeploymentHistory(
    preview,
    {
      deployment: {
        provider: "vercel",
        target: "production",
        status: "live",
        deploymentId: "dpl_123",
        liveUrl: "https://founder.example",
        publishRequiresApproval: false,
      },
    },
    2000,
  );

  assert.equal(live.deploymentHistory.length, 2);
  assert.equal(live.deploymentHistory[1].event, "published_live");
  assert.equal(live.deploymentHistory[1].approvalRequiredForLive, false);
});

test("local preview metadata is not recorded as deployment history", () => {
  const metadata = runtime.appendDeploymentHistory(
    {},
    {
      deployment: {
        provider: "local",
        target: "preview",
        status: "ready",
        previewUrl: "http://localhost:3000",
      },
    },
    1000,
  );

  assert.equal(metadata.deploymentHistory, undefined);
});
