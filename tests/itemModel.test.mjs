import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadItemModelModule() {
  const sourcePath = resolve(process.cwd(), "convex", "itemModel.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-item-model-"));
  const outputPath = join(outputDir, "itemModel.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

class FakeQuery {
  #rows;
  #filters = [];

  constructor(rows) {
    this.#rows = rows;
  }

  withIndex(_name, build) {
    const constraints = [];
    build({
      eq(field, value) {
        constraints.push([field, value]);
        return this;
      },
    });
    this.#filters.push((row) => constraints.every(([field, value]) => row[field] === value));
    return this;
  }

  async collect() {
    return this.#rows.filter((row) => this.#filters.every((filter) => filter(row)));
  }
}

class FakeDb {
  tables = {
    items: new Map(),
    itemVersions: new Map(),
  };
  counters = {
    items: 0,
    itemVersions: 0,
  };

  async insert(table, value) {
    const id = `${table}:${++this.counters[table]}`;
    this.tables[table].set(id, { ...value, _id: id, _creationTime: value.createdAt ?? Date.now() });
    return id;
  }

  async get(id) {
    const [table] = id.split(":");
    return this.tables[table]?.get(id) ?? null;
  }

  async patch(id, patch) {
    const [table] = id.split(":");
    const current = this.tables[table].get(id);
    this.tables[table].set(id, { ...current, ...patch });
  }

  query(table) {
    return new FakeQuery(Array.from(this.tables[table].values()));
  }
}

const itemModel = await loadItemModelModule();

test("createItemWithVersion creates the item and first current version", async () => {
  const ctx = { db: new FakeDb() };

  const { itemId, versionId } = await itemModel.createItemWithVersion(ctx, {
    title: "Launch memo",
    kind: "doc",
    status: "active",
    source: "user",
    author: "FounderOS",
    summary: "Initial launch memo.",
    content: "# Launch memo\n\nDraft.",
    format: "markdown",
    tags: ["launch"],
    metadata: { searchText: "launch memo draft" },
    createdAt: 1000,
  });

  const item = await ctx.db.get(itemId);
  const version = await ctx.db.get(versionId);

  assert.equal(item.currentVersionId, versionId);
  assert.equal(item.versionCount, 1);
  assert.equal(item.updatedAt, 1000);
  assert.equal(version.itemId, itemId);
  assert.equal(version.versionNumber, 1);
  assert.equal(version.content, "# Launch memo\n\nDraft.");
  assert.deepEqual(version.metadata, { searchText: "launch memo draft" });
});

test("appendItemVersion creates a new current revision without overwriting prior content", async () => {
  const ctx = { db: new FakeDb() };
  const { itemId, versionId: firstVersionId } = await itemModel.createItemWithVersion(ctx, {
    title: "Pricing page",
    kind: "doc",
    status: "active",
    source: "user",
    summary: "Initial pricing copy.",
    content: "First draft.",
    format: "markdown",
    createdAt: 1000,
  });

  const secondVersionId = await itemModel.appendItemVersion(ctx, {
    itemId,
    title: "Pricing page v2",
    summary: "Polished pricing copy.",
    content: "Second draft.",
    format: "markdown",
    createdBy: "FounderOS",
    metadata: {
      actionKind: "polish",
      searchText: "pricing page polished second draft",
    },
    createdAt: 2000,
  });

  const item = await ctx.db.get(itemId);
  const firstVersion = await ctx.db.get(firstVersionId);
  const secondVersion = await ctx.db.get(secondVersionId);

  assert.equal(item.currentVersionId, secondVersionId);
  assert.equal(item.versionCount, 2);
  assert.equal(item.title, "Pricing page v2");
  assert.equal(item.summary, "Polished pricing copy.");
  assert.equal(item.updatedAt, 2000);
  assert.equal(firstVersion.content, "First draft.");
  assert.equal(secondVersion.versionNumber, 2);
  assert.equal(secondVersion.content, "Second draft.");
  assert.deepEqual(secondVersion.metadata, {
    actionKind: "polish",
    searchText: "pricing page polished second draft",
  });
});

test("appendItemVersion rejects archived items", async () => {
  const ctx = { db: new FakeDb() };
  const { itemId } = await itemModel.createItemWithVersion(ctx, {
    title: "Archived memo",
    kind: "doc",
    status: "active",
    source: "user",
    content: "Draft.",
  });
  await ctx.db.patch(itemId, { status: "archived" });

  await assert.rejects(
    itemModel.appendItemVersion(ctx, {
      itemId,
      content: "Should not save.",
    }),
    /Item not found/,
  );
});

test("Library output revisions reuse the latest active item and preserve review status", () => {
  const selected = itemModel.selectReusableTraceItem([
    { _id: "items:1", status: "approved", updatedAt: 1000 },
    { _id: "items:2", status: "archived", updatedAt: 3000 },
    { _id: "items:3", status: "under_review", updatedAt: 2000 },
  ]);

  assert.equal(selected._id, "items:3");
  assert.equal(itemModel.reviewStatusForLibraryOutput({ needsReview: true }), "under_review");
  assert.equal(itemModel.reviewStatusForLibraryOutput({}), "draft");
});
