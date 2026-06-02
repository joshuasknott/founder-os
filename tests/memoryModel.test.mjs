import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadMemoryModelModule() {
  const source = await readFile(resolve(process.cwd(), "convex", "memoryModel.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-memory-model-"));
  const outputPath = join(outputDir, "memoryModel.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const memory = await loadMemoryModelModule();

test("memory extraction recognizes durable founder context types", () => {
  const extracted = memory.extractMemoryCandidates([
    "We prefer short, direct weekly updates.",
    "Decision: we chose annual billing for the new plan.",
    "Every Friday, prepare the customer feedback summary.",
    "Our product is FounderOS for non-technical founders.",
    "Person: Taylor Morgan",
    "Company: Northstar Labs",
    "Product: Launch Console",
    "Remember for future proposals: lead with the private workspace benefit.",
  ].join("\n"));

  const types = new Set(extracted.map((entry) => entry.type));
  assert.deepEqual(types, new Set([
    "founder_preference",
    "decision",
    "recurring_workflow",
    "business_fact",
    "person",
    "company",
    "product",
    "reusable_context",
  ]));
});

test("redaction removes credentials and secret-like values never become memories", () => {
  const redacted = memory.redactSecrets([
    "api_key=sk-test-secret-value",
    "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
    "postgres://founder:supersecret@example.com/app",
  ].join("\n"));

  assert.equal(redacted.redacted, true);
  assert.equal(redacted.text.includes("sk-test-secret-value"), false);
  assert.equal(redacted.text.includes("abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(redacted.text.includes("supersecret"), false);

  const extracted = memory.extractMemoryCandidates([
    "Remember for future: api_key=sk-test-secret-value",
    "Remember for future: use concise customer updates.",
  ].join("\n"));
  assert.deepEqual(extracted.map((entry) => entry.value), [
    "Remember for future: use concise customer updates.",
  ]);
  assert.equal(memory.createMemoryCandidate("reusable_context", "Credential", "token=abcdefghijklmnopqrstuv"), null);
  assert.equal(memory.createMemoryCandidate("reusable_context", "token=abcdefghijklmnopqrstuv", "Use concise updates."), null);
});

test("memory candidates dedupe by normalized type, label, and value", () => {
  const first = memory.createMemoryCandidate("decision", "Decision", "We decided to use annual billing.");
  const second = memory.createMemoryCandidate("decision", "Decision", "  We decided to use annual billing.  ");
  assert.ok(first);
  assert.ok(second);
  assert.deepEqual(memory.dedupeMemoryCandidates([first, second]), [first]);
});

test("manual privacy choices allow shareable details without downgrading restricted details", () => {
  assert.equal(memory.selectedMemorySensitivity("internal", "public"), "public");
  assert.equal(memory.selectedMemorySensitivity("confidential", "public"), "confidential");
  assert.equal(memory.selectedMemorySensitivity("sensitive", "internal"), "sensitive");
});

test("retrieval ranks relevant memories and honors workspace and task switches", () => {
  const memories = [
    {
      ...memory.createMemoryCandidate("founder_preference", "Working preference", "We prefer concise launch updates."),
      _id: "memory:1",
      status: "active",
      updatedAt: 20,
    },
    {
      ...memory.createMemoryCandidate("business_fact", "Business fact", "Our product targets finance teams."),
      _id: "memory:2",
      status: "active",
      updatedAt: 10,
    },
  ];

  const selected = memory.selectRelevantMemories({
    queryText: "Draft a concise launch update",
    purpose: "document",
    requestSensitivity: "internal",
    memories,
  });
  assert.deepEqual(selected.map((entry) => entry._id), ["memory:1"]);

  assert.deepEqual(memory.selectRelevantMemories({
    queryText: "Draft a concise launch update",
    purpose: "document",
    requestSensitivity: "internal",
    memories,
    memoryEnabled: false,
  }), []);
  assert.deepEqual(memory.selectRelevantMemories({
    queryText: "Draft a concise launch update",
    purpose: "builder",
    requestSensitivity: "internal",
    memories,
    useMemory: false,
  }), []);
  assert.deepEqual(memory.selectRelevantMemories({
    queryText: "Draft a concise launch update",
    purpose: "chat",
    requestSensitivity: "internal",
    memories: [{ ...memories[0], sourceAllowed: false }],
  }), []);
});

test("deleted and sensitive memories stay out of automatic retrieval", () => {
  const deleted = {
    ...memory.createMemoryCandidate("decision", "Decision", "We decided to use the launch checklist."),
    status: "deleted",
  };
  const sensitive = {
    ...memory.createMemoryCandidate("business_fact", "Business fact", "The launch bank account uses routing number 123456."),
    status: "active",
  };
  const confidential = {
    ...memory.createMemoryCandidate("business_fact", "Business fact", "Our runway plan covers twelve months."),
    status: "active",
  };

  assert.equal(sensitive.sensitivity, "sensitive");
  assert.equal(confidential.sensitivity, "confidential");
  assert.deepEqual(memory.selectRelevantMemories({
    queryText: "launch checklist bank account runway plan",
    purpose: "chat",
    requestSensitivity: "sensitive",
    memories: [deleted, sensitive, confidential],
  }).map((entry) => entry.value), ["Our runway plan covers twelve months."]);

  assert.deepEqual(memory.selectRelevantMemories({
    queryText: "runway plan",
    purpose: "chat",
    requestSensitivity: "internal",
    memories: [confidential],
  }), []);
});
