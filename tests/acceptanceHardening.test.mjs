import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadAcceptanceModules() {
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-acceptance-"));
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  };
  const files = [
    "pricing.config",
    "modelOrchestration",
    "taskRuntime",
    "chatRuntime",
    "workflowRuntime",
    "documentContextRuntime",
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

  return {
    chat: await import(pathToFileURL(join(outputDir, "chatRuntime.mjs")).href),
    model: await import(pathToFileURL(join(outputDir, "modelOrchestration.mjs")).href),
    task: await import(pathToFileURL(join(outputDir, "taskRuntime.mjs")).href),
    workflow: await import(pathToFileURL(join(outputDir, "workflowRuntime.mjs")).href),
    documentContext: await import(pathToFileURL(join(outputDir, "documentContextRuntime.mjs")).href),
  };
}

const runtime = await loadAcceptanceModules();

test("FounderOS acceptance journeys stay founder-facing and save openable outputs", () => {
  const chat = runtime.chat.classifyHomeChatIntake("Help me decide what to focus on this week");
  assert.equal(chat.requiresWork, false);
  assert.equal(chat.routeId, "zai-coding-plan/glm-4.7");
  assert.equal(chat.allowFreeRoute, false);

  const website = runtime.chat.classifyHomeChatIntake("Create a website for a neighborhood bakery");
  assert.equal(website.requiresWork, true);
  assert.equal(website.taskClassification.workerKind, "builder");
  assert.equal(website.taskClassification.runKind, "code_preview");
  const websiteOutput = runtime.task.buildRunOutputModel(
    {
      kind: "code_preview",
      title: "Bakery website",
      classification: website.taskClassification,
    },
    {
      summary: "A private website preview is ready to review.",
      content: "# Bakery website\n\nPreview is ready.",
      previewUrl: "http://localhost:3100",
    },
  );
  assert.equal(websiteOutput.itemKind, "website");
  assert.equal(websiteOutput.documentKind, "website");
  assert.equal(websiteOutput.previewUrl, "http://localhost:3100");

  const document = runtime.chat.classifyHomeChatIntake("Create a document for the launch plan");
  assert.equal(document.requiresWork, true);
  assert.equal(document.taskClassification.workerKind, "document");
  const documentOutput = runtime.task.buildRunOutputModel(
    {
      kind: "document",
      title: "Launch plan",
      classification: document.taskClassification,
    },
    {
      summary: "A launch plan draft is saved.",
      content: "# Launch plan\n\n## Goals\nShip the launch.",
    },
  );
  assert.equal(documentOutput.itemKind, "doc");
  assert.equal(documentOutput.documentKind, "document");
  assert.match(documentOutput.content, /^# Launch plan/);

  const workProjection = runtime.workflow.projectFounderVisibleWorkflowStatus([
    { status: "completed", outputItemId: "items:1" },
    { status: "needs_review", outputItemId: "items:2" },
    { status: "waiting_for_approval" },
  ]);
  assert.equal(workProjection.status, "needs approval");
  assert.equal(workProjection.progressLabel, "1 of 3 steps done");
  assert.equal(workProjection.progress.savedOutputs, 2);
});

test("schedules create workflow runs and Library context only uses safe memory", () => {
  const workflow = runtime.workflow.workflowFromTemplate({
    name: "Weekly launch review",
    templateKey: "weekly_launch_review",
    description: "Prepare a weekly launch review.",
    workflowKind: "process",
    inputs: [
      { key: "brief", label: "Brief", type: "text", required: false, defaultValue: "Write a launch plan review." },
    ],
    outputs: [
      { key: "result", label: "Saved result", kind: "task_output" },
    ],
    approvalRules: [],
    taskMatrix: [
      {
        key: "review",
        title: "Prepare launch review",
        descriptionTemplate: "{{brief}}",
        assignedAgentId: "Orion",
        autonomyLevel: 1,
        dependencies: [],
        outputItemKind: "plan",
      },
    ],
  });
  const plan = runtime.workflow.buildWorkflowExecutionPlan({ workflow, trigger: "schedule" });
  assert.equal(plan.title, "Scheduled: Weekly launch review");
  assert.equal(plan.steps[0].title, "Scheduled: Prepare launch review");
  assert.equal(plan.steps[0].classification.workerKind, "document");

  const context = runtime.documentContext.selectDocumentContextCandidates({
    queryText: "launch review",
    requestSensitivity: "internal",
    candidates: [
      { id: "approved", title: "Launch notes", content: "Launch review notes", status: "approved" },
      { id: "private", title: "Private notes", content: "Launch review", status: "approved", metadata: { private: true } },
      { id: "secret", title: "Secret", content: "api_key sk-test-secret launch", status: "approved" },
      { id: "draft", title: "Draft", content: "Launch review draft", status: "draft" },
    ],
  });
  assert.deepEqual(context.map((item) => item.id), ["approved"]);
});

test("risky model routes are not normal-path defaults", () => {
  const freeBlocked = runtime.model.selectModelRoute({
    capability: "public_draft",
    outputContract: "public_draft",
    sensitivity: "internal",
    redacted: true,
    allowFreeDraftRoute: true,
  });
  assert.equal(freeBlocked.selectedRouteId, "zai-coding-plan/glm-4.7");
  assert.equal(freeBlocked.blockedRouteId, "opencode/deepseek-v4-flash-free");

  const freeAllowed = runtime.model.selectModelRoute({
    capability: "public_draft",
    outputContract: "public_draft",
    sensitivity: "low",
    redacted: true,
    allowFreeDraftRoute: true,
  });
  assert.equal(freeAllowed.selectedRouteId, "opencode/deepseek-v4-flash-free");
  assert.equal(freeAllowed.verifier.routeId, "zai-coding-plan/glm-4.7");

  const visionBlocked = runtime.model.selectModelRoute({
    capability: "vision",
    outputContract: "vision_summary",
    sensitivity: "confidential",
    redacted: true,
  });
  assert.equal(visionBlocked.selectedRouteId, "zai-coding-plan/glm-4.7");
  assert.equal(visionBlocked.blockedRouteId, "gemini/gemini-3-flash-free");

  const visionAllowed = runtime.model.selectModelRoute({
    capability: "vision",
    outputContract: "vision_summary",
    sensitivity: "low",
    redacted: true,
  });
  assert.equal(visionAllowed.selectedRouteId, "gemini/gemini-3-flash-free");
  assert.equal(visionAllowed.verifier.routeId, "zai-coding-plan/glm-4.7");

  const routine = runtime.model.selectModelRoute({
    capability: "business_reasoning",
    outputContract: "plain_text",
    sensitivity: "confidential",
  });
  assert.equal(routine.selectedRouteId, "zai-coding-plan/glm-4.7");
  assert.equal(routine.fallbackRouteIds.includes("deepseek/deepseek-v4-pro"), false);

  const escalationReview = runtime.model.selectModelRoute({
    capability: "strategy",
    outputContract: "structured_json",
    sensitivity: "confidential",
    highStakes: true,
  });
  assert.equal(escalationReview.selectedRouteId, "zai-coding-plan/glm-5-turbo");
  assert.equal(escalationReview.fallbackRouteIds.includes("deepseek/deepseek-v4-pro"), true);
});
