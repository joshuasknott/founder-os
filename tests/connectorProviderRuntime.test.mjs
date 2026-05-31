import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadProviderRuntimeModule() {
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-provider-runtime-"));
  for (const name of ["connectorRuntime", "connectorProviderRuntime"]) {
    const sourcePath = resolve(process.cwd(), "convex", `${name}.ts`);
    const source = await readFile(sourcePath, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    await writeFile(join(outputDir, `${name}.mjs`), compiled.outputText.replace("./connectorRuntime", "./connectorRuntime.mjs"), "utf8");
  }
  return import(pathToFileURL(join(outputDir, "connectorProviderRuntime.mjs")).href);
}

const providerRuntime = await loadProviderRuntimeModule();

test("request helper retries transient provider failures", async () => {
  let calls = 0;
  const result = await providerRuntime.requestConnectorJson(
    async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 429, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    "https://example.test/data",
    { method: "GET" },
    { attempts: 2 },
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
});

test("pagination helper collects items and exposes the next cursor", async () => {
  const pages = new Map([
    ["https://example.test/page/1", { results: [1, 2], next: "https://example.test/page/2" }],
    ["https://example.test/page/2", { results: [3], next: undefined }],
  ]);

  const result = await providerRuntime.collectPaginatedConnectorResults({
    firstUrl: "https://example.test/page/1",
    request: async (url) => ({
      ok: true,
      status: 200,
      json: async () => pages.get(url),
    }),
    readItems: (payload) => payload.results,
    readNextUrl: (payload) => payload.next,
  });

  assert.deepEqual(result.items, [1, 2, 3]);
  assert.equal(result.cursor, undefined);
});

test("idempotency and auth helpers produce stable safe request metadata", () => {
  assert.equal(
    providerRuntime.connectorIdempotencyKey(["resend", "workspace", "message"]),
    providerRuntime.connectorIdempotencyKey(["resend", "workspace", "message"]),
  );
  assert.deepEqual(
    providerRuntime.providerAuthHeaders("bearer", " private_key "),
    { Authorization: "Bearer private_key" },
  );
});
