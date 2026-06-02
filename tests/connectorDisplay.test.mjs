import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadConnectorDisplayModule() {
  const sourcePath = resolve(process.cwd(), "lib", "connector-display.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-connectors-"));
  const outputPath = join(outputDir, "connector-display.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const display = await loadConnectorDisplayModule();

test("connector display hides generic duplicates when brand-specific services exist", () => {
  const visible = display.visibleConnectorServices([
    { id: "email" },
    { id: "gmail" },
    { id: "calendar" },
    { id: "google_calendar" },
    { id: "code_hosting" },
    { id: "vercel" },
  ]);

  assert.deepEqual(visible.map((service) => service.id), ["gmail", "google_calendar", "vercel"]);
});

test("connector display filters unavailable legacy services", () => {
  const visible = display.visibleConnectorServices([
    { id: "posthog" },
    { id: "resend" },
    { id: "slack" },
    { id: "canva" },
    { id: "notion" },
    { id: "stripe" },
    { id: "github" },
  ]);

  assert.deepEqual(visible.map((service) => service.id), ["github"]);
});

test("connector display groups services by founder-facing area", () => {
  const groups = display.groupedConnectorServices([
    { id: "gmail" },
    { id: "google_calendar" },
    { id: "google_drive" },
    { id: "google_docs" },
    { id: "google_sheets" },
    { id: "opencode" },
    { id: "github" },
    { id: "vercel" },
  ]);

  assert.deepEqual(
    groups.map((group) => [group.title, group.services.map((service) => service.id)]),
    [
      ["Google Workspace", ["gmail", "google_calendar", "google_drive", "google_docs", "google_sheets"]],
      ["opencode", ["opencode", "github"]],
      ["Website previews", ["vercel"]],
    ],
  );
});
