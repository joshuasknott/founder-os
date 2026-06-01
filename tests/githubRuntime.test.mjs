import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadGitHubRuntime() {
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-github-runtime-"));
  for (const name of ["connectorRuntime", "connectorProviderRuntime", "githubRuntime"]) {
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
  return import(pathToFileURL(join(outputDir, "githubRuntime.mjs")).href);
}

function pemFromDer(buffer, label) {
  const body = Buffer.from(buffer).toString("base64").match(/.{1,64}/g).join("\n");
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

async function testPrivateKeyPem() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  return pemFromDer(pkcs8, "PRIVATE KEY");
}

const runtime = await loadGitHubRuntime();

test("github repository import reads provider context and returns safe Library content", async () => {
  const privateKey = await testPrivateKeyPem();
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input, init });
    assert.equal(JSON.stringify(init).includes("private key"), false);

    if (input.includes("/access_tokens")) {
      assert.equal(init.method, "POST");
      assert.match(init.headers.Authorization, /^Bearer [^.]+\.[^.]+\.[^.]+$/);
      return {
        ok: true,
        status: 201,
        json: async () => ({ token: "ghs_installation_token" }),
      };
    }

    if (input.endsWith("/repos/founder/founder-os")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          full_name: "founder/founder-os",
          description: "Calm operating system for one founder.",
          html_url: "https://github.com/founder/founder-os",
          default_branch: "main",
          language: "TypeScript",
          visibility: "private",
          topics: ["ai", "operations"],
          pushed_at: "2026-06-01T09:00:00Z",
        }),
      };
    }

    if (input.endsWith("/repos/founder/founder-os/readme")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          encoding: "base64",
          content: Buffer.from("# FounderOS\nDo not leak ghp_private_secret_token_1234567890.").toString("base64"),
        }),
      };
    }

    if (input.includes("/git/trees/main")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tree: [
            { path: "README.md", type: "blob", size: 1200 },
            { path: "convex/connectors.ts", type: "blob", size: 50000 },
            { path: "node_modules/example/index.js", type: "blob", size: 10 },
          ],
        }),
      };
    }

    throw new Error(`Unexpected request ${input}`);
  };

  const imported = await runtime.fetchGitHubRepositoryContext({
    appId: "12345",
    privateKey,
    installationId: "999",
    repositoryOwner: "founder",
    repositoryName: "founder-os",
    request,
  });

  assert.equal(imported.externalId, "founder/founder-os");
  assert.equal(imported.title, "Repository context: founder/founder-os");
  assert.equal(imported.sourceUrl, "https://github.com/founder/founder-os");
  assert.equal(imported.content.includes("convex/connectors.ts"), true);
  assert.equal(imported.content.includes("node_modules"), false);
  assert.equal(/ghp|token|secret/i.test(imported.content), false);
  assert.equal(imported.metadata.defaultBranch, "main");
  assert.equal(requests.some((entry) => entry.input.includes("/access_tokens")), true);
});

test("github repository settings require an installation and chosen repository", () => {
  assert.throws(
    () => runtime.normalizeGitHubRepositorySettings({ installationId: "123", repositoryOwner: "bad owner", repositoryName: "repo" }),
    /Choose the repository/,
  );
  assert.deepEqual(
    runtime.normalizeGitHubRepositorySettings({ installationId: "123", repositoryOwner: "founder", repositoryName: "repo" }),
    { installationId: "123", owner: "founder", name: "repo" },
  );
});
