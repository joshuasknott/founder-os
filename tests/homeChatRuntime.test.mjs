import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadHomeChatRuntimeModule() {
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-home-chat-"));
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  };
  const files = [
    "pricing.config",
    "modelOrchestration",
    "taskRuntime",
    "chatRuntime",
  ];

  for (const file of files) {
    const source = await readFile(resolve(process.cwd(), "convex", `${file}.ts`), "utf8");
    let output = ts.transpileModule(source, { compilerOptions }).outputText;
    output = output
      .replace('from "./pricing.config";', 'from "./pricing.config.mjs";')
      .replace('from "./modelOrchestration";', 'from "./modelOrchestration.mjs";')
      .replace('from "./taskRuntime";', 'from "./taskRuntime.mjs";');
    await writeFile(join(outputDir, `${file}.mjs`), output, "utf8");
  }

  return import(pathToFileURL(join(outputDir, "chatRuntime.mjs")).href);
}

const runtime = await loadHomeChatRuntimeModule();

test("normal Home chat routes to hidden business reasoning without creating work", () => {
  const intake = runtime.classifyHomeChatIntake("Help me decide what to focus on this week");

  assert.equal(intake.requiresWork, false);
  assert.equal(intake.localRouting.capability, "business_reasoning");
  assert.equal(intake.localRouting.outputContract, "plain_text");
  assert.equal(intake.routeId, "zai-coding-plan/glm-4.7");
  assert.equal(intake.opencodeModel, "zai-coding-plan/glm-4.7");
  assert.equal(intake.allowFreeRoute, false);
});

test("sensitive Home chat stays on paid subscription routing", () => {
  const intake = runtime.classifyHomeChatIntake(
    "Help me think through our revenue, runway, and customer list before the investor update",
  );

  assert.equal(intake.requiresWork, false);
  assert.equal(intake.sensitivity, "confidential");
  assert.equal(intake.localRouting.sensitivity, "confidential");
  assert.equal(intake.routeId, "zai-coding-plan/glm-4.7");
  assert.equal(intake.opencodeModel.includes("free"), false);
});

test("work-like Home chat creates an attached work classification", () => {
  const intake = runtime.classifyHomeChatIntake("Draft a follow-up email for the customer proposal");

  assert.equal(intake.requiresWork, true);
  assert.equal(intake.taskClassification.runKind, "email");
  assert.equal(intake.taskClassification.workerKind, "communications");
  assert.equal(intake.localRouting.capability, "business_reasoning");
});

test("website Home chat becomes hidden builder work", () => {
  const intake = runtime.classifyHomeChatIntake("Create a website for a neighborhood bakery");

  assert.equal(intake.requiresWork, true);
  assert.equal(intake.taskClassification.runKind, "code_preview");
  assert.equal(intake.taskClassification.workerKind, "builder");
  assert.equal(intake.taskClassification.outputItemKind, "website");
});
