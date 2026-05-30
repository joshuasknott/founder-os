import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadAuthzModule() {
  const sourcePath = resolve(process.cwd(), "convex", "authz.ts");
  const source = (await readFile(sourcePath, "utf8")).replace(
    'import { ConvexError } from "convex/values";',
    "class ConvexError extends Error {}",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-authz-"));
  const outputPath = join(outputDir, "authz.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const authz = await loadAuthzModule();

test("workspace names are inferred from business domains without heavy setup", () => {
  assert.equal(
    authz.inferWorkspaceName({ email: "founder@acme.ai", name: "Ada Founder" }),
    "Acme",
  );
  assert.equal(
    authz.inferWorkspaceName({ email: "ada@gmail.com", name: "Ada Founder" }),
    "Ada's Workspace",
  );
  assert.equal(authz.inferWorkspaceName({ email: "", name: "" }), "FounderOS");
});

test("worker actions require the exact shared worker token", () => {
  const previous = process.env.FOUNDEROS_WORKER_TOKEN;
  try {
    delete process.env.FOUNDEROS_WORKER_TOKEN;
    assert.equal(authz.isAuthorizedWorkerToken("token"), false);

    process.env.FOUNDEROS_WORKER_TOKEN = "expected-token";
    assert.equal(authz.isAuthorizedWorkerToken(), false);
    assert.equal(authz.isAuthorizedWorkerToken("wrong-token"), false);
    assert.equal(authz.isAuthorizedWorkerToken("expected-token"), true);
  } finally {
    if (previous === undefined) {
      delete process.env.FOUNDEROS_WORKER_TOKEN;
    } else {
      process.env.FOUNDEROS_WORKER_TOKEN = previous;
    }
  }
});
