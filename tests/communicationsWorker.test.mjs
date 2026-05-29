import test from "node:test";
import assert from "node:assert/strict";
import { prepareCommunicationResult } from "../workers/communications/index.mjs";
import {
  historyForApprovedCommunication,
  importGmailContext,
  importGoogleCalendarContext,
  safeGoogleWorkspaceError,
} from "../workers/communications/googleWorkspaceConnector.mjs";

test("communications worker prepares Gmail drafts before approval-gated sending", () => {
  const run = {
    _id: "run_email",
    kind: "email",
    title: "Customer follow up",
    directiveId: "directive_email",
  };
  const directive = {
    title: "Customer follow up",
    objective: "Send a follow up to alex@example.com about the pricing question.",
  };
  const context = importGmailContext({
    messages: [
      {
        from: "Alex",
        subject: "Pricing",
        snippet: "Asked whether annual billing is available.",
      },
    ],
  });

  const prepared = prepareCommunicationResult(run, directive, context);

  assert.equal(prepared.kind, "email_draft");
  assert.equal(prepared.summary, "An email draft is ready for review. It has not been sent.");
  assert.equal(prepared.externalAction.actionKind, "send_email");
  assert.equal(prepared.approvalPayload.connectorId, "gmail");
  assert.equal(prepared.approvalPayload.actionType, "send_email");
  assert.equal(prepared.content.includes("Draft Email"), true);
  assert.equal(prepared.content.includes("alex@example.com"), true);
  assert.equal(/api|oauth|scope|token/i.test(prepared.content), false);
});

test("draft-only email requests do not create send approvals", () => {
  const prepared = prepareCommunicationResult(
    { _id: "run_draft", kind: "email", title: "Investor note", directiveId: "directive_draft" },
    { title: "Investor note", objective: "Draft an email to taylor@example.com with a funding update." },
    importGmailContext(),
  );

  assert.equal(prepared.externalAction, null);
  assert.equal(prepared.approvalPayload, undefined);
});

test("communications worker prepares calendar suggestions before approval-gated event creation", () => {
  const run = {
    _id: "run_calendar",
    kind: "schedule",
    title: "Partner meeting",
    directiveId: "directive_calendar",
  };
  const directive = {
    title: "Partner meeting",
    objective: "Book a meeting with sam@example.com next week to review the launch plan.",
  };
  const context = importGoogleCalendarContext({
    availability: [
      {
        label: "Tuesday morning",
        start: "2026-06-02 10:00",
        end: "2026-06-02 10:30",
      },
    ],
  });

  const prepared = prepareCommunicationResult(run, directive, context);

  assert.equal(prepared.kind, "schedule_suggestion");
  assert.equal(prepared.externalAction.actionKind, "create_calendar_event");
  assert.equal(prepared.approvalPayload.connectorId, "google_calendar");
  assert.equal(prepared.approvalPayload.actionType, "create_calendar_event");
  assert.equal(prepared.content.includes("Scheduling Suggestion"), true);
  assert.equal(prepared.content.includes("Tuesday morning"), true);
  assert.equal(/api|oauth|scope|token/i.test(prepared.content), false);
});

test("approved communications produce Library-safe history metadata", () => {
  const emailHistory = historyForApprovedCommunication(
    { _id: "run_email", title: "Customer follow up" },
    {
      approvalId: "approval_email",
      actionKind: "send_email",
      actionPayload: {
        connectorId: "gmail",
        actionType: "send_email",
        draft: {
          to: "alex@example.com",
          subject: "Follow-up",
          body: "Hi Alex,\n\nFollowing up.",
        },
      },
    },
    { now: 1000 },
  );

  assert.equal(emailHistory.summary, "The approved email was sent.");
  assert.equal(emailHistory.metadata.communicationHistory.type, "email_sent");
  assert.equal(emailHistory.metadata.communicationHistory.connectorId, "gmail");
  assert.equal(emailHistory.content.includes("Status: Sent after approval"), true);

  const eventHistory = historyForApprovedCommunication(
    { _id: "run_calendar", title: "Partner meeting" },
    {
      approvalId: "approval_calendar",
      actionKind: "create_calendar_event",
      actionPayload: {
        connectorId: "google_calendar",
        actionType: "create_calendar_event",
        event: {
          title: "Partner meeting",
          when: "Tuesday morning",
          attendees: ["sam@example.com"],
        },
      },
    },
    { now: 1000 },
  );

  assert.equal(eventHistory.summary, "The approved calendar event was created.");
  assert.equal(eventHistory.metadata.communicationHistory.type, "calendar_event_created");
  assert.equal(eventHistory.content.includes("Status: Created after approval"), true);
});

test("google workspace errors are safe for founder-facing updates", () => {
  const safe = safeGoogleWorkspaceError(
    new Error("HTTP 401 from https://gmail.googleapis.com with Bearer ya29.private_secret stack trace"),
  );

  assert.equal(safe, "FounderOS could not reach the connected service yet.");
  assert.equal(safe.includes("gmail.googleapis"), false);
  assert.equal(safe.includes("ya29"), false);
});
