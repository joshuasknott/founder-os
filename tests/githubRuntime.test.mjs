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

test("github issue creation posts through the installation and returns trace metadata", async () => {
  const privateKey = await testPrivateKeyPem();
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input, init });

    if (input.includes("/access_tokens")) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ token: "ghs_installation_token" }),
      };
    }

    if (input.endsWith("/repos/founder/founder-os/issues")) {
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer ghs_installation_token");
      assert.deepEqual(JSON.parse(init.body), {
        title: "Fix onboarding checklist",
        body: "Users need a clearer first run.",
        labels: ["bug", "onboarding"],
        assignees: ["josh"],
      });
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 123456,
          number: 42,
          title: "Fix onboarding checklist",
          html_url: "https://github.com/founder/founder-os/issues/42",
          created_at: "2026-06-02T09:30:00Z",
          updated_at: "2026-06-02T09:30:00Z",
        }),
      };
    }

    throw new Error(`Unexpected request ${input}`);
  };

  const created = await runtime.createGitHubIssue({
    appId: "12345",
    privateKey,
    installationId: "999",
    repositoryOwner: "founder",
    repositoryName: "founder-os",
    issue: {
      title: "Fix onboarding checklist",
      body: "Users need a clearer first run.",
      labels: ["bug", "onboarding"],
      assignees: ["josh"],
    },
    request,
  });

  assert.equal(created.externalId, "founder/founder-os#42");
  assert.equal(created.externalType, "issue");
  assert.equal(created.number, 42);
  assert.equal(created.sourceUrl, "https://github.com/founder/founder-os/issues/42");
  assert.equal(created.providerId, 123456);
  assert.equal(requests.some((entry) => entry.input.includes("/access_tokens")), true);
});

test("github pull request creation posts through the installation and returns trace metadata", async () => {
  const privateKey = await testPrivateKeyPem();
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input, init });

    if (input.includes("/access_tokens")) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ token: "ghs_installation_token" }),
      };
    }

    if (input.endsWith("/repos/founder/founder-os/pulls")) {
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer ghs_installation_token");
      assert.deepEqual(JSON.parse(init.body), {
        title: "Ship onboarding fix",
        head: "codex/onboarding-fix",
        base: "main",
        body: "This updates the first-run checklist.",
        draft: true,
        maintainer_can_modify: false,
      });
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 987654,
          number: 43,
          title: "Ship onboarding fix",
          html_url: "https://github.com/founder/founder-os/pull/43",
          created_at: "2026-06-02T10:30:00Z",
          updated_at: "2026-06-02T10:31:00Z",
          draft: true,
          head: { ref: "codex/onboarding-fix" },
          base: { ref: "main" },
        }),
      };
    }

    throw new Error(`Unexpected request ${input}`);
  };

  const created = await runtime.createGitHubPullRequest({
    appId: "12345",
    privateKey,
    installationId: "999",
    repositoryOwner: "founder",
    repositoryName: "founder-os",
    pullRequest: {
      title: "Ship onboarding fix",
      body: "This updates the first-run checklist.",
      headBranch: "codex/onboarding-fix",
      baseBranch: "main",
      draft: true,
      maintainerCanModify: false,
    },
    request,
  });

  assert.equal(created.externalId, "founder/founder-os#43");
  assert.equal(created.externalType, "pull_request");
  assert.equal(created.number, 43);
  assert.equal(created.sourceUrl, "https://github.com/founder/founder-os/pull/43");
  assert.equal(created.providerId, 987654);
  assert.equal(created.headBranch, "codex/onboarding-fix");
  assert.equal(created.baseBranch, "main");
  assert.equal(created.draft, true);
  assert.equal(requests.some((entry) => entry.input.includes("/access_tokens")), true);
});

test("github pull request creation fails honestly when app config is missing", async () => {
  await assert.rejects(
    () => runtime.createGitHubPullRequest({
      installationId: "999",
      repositoryOwner: "founder",
      repositoryName: "founder-os",
      pullRequest: {
        title: "Ship onboarding fix",
        head: "codex/onboarding-fix",
        base: "main",
      },
      request: async () => {
        throw new Error("should not request GitHub");
      },
    }),
    /GitHub is not configured yet/,
  );
});

test("github pull request creation requires a selected repository", () => {
  assert.throws(
    () => runtime.normalizeGitHubPullRequestRepositorySettings({ installationId: "999", repositoryName: "founder-os" }),
    /Choose the repository/,
  );
});

test("github pull request creation requires head and base branches", () => {
  assert.throws(
    () => runtime.normalizeGitHubPullRequestDraft({ title: "Ship onboarding fix", base: "main" }),
    /branch with your changes/,
  );
  assert.throws(
    () => runtime.normalizeGitHubPullRequestDraft({ title: "Ship onboarding fix", head: "codex/onboarding-fix" }),
    /base branch/,
  );
});

test("github pull request creation reports provider permission failure plainly", async () => {
  const privateKey = await testPrivateKeyPem();
  const request = async (input) => {
    if (input.includes("/access_tokens")) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ token: "ghs_installation_token" }),
      };
    }

    return {
      ok: false,
      status: 403,
      json: async () => ({ message: "Resource not accessible by integration" }),
    };
  };

  await assert.rejects(
    () => runtime.createGitHubPullRequest({
      appId: "12345",
      privateKey,
      installationId: "999",
      repositoryOwner: "founder",
      repositoryName: "founder-os",
      pullRequest: {
        title: "Ship onboarding fix",
        head: "codex/onboarding-fix",
        base: "main",
      },
      request,
    }),
    /GitHub needs permission to create pull requests/,
  );
});

test("github pull request creation blocks invalid input before calling GitHub", async () => {
  let called = false;
  await assert.rejects(
    () => runtime.createGitHubPullRequest({
      appId: "12345",
      privateKey: "not-needed",
      installationId: "999",
      repositoryOwner: "founder",
      repositoryName: "founder-os",
      pullRequest: {
        title: "Ship onboarding fix",
        head: "bad branch name",
        base: "main",
      },
      request: async () => {
        called = true;
        throw new Error("should not request GitHub");
      },
    }),
    /branch with your changes/,
  );
  assert.equal(called, false);
});

test("github issue creation fails honestly when app config is missing", async () => {
  await assert.rejects(
    () => runtime.createGitHubIssue({
      installationId: "999",
      repositoryOwner: "founder",
      repositoryName: "founder-os",
      issue: { title: "Fix onboarding" },
      request: async () => {
        throw new Error("should not request GitHub");
      },
    }),
    /GitHub is not configured yet/,
  );
});

test("github issue creation requires a selected repository", () => {
  assert.throws(
    () => runtime.normalizeGitHubIssueRepositorySettings({ installationId: "999", repositoryName: "founder-os" }),
    /Choose the repository/,
  );
});

test("github issue creation reports provider permission failure plainly", async () => {
  const privateKey = await testPrivateKeyPem();
  const request = async (input) => {
    if (input.includes("/access_tokens")) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ token: "ghs_installation_token" }),
      };
    }

    return {
      ok: false,
      status: 403,
      json: async () => ({ message: "Resource not accessible by integration" }),
    };
  };

  await assert.rejects(
    () => runtime.createGitHubIssue({
      appId: "12345",
      privateKey,
      installationId: "999",
      repositoryOwner: "founder",
      repositoryName: "founder-os",
      issue: { title: "Fix onboarding" },
      request,
    }),
    /GitHub needs permission to create issues/,
  );
});

test("github issue creation blocks invalid issue input before calling GitHub", async () => {
  let called = false;
  await assert.rejects(
    () => runtime.createGitHubIssue({
      appId: "12345",
      privateKey: "not-needed",
      installationId: "999",
      repositoryOwner: "founder",
      repositoryName: "founder-os",
      issue: { title: " " },
      request: async () => {
        called = true;
        throw new Error("should not request GitHub");
      },
    }),
    /Add an issue title/,
  );
  assert.equal(called, false);
});
