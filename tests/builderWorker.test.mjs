import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTaskSpec,
  captureChangedFiles,
  createBuildWorkspace,
  detectSensitiveExternalAction,
  diffWorkspaceSnapshots,
  extractCodexResult,
  snapshotWorkspaceFiles,
  toPlainFounderText,
} from "../workers/builder/index.mjs";

test("plain founder text removes hidden build details", () => {
  const text = toPlainFounderText(
    "Codex ran CLI commands on branch codex/test and edited C:\\repo\\app\\page.tsx",
  );

  assert.equal(text.includes("Codex"), false);
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
  assert.equal(spec.workspace.safeWorkingDirectory, true);
  assert.equal(spec.safety.approvalRequiredBeforeExternalAction, true);
  assert.equal(JSON.stringify(spec).includes("Codex"), false);
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
