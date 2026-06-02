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

test("google drive creates a text file and exports supported content to Library", async () => {
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input, init });

    if (input.includes("/upload/drive/v3/files")) {
      assert.equal(init.method, "POST");
      assert.equal(init.headers.Authorization, "Bearer ya29.private-token");
      assert.equal(init.body.includes("Launch notes"), true);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "file_created_123",
          name: "Launch notes",
          mimeType: "text/plain",
          webViewLink: "https://drive.google.com/file/d/file_created_123/view",
        }),
      };
    }

    if (input.includes("alt=media")) {
      return {
        ok: true,
        status: 200,
        text: async () => "Launch notes\nShip activation first.",
        json: async () => ({}),
      };
    }

    if (input.includes("/drive/v3/files/file_created_123?")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "file_created_123",
          name: "Launch notes",
          mimeType: "text/plain",
          webViewLink: "https://drive.google.com/file/d/file_created_123/view",
        }),
      };
    }

    throw new Error(`Unexpected request ${input}`);
  };

  const created = await runtime.executeGoogleWorkspaceFileAction({
    accessToken: "ya29.private-token",
    connectorId: "google_drive",
    actionType: "write_record",
    payload: {
      title: "Launch notes",
      content: "Ship activation first.",
      mimeType: "text/plain",
    },
    request,
  });

  assert.equal(created.externalId, "file_created_123");
  assert.equal(created.safeSummary, "The approved file was saved to Drive.");

  const exported = await runtime.executeGoogleWorkspaceFileAction({
    accessToken: "ya29.private-token",
    connectorId: "google_drive",
    actionType: "export_content",
    payload: {
      fileId: "file_created_123",
      exportMimeType: "text/plain",
    },
    request,
  });

  assert.equal(exported.metadata.libraryOutput.content.includes("Ship activation first"), true);
  assert.equal(exported.metadata.libraryOutput.format, "plain_text");
  assert.equal(requests.some((entry) => entry.input.includes("/upload/drive/v3/files")), true);
  assert.equal(requests.some((entry) => entry.input.includes("alt=media")), true);
});

test("google docs creates and updates documents through Docs APIs", async () => {
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input, init });

    if (input.endsWith("/docs/v1/documents")) {
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(init.body), { title: "Board memo" });
      return {
        ok: true,
        status: 200,
        json: async () => ({ documentId: "doc_created_123", title: "Board memo" }),
      };
    }

    if (input.includes("doc_created_123:batchUpdate")) {
      assert.equal(JSON.parse(init.body).requests[0].insertText.text.includes("Executive summary"), true);
      return {
        ok: true,
        status: 200,
        json: async () => ({ documentId: "doc_created_123" }),
      };
    }

    if (input.includes("/docs/v1/documents/doc_update_123?")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          documentId: "doc_update_123",
          title: "Existing memo",
          body: { content: [{ endIndex: 42 }] },
        }),
      };
    }

    if (input.includes("doc_update_123:batchUpdate")) {
      const body = JSON.parse(init.body);
      assert.equal(body.requests[0].deleteContentRange.range.startIndex, 1);
      assert.equal(body.requests[1].insertText.text, "Replacement memo");
      return {
        ok: true,
        status: 200,
        json: async () => ({ documentId: "doc_update_123" }),
      };
    }

    throw new Error(`Unexpected request ${input}`);
  };

  const created = await runtime.executeGoogleWorkspaceFileAction({
    accessToken: "ya29.private-token",
    connectorId: "google_docs",
    actionType: "write_record",
    payload: { title: "Board memo", content: "Executive summary" },
    request,
  });
  assert.equal(created.externalId, "doc_created_123");
  assert.equal(created.providerUrl, "https://docs.google.com/document/d/doc_created_123/edit");

  const updated = await runtime.executeGoogleWorkspaceFileAction({
    accessToken: "ya29.private-token",
    connectorId: "google_docs",
    actionType: "update_external_record",
    payload: { documentId: "doc_update_123", content: "Replacement memo", mode: "replace" },
    request,
  });
  assert.equal(updated.safeSummary, "The approved Google document was updated.");
  assert.equal(requests.filter((entry) => entry.input.includes(":batchUpdate")).length, 2);
});

test("google docs exports document text to a Library output", async () => {
  const request = async (input) => {
    if (input.includes("/drive/v3/files/doc_export_123?")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "doc_export_123",
          name: "Launch brief",
          mimeType: "application/vnd.google-apps.document",
          webViewLink: "https://docs.google.com/document/d/doc_export_123/edit",
        }),
      };
    }

    if (input.includes("/drive/v3/files/doc_export_123/export")) {
      assert.equal(input.includes("mimeType=text%2Fplain"), true);
      return {
        ok: true,
        status: 200,
        text: async () => "Launch brief\nActivation remains the priority.",
        json: async () => ({}),
      };
    }

    throw new Error(`Unexpected request ${input}`);
  };

  const exported = await runtime.executeGoogleWorkspaceFileAction({
    accessToken: "ya29.private-token",
    connectorId: "google_docs",
    actionType: "export_content",
    payload: { documentId: "doc_export_123", exportMimeType: "text/plain" },
    request,
  });

  assert.equal(exported.safeSummary, "Launch brief was exported to Library.");
  assert.equal(exported.metadata.libraryOutput.connectorId, "google_docs");
  assert.equal(exported.metadata.libraryOutput.content.includes("Activation remains"), true);
});

test("google sheets creates, updates, and exports spreadsheets through Google APIs", async () => {
  const requests = [];
  const request = async (input, init) => {
    requests.push({ input, init });

    if (input.endsWith("/sheets/v4/spreadsheets")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          spreadsheetId: "sheet_created_123",
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_created_123/edit",
        }),
      };
    }

    if (input.includes("/sheets/v4/spreadsheets/sheet_created_123/values/")) {
      assert.equal(init.method, "PUT");
      assert.deepEqual(JSON.parse(init.body).values[0], ["Metric", "Value"]);
      return {
        ok: true,
        status: 200,
        json: async () => ({ spreadsheetId: "sheet_created_123", updatedRange: "Sheet1!A1:B2" }),
      };
    }

    if (input.includes("/sheets/v4/spreadsheets/sheet_update_123/values/")) {
      assert.equal(init.method, "POST");
      assert.equal(input.includes(":append"), true);
      return {
        ok: true,
        status: 200,
        json: async () => ({ spreadsheetId: "sheet_update_123", tableRange: "Sheet1!A1:B3" }),
      };
    }

    if (input.includes("/drive/v3/files/sheet_update_123?")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "sheet_update_123",
          name: "Revenue model",
          mimeType: "application/vnd.google-apps.spreadsheet",
          webViewLink: "https://docs.google.com/spreadsheets/d/sheet_update_123/edit",
        }),
      };
    }

    if (input.includes("/drive/v3/files/sheet_update_123/export")) {
      assert.equal(input.includes("mimeType=text%2Fcsv"), true);
      return {
        ok: true,
        status: 200,
        text: async () => "Metric,Value\nMRR,12000",
        json: async () => ({}),
      };
    }

    throw new Error(`Unexpected request ${input}`);
  };

  const created = await runtime.executeGoogleWorkspaceFileAction({
    accessToken: "ya29.private-token",
    connectorId: "google_sheets",
    actionType: "write_record",
    payload: {
      title: "Metrics",
      rows: [["Metric", "Value"], ["MRR", 12000]],
    },
    request,
  });
  assert.equal(created.externalId, "sheet_created_123");

  const updated = await runtime.executeGoogleWorkspaceFileAction({
    accessToken: "ya29.private-token",
    connectorId: "google_sheets",
    actionType: "update_external_record",
    payload: {
      spreadsheetId: "sheet_update_123",
      mode: "append",
      values: [["Churn", "2%"]],
    },
    request,
  });
  assert.equal(updated.safeSummary, "The approved Google spreadsheet was updated.");

  const exported = await runtime.executeGoogleWorkspaceFileAction({
    accessToken: "ya29.private-token",
    connectorId: "google_sheets",
    actionType: "export_content",
    payload: { spreadsheetId: "sheet_update_123", exportMimeType: "csv" },
    request,
  });
  assert.equal(exported.metadata.libraryOutput.format, "plain_text");
  assert.equal(exported.metadata.libraryOutput.content.includes("MRR,12000"), true);
});

test("google workspace write actions fail plainly on missing inputs and provider failures", async () => {
  let called = false;
  await assert.rejects(
    () => runtime.executeGoogleWorkspaceFileAction({
      accessToken: "ya29.private-token",
      connectorId: "google_drive",
      actionType: "write_record",
      payload: { title: "Binary", content: "abc", mimeType: "application/pdf" },
      request: async () => {
        called = true;
        throw new Error("should not call Google");
      },
    }),
    /upload text, Markdown, CSV, HTML, and JSON/,
  );
  assert.equal(called, false);

  await assert.rejects(
    () => runtime.executeGoogleWorkspaceFileAction({
      accessToken: "ya29.private-token",
      connectorId: "google_docs",
      actionType: "update_external_record",
      payload: { content: "Missing id" },
      request: async () => {
        throw new Error("should not call Google");
      },
    }),
    /Choose the Google document/,
  );

  await assert.rejects(
    () => runtime.executeGoogleWorkspaceFileAction({
      accessToken: "ya29.private-token",
      connectorId: "google_sheets",
      actionType: "update_external_record",
      payload: { spreadsheetId: "sheet_123", values: [["MRR", 12000]] },
      request: async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: "insufficient_scope" }),
      }),
    }),
    /Google Sheets needs updated access/,
  );
});

test("google workspace unsupported file actions stay blocked instead of reporting success", async () => {
  const result = await runtime.executeGoogleWorkspaceFileAction({
    accessToken: "ya29.private-token",
    connectorId: "google_drive",
    actionType: "delete_external_record",
    payload: { fileId: "file_123" },
    request: async () => {
      throw new Error("should not call Google");
    },
  });

  assert.equal(result, null);

  await assert.rejects(
    () => runtime.executeGoogleWorkspaceFileAction({
      accessToken: "ya29.private-token",
      connectorId: "google_docs",
      actionType: "export_content",
      payload: { documentId: "doc_123", exportMimeType: "application/pdf" },
      request: async () => {
        throw new Error("should not call Google");
      },
    }),
    /export text, CSV, HTML, Markdown, or JSON/,
  );
});
