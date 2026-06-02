import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadWorkflowRuntime() {
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-workflow-runtime-"));
  for (const name of ["taskRuntime", "workflowRuntime"]) {
    const source = await readFile(resolve(process.cwd(), "convex", `${name}.ts`), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const output = compiled.outputText.replace(
      'from "./taskRuntime"',
      'from "./taskRuntime.mjs"',
    );
    await writeFile(join(outputDir, `${name}.mjs`), output, "utf8");
  }
  return import(pathToFileURL(join(outputDir, "workflowRuntime.mjs")).href);
}

const runtime = await loadWorkflowRuntime();

const websiteTemplate = {
  name: "Create Website",
  templateKey: "create_website",
  description: "Create a private website preview.",
  workflowKind: "process",
  inputs: [
    { key: "brief", label: "Website brief", type: "text", required: false },
  ],
  outputs: [
    { key: "preview", label: "Website preview", kind: "website" },
  ],
  approvalRules: [
    { actionKind: "publish_preview", policy: "when_external" },
  ],
  taskMatrix: [
    {
      key: "define",
      title: "Define website outcome",
      descriptionTemplate: "Clarify the audience. {{brief}}",
      assignedAgentId: "Orion",
      autonomyLevel: 1,
      dependencies: [],
    },
    {
      key: "create",
      title: "Create website preview",
      descriptionTemplate: "Build a private website preview.",
      assignedAgentId: "Cipher",
      autonomyLevel: 2,
      dependencies: ["define"],
      outputItemKind: "website",
    },
  ],
};

test("starter template creates a durable founder workflow definition", () => {
  const workflow = runtime.workflowFromTemplate(websiteTemplate);

  assert.equal(workflow.title, "Create Website");
  assert.equal(workflow.metadata.templateKey, "create_website");
  assert.deepEqual(workflow.steps.map((step) => step.key), ["define", "create"]);
  assert.deepEqual(workflow.steps[1].config.dependencies, ["define"]);
  assert.equal(workflow.steps[1].outputItemKind, "website");
});

test("scheduled workflow execution plans task and work-run steps with rendered input", () => {
  const workflow = runtime.workflowFromTemplate(websiteTemplate);
  const plan = runtime.buildWorkflowExecutionPlan({
    workflow,
    inputs: { brief: "Launch the analytics product." },
    trigger: "schedule",
  });

  assert.equal(plan.title, "Scheduled: Create Website");
  assert.equal(plan.objective.includes("Launch the analytics product."), true);
  assert.equal(plan.steps.length, 2);
  assert.equal(plan.steps[0].title, "Scheduled: Define website outcome");
  assert.deepEqual(plan.steps[1].dependencyKeys, ["define"]);
  assert.equal(plan.steps[1].classification.runKind, "code_preview");
  assert.equal(plan.steps[1].localRouting.capability, "coding");
});

test("scheduled workflow execution keeps default inputs when no override is supplied", () => {
  const workflow = runtime.workflowFromTemplate({
    ...websiteTemplate,
    inputs: [
      { key: "brief", label: "Website brief", type: "text", required: false, defaultValue: "Use the approved launch brief." },
    ],
  });
  const plan = runtime.buildWorkflowExecutionPlan({ workflow, trigger: "schedule" });

  assert.equal(plan.steps[0].description.includes("Use the approved launch brief."), true);
});

test("workflow approval gates pause only rules that must happen before work starts", () => {
  const workflow = runtime.workflowFromTemplate({
    ...websiteTemplate,
    approvalRules: [
      { actionKind: "publish_preview", policy: "when_external" },
      { actionKind: "spend_money", policy: "always", description: "Approve the budget first." },
    ],
  });
  const plan = runtime.buildWorkflowExecutionPlan({ workflow, trigger: "manual" });

  assert.deepEqual(plan.approvalGates, [
    { actionKind: "spend_money", policy: "always", description: "Approve the budget first." },
  ]);
});

test("workflow dependencies keep later task runs waiting for completed prerequisites", () => {
  const tasks = new Map([
    ["tasks:1", { status: "working" }],
    ["tasks:2", { status: "queued" }],
  ]);
  assert.equal(
    runtime.taskDependenciesAreComplete({ dependencies: ["tasks:1"] }, tasks),
    false,
  );
  tasks.set("tasks:1", { status: "completed" });
  assert.equal(
    runtime.taskDependenciesAreComplete({ dependencies: ["tasks:1"] }, tasks),
    true,
  );
});

test("founder workflow projection shows progress, approval needs, and saved outputs plainly", () => {
  const projection = runtime.projectFounderVisibleWorkflowStatus([
    { status: "completed", outputItemId: "items:1" },
    { status: "waiting_for_approval" },
    { status: "queued" },
  ]);

  assert.equal(projection.status, "needs approval");
  assert.equal(projection.progress.completed, 1);
  assert.equal(projection.progress.savedOutputs, 1);
  assert.equal(projection.progressLabel, "1 of 3 steps done");
});
