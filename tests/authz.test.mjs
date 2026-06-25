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

function createMockDb(tables) {
  const rows = new Map(
    Object.entries(tables).map(([tableName, tableRows]) => [
      tableName,
      tableRows.map((row) => ({ ...row })),
    ]),
  );
  const patches = [];
  const inserts = [];

  function tableForId(id) {
    for (const [tableName, tableRows] of rows.entries()) {
      if (tableRows.some((row) => row._id === id)) return tableName;
    }
    return null;
  }

  return {
    patches,
    inserts,
    async get(id) {
      const tableName = tableForId(id);
      return tableName ? rows.get(tableName).find((row) => row._id === id) ?? null : null;
    },
    async patch(id, patch) {
      patches.push({ id, patch });
      const tableName = tableForId(id);
      if (!tableName) return;
      const tableRows = rows.get(tableName);
      const index = tableRows.findIndex((row) => row._id === id);
      tableRows[index] = { ...tableRows[index], ...patch };
    },
    async insert(tableName, value) {
      const id = `${tableName}:${rows.get(tableName).length + 1}`;
      inserts.push({ tableName, value });
      rows.get(tableName).push({ _id: id, ...value });
      return id;
    },
    query(tableName) {
      let selectedRows = rows.get(tableName) ?? [];
      return {
        withIndex(_indexName, selector) {
          const conditions = [];
          selector({
            eq(field, value) {
              conditions.push({ field, value });
              return this;
            },
          });
          selectedRows = selectedRows.filter((row) =>
            conditions.every(({ field, value }) => row[field] === value),
          );
          return this;
        },
        async first() {
          return selectedRows[0] ?? null;
        },
        async take(count) {
          return selectedRows.slice(0, count);
        },
      };
    },
  };
}

test("workspace seeding attaches Clerk identities to existing users by normalized email", async () => {
  const db = createMockDb({
    users: [
      {
        _id: "users:existing",
        externalId: "legacy-auth-user-id",
        workspaceId: "workspaces:existing",
        name: "Ada",
        email: "ada@example.com",
        role: "Owner",
        status: "offline",
        joinedAt: 1,
      },
    ],
    workspaces: [
      {
        _id: "workspaces:existing",
        name: "Acme",
        createdAt: 1,
      },
    ],
  });
  const ctx = {
    db,
    auth: {
      async getUserIdentity() {
        return {
          subject: "user_clerk_123",
          tokenIdentifier: "https://clerk.example|user_clerk_123",
          email: "ADA@EXAMPLE.COM",
          name: "Ada Founder",
          pictureUrl: "https://img.example/avatar.png",
        };
      },
    },
  };

  const result = await authz.ensureUserWorkspace(ctx);

  assert.equal(result.user._id, "users:existing");
  assert.equal(result.workspaceId, "workspaces:existing");
  assert.deepEqual(db.inserts, []);
  assert.deepEqual(db.patches, [
    {
      id: "users:existing",
      patch: {
        externalId: "https://clerk.example|user_clerk_123",
        name: "Ada Founder",
        email: "ada@example.com",
        status: "online",
        avatarUrl: "https://img.example/avatar.png",
      },
    },
  ]);
});
