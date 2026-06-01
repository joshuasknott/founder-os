const TECHNICAL_DETAIL_PATTERN =
  /\b(api|endpoint|http|oauth|scope|stack|trace|stdout|stderr|payload|json|token|secret|key|credential|response)\b/i;

function compactText(value, maxLength = 220) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function stableHash(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function firstEmail(value) {
  return compactText(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function titleCase(value) {
  const cleaned = compactText(value, 90).replace(/[.!?]+$/, "");
  return cleaned
    ? cleaned[0].toUpperCase() + cleaned.slice(1)
    : "FounderOS follow-up";
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      from: compactText(message.from, 120) || "Recent conversation",
      subject: compactText(message.subject, 140) || "Relevant message",
      snippet: compactText(message.snippet ?? message.body, 260),
      receivedAt: typeof message.receivedAt === "number" ? message.receivedAt : undefined,
    }))
    .filter((message) => message.snippet || message.subject)
    .slice(0, 5);
}

function normalizeAvailability(windows) {
  return (Array.isArray(windows) ? windows : [])
    .map((window) => ({
      label: compactText(window.label, 120),
      start: compactText(window.start, 80),
      end: compactText(window.end, 80),
      note: compactText(window.note, 180),
    }))
    .filter((window) => window.label || window.start || window.note)
    .slice(0, 5);
}

export function safeGoogleWorkspaceError(
  error,
  fallback = "FounderOS could not reach the connected service yet.",
) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const scrubbed = raw
    .replace(/https?:\/\/\S+/gi, "the service")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "private credential")
    .replace(/\b(ya29|sk|pk|rk|ghp)[-._A-Za-z0-9]{8,}\b/gi, "private credential")
    .replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, "private detail")
    .replace(/\{[\s\S]*\}/g, "details")
    .replace(/\s+/g, " ")
    .trim();

  if (!scrubbed || TECHNICAL_DETAIL_PATTERN.test(scrubbed)) return fallback;
  return scrubbed.slice(0, 180);
}

export function importGmailContext(args = {}) {
  const messages = normalizeMessages(args.messages);
  if (messages.length === 0) {
    return {
      source: "gmail",
      status: "empty",
      safeSummary: "No connected email context was available, so the draft uses the task details.",
      messages: [],
    };
  }

  return {
    source: "gmail",
    status: "imported",
    safeSummary: `${messages.length} relevant email ${messages.length === 1 ? "message" : "messages"} imported for context.`,
    messages,
  };
}

export function importGoogleCalendarContext(args = {}) {
  const availability = normalizeAvailability(args.availability);
  if (availability.length === 0) {
    return {
      source: "google_calendar",
      status: "empty",
      safeSummary: "No connected availability was available, so the suggestion uses the task details.",
      availability: [],
    };
  }

  return {
    source: "google_calendar",
    status: "imported",
    safeSummary: `${availability.length} availability ${availability.length === 1 ? "window" : "windows"} imported for context.`,
    availability,
  };
}

export function prepareGmailDraft(run, directive, context = importGmailContext()) {
  const objective = compactText(directive?.objective, 1200);
  const recipient = firstEmail(objective) ?? "recipient to confirm";
  const contextLines = context.messages.length
    ? context.messages.map((message) => `- ${message.from}: ${message.subject} - ${message.snippet}`)
    : ["- No connected email context was available."];
  const subject = `Follow-up: ${titleCase(run?.title ?? directive?.title ?? "FounderOS")}`;
  const body = [
    "Hi,",
    "",
    objective || "Following up as discussed.",
    "",
    "Best,",
  ].join("\n");
  const content = [
    `# ${run?.title ?? "Email draft"}`,
    "",
    "## Draft Email",
    "",
    `To: ${recipient}`,
    `Subject: ${subject}`,
    "",
    body,
    "",
    "## Imported Context",
    context.safeSummary,
    ...contextLines,
    "",
    "## Review Note",
    "This is a draft only. FounderOS must ask before sending anything externally.",
  ].join("\n");

  return {
    kind: "email_draft",
    summary: "An email draft is ready for review. It has not been sent.",
    content,
    draft: {
      to: recipient,
      subject,
      body,
      contextSummary: context.safeSummary,
    },
    context,
  };
}

export function isGmailContextReportRequest(run, directive) {
  const text = compactText(`${run?.title ?? ""} ${directive?.title ?? ""} ${directive?.objective ?? ""}`, 2000)
    .toLowerCase();
  const asksForContext = /\b(list|show|give|summari[sz]e|review|prioriti[sz]e|important|recent|inbox|gmails?|emails?)\b/.test(text);
  const asksForDraft = /\b(draft|write|compose|send|reply|respond|forward|outreach|follow up with|follow-up with)\b/.test(text);
  return asksForContext && !asksForDraft;
}

export function prepareGmailContextReport(run, directive, context = importGmailContext()) {
  const objective = compactText(directive?.objective, 1200);
  const rows = context.messages.length
    ? context.messages.map((message, index) => [
        `${index + 1}. ${message.subject}`,
        `   From: ${message.from}`,
        `   Why it matters: ${message.snippet || "Review this message for priority."}`,
      ].join("\n"))
    : ["No matching Gmail messages were available from the connected account."];
  const content = [
    `# ${run?.title ?? "Gmail priority list"}`,
    "",
    "## Request",
    objective || "Review recent Gmail context.",
    "",
    "## Priority List",
    ...rows,
    "",
    "## Source",
    context.safeSummary,
    "",
    "FounderOS only read connected Gmail context for this result. No email was sent or changed.",
  ].join("\n");

  return {
    kind: "email_context_report",
    summary: context.messages.length
      ? "A Gmail priority list is ready."
      : "No matching Gmail messages were available yet.",
    content,
    context,
  };
}

export function prepareCalendarSuggestion(run, directive, context = importGoogleCalendarContext()) {
  const objective = compactText(directive?.objective, 1200);
  const attendee = firstEmail(objective) ?? "attendee to confirm";
  const firstWindow = context.availability[0];
  const suggestedTime = firstWindow
    ? [firstWindow.label, firstWindow.start, firstWindow.end].filter(Boolean).join(" ")
    : "Time to confirm";
  const availabilityLines = context.availability.length
    ? context.availability.map((window) =>
        `- ${[window.label, window.start, window.end, window.note].filter(Boolean).join(" ")}`,
      )
    : ["- No connected availability was available."];
  const eventTitle = titleCase(run?.title ?? directive?.title ?? "Meeting");
  const content = [
    `# ${run?.title ?? "Scheduling suggestion"}`,
    "",
    "## Scheduling Suggestion",
    "",
    `Event: ${eventTitle}`,
    `When: ${suggestedTime}`,
    `Attendees: ${attendee}`,
    "",
    objective || "Confirm the meeting details before creating the event.",
    "",
    "## Imported Availability",
    context.safeSummary,
    ...availabilityLines,
    "",
    "## Review Note",
    "This is a suggestion only. FounderOS must ask before creating a calendar event or inviting anyone.",
  ].join("\n");

  return {
    kind: "schedule_suggestion",
    summary: "A scheduling suggestion is ready for review. Nothing has been added to a calendar.",
    content,
    event: {
      title: eventTitle,
      when: suggestedTime,
      attendees: [attendee],
      description: objective,
      contextSummary: context.safeSummary,
    },
    context,
  };
}

export function detectCommunicationExternalAction(run, directive) {
  const text = compactText(`${run?.title ?? ""} ${directive?.title ?? ""} ${directive?.objective ?? ""}`, 2000)
    .toLowerCase();

  if (run?.kind === "email") {
    const asksToSend = /\b(send|sent|reply|respond|forward|contact|outreach)\b/.test(text) ||
      /\bfollow up with\b/.test(text) ||
      /\bemail\s+[^.]{1,80}\b/.test(text);
    const draftOnly = /\bdraft\b/.test(text) && !/\b(send|reply|respond|forward|contact|outreach)\b/.test(text);
    if (asksToSend && !draftOnly) {
      return {
        actionKind: "send_email",
        actionTitle: "Send this email",
        actionDescription: "This will send the reviewed email to the recipient.",
        connectorId: "gmail",
        actionType: "send_email",
      };
    }
  }

  if (run?.kind === "schedule") {
    const asksToCreateEvent =
      /\b(schedule|book|create|add|invite|set up)\b/.test(text) &&
      /\b(meeting|calendar|event|invite|call)\b/.test(text);
    const suggestionOnly = /\b(suggest|find|propose|availability|available times?)\b/.test(text) &&
      !/\b(book|create|add|invite|send invite)\b/.test(text);
    if (asksToCreateEvent && !suggestionOnly) {
      return {
        actionKind: "create_calendar_event",
        actionTitle: "Create this calendar event",
        actionDescription: "This will add the reviewed event to the calendar and may invite attendees.",
        connectorId: "google_calendar",
        actionType: "create_calendar_event",
      };
    }
  }

  return null;
}

export function approvalPayloadForCommunication(run, prepared, externalAction) {
  if (!externalAction) return undefined;

  return {
    requestedBy: "communications",
    connectorId: externalAction.connectorId,
    actionType: externalAction.actionType,
    externalActionPerformed: false,
    preparedKind: prepared.kind,
    draft: prepared.draft,
    event: prepared.event,
    contextSummary: prepared.context?.safeSummary,
  };
}

export function historyForApprovedCommunication(run, approvedAction, args = {}) {
  const now = args.now ?? Date.now();
  const payload = approvedAction?.actionPayload ?? {};
  const actionKind = approvedAction?.actionKind;
  const connectorResult = args.connectorResult && typeof args.connectorResult === "object"
    ? args.connectorResult
    : {};

  if (actionKind === "send_email") {
    const draft = payload.draft ?? {};
    const externalId = compactText(connectorResult.externalId, 120) ||
      `email_${stableHash(`${run?._id ?? run?.title}:${draft.to}:${draft.subject}:${now}`)}`;
    const summary = "The approved email was sent.";
    const content = [
      `# ${run?.title ?? "Sent email"}`,
      "",
      "## Sent Email",
      `To: ${compactText(draft.to) || "recipient"}`,
      `Subject: ${compactText(draft.subject) || "Follow-up"}`,
      "Status: Sent after approval",
      "",
      "## Message",
      compactText(draft.body, 2000) || "The approved message was sent.",
      "",
      "## History",
      "FounderOS saved this sent-email record after the approval was handled.",
    ].join("\n");

    return {
      summary,
      content,
      metadata: {
        communicationHistory: {
          type: "email_sent",
          connectorId: payload.connectorId ?? "gmail",
          actionType: payload.actionType ?? "send_email",
          externalId,
          approvalId: approvedAction?.approvalId,
          performedAt: now,
          providerUrl: compactText(connectorResult.providerUrl, 300) || undefined,
        },
      },
    };
  }

  if (actionKind === "create_calendar_event") {
    const event = payload.event ?? {};
    const externalId = compactText(connectorResult.externalId, 120) ||
      `event_${stableHash(`${run?._id ?? run?.title}:${event.title}:${event.when}:${now}`)}`;
    const summary = "The approved calendar event was created.";
    const content = [
      `# ${run?.title ?? "Scheduled event"}`,
      "",
      "## Scheduled Event",
      `Event: ${compactText(event.title) || "Meeting"}`,
      `When: ${compactText(event.when) || "Time confirmed in calendar"}`,
      `Attendees: ${Array.isArray(event.attendees) ? event.attendees.join(", ") : "Attendees confirmed in calendar"}`,
      "Status: Created after approval",
      "",
      "## Notes",
      compactText(event.description, 2000) || "The approved calendar event was created.",
      "",
      "## History",
      "FounderOS saved this scheduled-event record after the approval was handled.",
    ].join("\n");

    return {
      summary,
      content,
      metadata: {
        communicationHistory: {
          type: "calendar_event_created",
          connectorId: payload.connectorId ?? "google_calendar",
          actionType: payload.actionType ?? "create_calendar_event",
          externalId,
          approvalId: approvedAction?.approvalId,
          performedAt: now,
          providerUrl: compactText(connectorResult.providerUrl, 300) || undefined,
        },
      },
    };
  }

  return null;
}

export function approvedCommunicationFailureResult(run, approvedAction, safeMessage) {
  const actionTitle = approvedAction?.actionTitle ?? "Approved communication step";
  const summary = `${actionTitle} was approved, but FounderOS could not finish it. Nothing external was performed.`;
  return {
    summary,
    content: [
      `# ${run?.title ?? actionTitle}`,
      "",
      summary,
      "",
      safeMessage,
      "",
      "No email was sent and no calendar event was created.",
    ].join("\n"),
    metadata: {
      communicationHistory: {
        type: "approved_action_not_performed",
        actionKind: approvedAction?.actionKind,
        approvalId: approvedAction?.approvalId,
        safeMessage,
        performedAt: undefined,
      },
    },
  };
}
