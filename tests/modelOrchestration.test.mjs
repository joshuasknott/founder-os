import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadModelOrchestrationModule() {
  const source = await readFile(resolve(process.cwd(), "convex", "modelOrchestration.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-model-orchestration-"));
  const outputPath = join(outputDir, "modelOrchestration.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const routing = await loadModelOrchestrationModule();

test("routes routine classification and business work to different GLM routes", () => {
  const classification = routing.selectModelRoute({
    capability: "classification",
    outputContract: "structured_json",
    sensitivity: "internal",
  });
  assert.equal(classification.selectedRouteId, "zai-coding-plan/glm-4.5-air");
  assert.equal(classification.privacy.allowed, true);

  const business = routing.selectModelRoute({
    capability: "business_reasoning",
    outputContract: "plain_text",
    sensitivity: "confidential",
  });
  assert.equal(business.selectedRouteId, "zai-coding-plan/glm-4.7");
  assert.equal(business.fallbackRouteIds.includes("zai-coding-plan/glm-5-turbo"), true);
});

test("routes planning, finance, and coding to stronger non-free routes", () => {
  const finance = routing.selectModelRoute({
    capability: "finance",
    outputContract: "structured_json",
    sensitivity: "confidential",
    highStakes: true,
  });
  assert.equal(finance.selectedRouteId, "zai-coding-plan/glm-5-turbo");
  assert.equal(finance.verifier.required, true);
  assert.equal(finance.verifier.routeId, "zai-coding-plan/glm-4.7");

  const coding = routing.selectModelRoute({
    capability: "coding",
    outputContract: "code_changes",
    sensitivity: "internal",
    requiresReview: true,
  });
  assert.equal(coding.selectedRouteId, "zai-coding-plan/glm-5.1");
  assert.equal(coding.verifier.routeId, "zai-coding-plan/glm-5-turbo");
});

test("free opencode routes are limited to redacted public drafts and require GLM verification", () => {
  const blocked = routing.selectModelRoute({
    capability: "public_draft",
    outputContract: "public_draft",
    sensitivity: "confidential",
    allowFreeDraftRoute: true,
  });
  assert.equal(blocked.selectedRouteId, "zai-coding-plan/glm-4.7");
  assert.equal(blocked.blockedRouteId, "opencode/deepseek-v4-flash-free");
  assert.equal(blocked.privacy.allowed, true);
  assert.match(blocked.privacy.blockedReason, /public or low-sensitive/);

  const allowed = routing.selectModelRoute({
    capability: "public_draft",
    outputContract: "public_draft",
    sensitivity: "low",
    redacted: true,
    allowFreeDraftRoute: true,
  });
  assert.equal(allowed.selectedRouteId, "opencode/deepseek-v4-flash-free");
  assert.equal(allowed.verifier.required, true);
  assert.equal(allowed.verifier.routeId, "zai-coding-plan/glm-4.7");
});

test("gemini vision route is blocked unless the image context is redacted and low-sensitive", () => {
  const blocked = routing.selectModelRoute({
    capability: "vision",
    outputContract: "vision_summary",
    sensitivity: "internal",
    redacted: false,
  });
  assert.equal(blocked.selectedRouteId, "zai-coding-plan/glm-4.7");
  assert.equal(blocked.blockedRouteId, "gemini/gemini-3-flash-free");

  const allowed = routing.selectModelRoute({
    capability: "vision",
    outputContract: "vision_summary",
    sensitivity: "low",
    redacted: true,
  });
  assert.equal(allowed.selectedRouteId, "gemini/gemini-3-flash-free");
  assert.equal(allowed.verifier.routeId, "zai-coding-plan/glm-4.7");
});

test("sensitivity inference and redaction catch credentials and personal details", () => {
  assert.equal(routing.inferSensitivityFromText("Use api_key sk-live-secret-value"), "restricted");
  assert.equal(routing.inferSensitivityFromText("Email josh@example.com about payroll"), "confidential");
  assert.equal(routing.inferSensitivityFromText("Redacted public draft for a blog post"), "low");

  const redacted = routing.redactForExternalModelRoute("Email josh@example.com and use Bearer abc.def.ghi");
  assert.equal(redacted.includes("josh@example.com"), false);
  assert.equal(redacted.includes("abc.def.ghi"), false);
});
