import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadGoogleWorkspaceRuntime() {
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-google-workspace-"));
  for (const name of ["connectorRuntime", "connectorProviderRuntime", "googleWorkspaceRuntime"]) {
    const source = await readFile(resolve(process.cwd(), "convex", `${name}.ts`), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const output = compiled.outputText
      .replace("./connectorRuntime", "./connectorRuntime.mjs")
      .replace("./connectorProviderRuntime", "./connectorProviderRuntime.mjs");
    await writeFile(join(outputDir, `${name}.mjs`), output, "utf8");
  }
  return import(pathToFileURL(join(outputDir, "googleWorkspaceRuntime.mjs")).href);
}

const runtime = await loadGoogleWorkspaceRuntime();

test("gmail search query understands founder wording", () => {
  assert.equal(
    runtime.gmailSearchQuery("Give me my most important gmails in the last 7 days"),
    "newer_than:7d is:important",
  );
  assert.deepEqual(runtime.connectorsForGoogleContext("what is in my inbox?", ["gmail"]), ["gmail"]);
});

test("gmail context fetches metadata without leaking provider details", async () => {
  const requested = [];
  const request = async (input) => {
    requested.push(input);
    if (input.includes("/messages?")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ messages: [{ id: "msg_1" }] }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: "msg_1",
        snippet: "A customer asked about onboarding priority.",
        internalDate: "1700000000000",
        payload: {
          headers: [
            { name: "From", value: "Customer <customer@example.com>" },
            { name: "Subject", value: "Onboarding question" },
          ],
        },
      }),
    };
  };

  const context = await runtime.fetchGmailContext({
    accessToken: "ya29.private-token",
    queryText: "important gmail last 7 days",
    request,
  });

  assert.equal(context.status, "imported");
  assert.equal(context.items[0].title, "Onboarding question");
  assert.equal(/ya29|token|oauth|api/i.test(JSON.stringify(context)), false);
  assert.equal(requested.some((url) => url.includes("newer_than%3A7d")), true);
});
