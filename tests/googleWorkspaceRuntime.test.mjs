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

test("gmail send posts a raw approved message and returns provider confirmation", async () => {
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_sent_123", threadId: "thread_123" }),
    };
  };

  const result = await runtime.sendGmailMessage({
    accessToken: "ya29.private-token",
    draft: {
      to: "Alex <alex@example.com>",
      subject: "Follow-up",
      body: "Hi Alex,\n\nFollowing up.",
    },
    request,
  });

  assert.equal(result.externalId, "msg_sent_123");
  assert.equal(result.safeSummary, "The approved email was sent.");
  assert.equal(requests[0].input.includes("/gmail/v1/users/me/messages/send"), true);
  assert.equal(requests[0].init.method, "POST");
  assert.equal(JSON.parse(requests[0].init.body).raw.length > 20, true);
});

test("gmail send refuses incomplete approved drafts", async () => {
  await assert.rejects(
    () => runtime.sendGmailMessage({
      accessToken: "ya29.private-token",
      draft: { to: "", subject: "Missing recipient", body: "Hello" },
      request: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    }),
    /recipient email address/,
  );
});

test("calendar create posts exact approved event details", async () => {
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "event_123", htmlLink: "https://calendar.google.com/event?eid=123" }),
    };
  };

  const result = await runtime.createGoogleCalendarEvent({
    accessToken: "ya29.private-token",
    event: {
      title: "Partner meeting",
      when: "2026-06-02 10:00",
      attendees: ["sam@example.com"],
      description: "Review launch plan.",
    },
    request,
    now: Date.UTC(2026, 5, 1, 9, 0, 0),
  });

  const body = JSON.parse(requests[0].init.body);
  assert.equal(result.externalId, "event_123");
  assert.equal(result.providerUrl, "https://calendar.google.com/event?eid=123");
  assert.equal(body.summary, "Partner meeting");
  assert.equal(body.attendees[0].email, "sam@example.com");
  assert.equal(body.start.dateTime.startsWith("2026-06-02T"), true);
  assert.equal(requests[0].input.includes("/calendar/v3/calendars/primary/events"), true);
});

test("calendar create refuses vague event times", async () => {
  await assert.rejects(
    () => runtime.createGoogleCalendarEvent({
      accessToken: "ya29.private-token",
      event: { title: "Partner meeting", when: "next week sometime" },
      request: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    }),
    /exact date and time/,
  );
});

test("google docs context includes safe document preview text", async () => {
  const requested = [];
  const request = async (input) => {
    requested.push(input);
    if (input.includes("/drive/v3/files")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          files: [{
            id: "doc_123",
            name: "Launch plan",
            mimeType: "application/vnd.google-apps.document",
            modifiedTime: "2026-06-01T09:00:00.000Z",
          }],
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        body: {
          content: [{
            paragraph: {
              elements: [
                { textRun: { content: "Launch priority is activation." } },
                { textRun: { content: "Do not leak ya29.private_secret_token." } },
              ],
            },
          }],
        },
      }),
    };
  };

  const context = await runtime.fetchDriveContext({
    accessToken: "ya29.private-token",
    queryText: "find launch docs",
    connectorId: "google_docs",
    request,
  });

  assert.equal(context.status, "imported");
  assert.equal(context.items[0].detail.includes("Launch priority is activation"), true);
  assert.equal(/ya29|token|secret/i.test(context.items[0].detail), false);
  assert.equal(requested.some((url) => url.includes("/docs/v1/documents/doc_123")), true);
});

test("google sheets context includes safe sheet preview text", async () => {
  const requested = [];
  const request = async (input) => {
    requested.push(input);
    if (input.includes("/drive/v3/files")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          files: [{
            id: "sheet_123",
            name: "Revenue model",
            mimeType: "application/vnd.google-apps.spreadsheet",
            modifiedTime: "2026-06-01T09:00:00.000Z",
          }],
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        sheets: [{
          properties: { title: "Summary" },
          data: [{
            rowData: [
              { values: [{ formattedValue: "MRR" }, { formattedValue: "$12,000" }] },
              { values: [{ formattedValue: "Churn" }, { formattedValue: "2%" }] },
            ],
          }],
        }],
      }),
    };
  };

  const context = await runtime.fetchDriveContext({
    accessToken: "ya29.private-token",
    queryText: "find revenue sheets",
    connectorId: "google_sheets",
    request,
  });

  assert.equal(context.status, "imported");
  assert.equal(context.items[0].detail.includes("Summary"), true);
  assert.equal(context.items[0].detail.includes("MRR | $12,000"), true);
  assert.equal(requested.some((url) => url.includes("/sheets/v4/spreadsheets/sheet_123")), true);
});
