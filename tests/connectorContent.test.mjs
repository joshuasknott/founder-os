import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadConnectorContentModule() {
  const sourcePath = resolve(process.cwd(), "convex", "connectorContent.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-connector-content-"));
  const outputPath = join(outputDir, "connectorContent.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const content = await loadConnectorContentModule();

test("google drive import becomes version-ready Library metadata", () => {
  const imported = content.buildConnectorImport({
    connectorId: "google_drive",
    connectorName: "Google Drive",
    externalId: "file_123",
    externalType: "document",
    title: "Launch plan",
    content: "# Launch plan\n\nShip onboarding before the beta.",
    sourceUrl: "https://drive.google.com/file/d/file_123/view",
    authorName: "Founder",
    mimeType: "text/markdown",
    importedAt: 1000,
  });

  assert.equal(imported.source, "connector");
  assert.equal(imported.externalId, "google_drive:file_123");
  assert.equal(imported.kind, "doc");
  assert.equal(imported.format, "markdown");
  assert.equal(imported.metadata.connector.connectorId, "google_drive");
  assert.equal(imported.metadata.connector.externalId, "file_123");
  assert.equal(imported.metadata.searchText.includes("ship onboarding"), true);
  assert.equal(JSON.stringify(imported).includes("token"), false);
});

test("slack import stores searchable conversation context without raw API details", () => {
  const imported = content.buildConnectorImport({
    connectorId: "slack",
    connectorName: "Slack",
    externalId: "C123:1717000000.000100",
    externalType: "channel_message",
    sourceName: "#leadership",
    content: "Maya: Customer onboarding is the launch risk.\nAlex: Add a checklist before Friday.",
    tags: ["customer", "Launch"],
    importedAt: 2000,
  });

  assert.equal(imported.kind, "conversation");
  assert.equal(imported.title, "#leadership");
  assert.equal(imported.tags.includes("slack"), true);
  assert.equal(imported.metadata.searchText.includes("customer onboarding"), true);
  assert.equal(/api|oauth|scope|token/i.test(JSON.stringify(imported)), false);
});

test("notion import stores source metadata and summarizes records", () => {
  const imported = content.buildConnectorImport({
    connectorId: "notion",
    connectorName: "Notion",
    externalId: "page_abc",
    externalType: "page",
    title: "Customer research",
    content: "Interview notes show buyers want faster setup. Follow-up is to test pricing language.",
    sourceUrl: "https://notion.so/page_abc",
    importedAt: 3000,
    externalUpdatedAt: 2900,
  });

  assert.equal(imported.kind, "record");
  assert.equal(imported.summary, "Interview notes show buyers want faster setup.");
  assert.equal(imported.metadata.connector.externalUpdatedAt, 2900);
  assert.equal(imported.metadata.searchText.includes("pricing language"), true);
  assert.equal(JSON.stringify(imported).includes("notion.so/page_abc"), true);
});
