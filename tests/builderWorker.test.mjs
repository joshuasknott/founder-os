import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTaskSpec,
  buildLibraryContent,
  buildResultMetadata,
  captureChangedFiles,
  createBuildWorkspace,
  detectSensitiveExternalAction,
  diffWorkspaceSnapshots,
  extractCodexResult,
  prepareGeneratedApp,
  runBrowserQa,
  runTestCommands,
  snapshotWorkspaceFiles,
  toPlainFounderText,
} from "../workers/builder/index.mjs";

test("plain founder text removes hidden build details", () => {
  const text = toPlainFounderText(
    "opencode and DeepSeek ran CLI commands on branch codex/test and edited C:\\repo\\app\\page.tsx",
  );

  assert.equal(text.includes("Codex"), false);
  assert.equal(text.includes("OpenCode"), false);
  assert.equal(text.includes("DeepSeek"), false);
  assert.equal(text.includes("CLI"), false);
  assert.equal(text.includes("branch"), false);
  assert.equal(text.includes("C:\\repo"), false);
});

test("sensitive publish and deploy requests are approval-gated", () => {
  const publish = detectSensitiveExternalAction("Build the page and publish it when ready");
  assert.equal(publish.actionKind, "publish_preview");
  assert.equal(publish.actionTitle, "Publish this preview");

  const live = detectSensitiveExternalAction("Update the production site with this change");
  assert.equal(live.actionKind, "change_live_asset");

  assert.equal(detectSensitiveExternalAction("Build a private website preview"), null);
  assert.equal(detectSensitiveExternalAction("Build and deploy a preview link for review"), null);
});

test("task spec keeps build connector hidden and structured", () => {
  const spec = buildTaskSpec(
    {
      title: "Metrics tool",
      kind: "code_preview",
      classification: {
        outputItemKind: "tool",
      },
    },
    {
      title: "Metrics tool",
      objective: "Build an internal dashboard preview",
    },
    {
      isolation: "safe_copy",
    },
  );

  assert.equal(spec.task.outputKind, "tool");
  assert.equal(spec.productPlan.steps.some((step) => step.includes("isolated workspace")), true);
  assert.equal(spec.productPlan.publishing.includes("approval"), true);
  assert.equal(spec.workspace.safeWorkingDirectory, true);
  assert.equal(spec.workspace.destructiveWritesOutsideWorkspace, false);
  assert.equal(spec.safety.approvalRequiredBeforeExternalAction, true);
  assert.equal(spec.builder.hiddenFromFounder, true);
});

test("builder library content explains plan, preview, review, and handoff", () => {
  const taskSpec = buildTaskSpec(
    {
      title: "Booking tool",
      kind: "code_preview",
      classification: {
        outputItemKind: "tool",
      },
    },
    {
      title: "Booking tool",
      objective: "Create a booking tool for my business",
    },
    {
      isolation: "safe_copy",
    },
  );
  const content = buildLibraryContent({
    title: "Booking tool",
    summary: "A booking tool is ready to review.",
    taskSpec,
    codexResult: {
      summary: "A booking tool is ready to review.",
      reviewNotes: [],
      externalActionRequested: false,
      publishOrDeployBlocked: false,
    },
    previewStatus: {
      available: true,
      url: "https://preview.example",
    },
    testResults: {
      status: "passed",
      summary: "Checks passed.",
      commands: [],
    },
  });

  assert.equal(content.includes("## Plan"), true);
  assert.equal(content.includes("## Preview"), true);
  assert.equal(content.includes("## Version and handoff"), true);
  assert.equal(content.includes("rollback point"), true);
});

test("workspace snapshots capture added, modified, and deleted files", async () => {
  const root = await mkdtemp(join(tmpdir(), "founderos-builder-test-"));
  try {
    await writeFile(join(root, "first.txt"), "one", "utf8");
    await writeFile(join(root, "delete.txt"), "remove", "utf8");
    const before = await snapshotWorkspaceFiles(root);

    await writeFile(join(root, "first.txt"), "two", "utf8");
    await writeFile(join(root, "added.txt"), "new", "utf8");
    await rm(join(root, "delete.txt"));
    const after = await snapshotWorkspaceFiles(root);
    const diff = diffWorkspaceSnapshots(before, after);

    assert.deepEqual(diff, [
      { path: "added.txt", status: "added" },
      { path: "delete.txt", status: "deleted" },
      { path: "first.txt", status: "modified" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("copy isolation creates a safe build workspace outside the source", async () => {
  const source = await mkdtemp(join(tmpdir(), "founderos-builder-source-"));
  const runsDir = await mkdtemp(join(tmpdir(), "founderos-builder-runs-"));
  try {
    await mkdir(join(source, ".git"));
    await writeFile(join(source, ".git", "HEAD"), "ref: main", "utf8");
    await writeFile(join(source, "package.json"), "{\"scripts\":{\"test\":\"node --version\"}}", "utf8");
    await writeFile(join(source, "app.txt"), "hello", "utf8");

    const workspace = await createBuildWorkspace(
      { _id: "run1", attemptCount: 1 },
      {
        sourceDir: source,
        runsDir,
        mode: "copy",
        slug: "safe-copy",
      },
    );

    assert.equal(workspace.isolation, "safe_copy");
    assert.equal(workspace.workingDirectory.startsWith(runsDir), true);
    assert.equal(await readFile(join(workspace.workingDirectory, "app.txt"), "utf8"), "hello");
    await assert.rejects(readFile(join(workspace.workingDirectory, ".git", "HEAD"), "utf8"));
  } finally {
    await rm(source, { recursive: true, force: true });
    await rm(runsDir, { recursive: true, force: true });
  }
});

test("changed file capture merges safe Codex event paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "founderos-builder-changes-"));
  try {
    await writeFile(join(root, "first.txt"), "one", "utf8");
    const before = await snapshotWorkspaceFiles(root);

    await writeFile(join(root, "first.txt"), "two", "utf8");
    const changes = await captureChangedFiles(root, before, [
      "reported-only.txt",
      "../outside.txt",
    ]);

    assert.deepEqual(changes, [
      { path: "first.txt", status: "modified" },
      { path: "reported-only.txt", status: "modified" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("structured Codex result parsing has safe fallbacks", () => {
  const parsed = extractCodexResult(
    JSON.stringify({
      summary: "Preview is ready.",
      reviewNotes: ["No deployment was performed."],
      externalActionRequested: true,
      publishOrDeployBlocked: true,
    }),
  );

  assert.equal(parsed.summary, "Preview is ready.");
  assert.equal(parsed.reviewNotes[0], "No deployment was performed.");
  assert.equal(parsed.externalActionRequested, true);
  assert.equal(parsed.publishOrDeployBlocked, true);

  const fallback = extractCodexResult("Codex changed app/page.tsx on a branch.");
  assert.equal(fallback.summary.includes("Codex"), false);
  assert.equal(fallback.summary.includes("branch"), false);
});

test("install and check commands record generated app readiness", async () => {
  const root = await mkdtemp(join(tmpdir(), "founderos-builder-ready-"));
  const previousInstall = process.env.BUILDER_INSTALL_COMMANDS;
  const previousTests = process.env.BUILDER_TEST_COMMANDS;
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        scripts: {
          test: "node -e \"process.exit(0)\"",
          lint: "node -e \"process.exit(0)\"",
          build: "node -e \"process.exit(0)\"",
        },
      }),
      "utf8",
    );
    process.env.BUILDER_INSTALL_COMMANDS = "node --version";
    process.env.BUILDER_TEST_COMMANDS = "";

    const setup = await prepareGeneratedApp(root);
    assert.equal(setup.status, "passed");
    assert.equal(setup.commands[0].command, "node --version");

    delete process.env.BUILDER_TEST_COMMANDS;
    const checks = await runTestCommands(root);
    assert.equal(checks.status, "passed");
    assert.deepEqual(checks.commands.map((command) => command.command), [
      "npm test",
      "npm run lint",
      "npm run build",
    ]);
  } finally {
    if (previousInstall === undefined) delete process.env.BUILDER_INSTALL_COMMANDS;
    else process.env.BUILDER_INSTALL_COMMANDS = previousInstall;
    if (previousTests === undefined) delete process.env.BUILDER_TEST_COMMANDS;
    else process.env.BUILDER_TEST_COMMANDS = previousTests;
    await rm(root, { recursive: true, force: true });
  }
});

test("browser QA verifies loaded nonblank visible content", async () => {
  const previousMode = process.env.BUILDER_BROWSER_QA_MODE;
  const previousFetch = global.fetch;
  try {
    process.env.BUILDER_BROWSER_QA_MODE = "http";
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => "<html><body><main><h1>Bakery website</h1><p>Fresh bread daily.</p></main></body></html>",
    });

    const qa = await runBrowserQa("http://localhost:3100");
    assert.equal(qa.status, "passed");
    assert.equal(qa.loaded, true);
    assert.equal(qa.nonblank, true);
    assert.equal(qa.contentVisible, true);
    assert.equal(qa.visibleTextSample.includes("Bakery website"), true);
  } finally {
    if (previousMode === undefined) delete process.env.BUILDER_BROWSER_QA_MODE;
    else process.env.BUILDER_BROWSER_QA_MODE = previousMode;
    global.fetch = previousFetch;
  }
});

test("result metadata records preview QA and deployment approval request", () => {
  const metadata = buildResultMetadata({
    mode: "opencode",
    taskSpec: {
      orchestration: {
        selectedRoute: "zai-coding-plan/glm-5.1",
        outputContract: "code_changes",
      },
      productPlan: {
        outcome: "Create a website.",
      },
    },
    source: { source: "safe_workspace" },
    workspace: {
      isolation: "safe_copy",
      branch: null,
      workingDirectory: "C:/tmp/founderos-run",
    },
    previewStatus: {
      available: true,
      started: true,
      url: "http://localhost:3100",
      provider: "local",
      qa: {
        status: "passed",
        loaded: true,
        nonblank: true,
        contentVisible: true,
      },
      requestedDeployment: {
        provider: "vercel",
        status: "approval_required",
        safeMessage: "Needs approval before anything is published.",
      },
    },
    changedFiles: [{ path: "app/page.tsx", status: "modified" }],
    setupResults: {
      status: "skipped",
      summary: "No install step was needed.",
      commands: [],
    },
    testResults: {
      status: "passed",
      summary: "Checks passed.",
      commands: [],
    },
    codex: {
      adapter: "opencode",
      model: "zai-coding-plan/glm-5.1",
    },
    externalAction: {
      actionKind: "publish_preview",
    },
  });

  assert.equal(metadata.browserQa.status, "passed");
  assert.equal(metadata.requestedDeployment.status, "approval_required");
  assert.equal(metadata.isolation.destructiveWritesOutsideWorkspace, false);
  assert.equal(metadata.safety.publishRequiresApproval, true);
  assert.equal(metadata.safety.externalActionPerformed, false);
});
