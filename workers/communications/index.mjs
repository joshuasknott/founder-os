import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import { convexMutation } from "../convexRetry.mjs";
import {
  approvalPayloadForCommunication,
  approvedCommunicationFailureResult,
  detectCommunicationExternalAction,
  historyForApprovedCommunication,
  importGmailContext,
  importGoogleCalendarContext,
  isGmailContextReportRequest,
  prepareCalendarSuggestion,
  prepareGmailContextReport,
  prepareGmailDraft,
  safeGoogleWorkspaceError,
} from "./googleWorkspaceConnector.mjs";

const POLL_INTERVAL_MS = Number(process.env.COMMUNICATIONS_WORKER_POLL_INTERVAL_MS ?? 5000);
const WORKER_ID = process.env.COMMUNICATIONS_WORKER_ID ?? `communications:${process.pid}`;
const LEASE_MS = Number(process.env.COMMUNICATIONS_WORKER_LEASE_MS ?? 10 * 60 * 1000);

function readLocalEnv(name) {
  const filePath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(filePath, "utf8");
    const line = content
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value && !value.startsWith("#") && value.startsWith(`${name}=`));

    if (!line) return undefined;
    return line.slice(name.length + 1).replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

function convexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    readLocalEnv("CONVEX_URL") ||
    readLocalEnv("NEXT_PUBLIC_CONVEX_URL")
  );
}

function workerToken() {
  const token = process.env.FOUNDEROS_WORKER_TOKEN || readLocalEnv("FOUNDEROS_WORKER_TOKEN");
  if (!token) throw new Error("Set FOUNDEROS_WORKER_TOKEN before running the communications worker.");
  return token;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function append(client, runId, message, tone = "progress") {
  await convexMutation(client, api.workRuns.appendUpdate, {
    runId,
    message,
    tone,
    workerToken: workerToken(),
  });
}

function defaultWorkspaceId(run) {
  return run.workspaceId;
}

async function requestConnectorAction(client, workspaceId, args) {
  if (!workspaceId) {
    return {
      allowed: false,
      safeMessage: "FounderOS is still preparing your workspace.",
    };
  }

  return await client.action(api.connectors.executeConnectorAction, {
    workspaceId,
    connectorId: args.connectorId,
    actionType: args.actionType,
    actionPayload: args.actionPayload,
    approvalGranted: args.approvalGranted,
    requestedBy: "FounderOS",
    directiveId: args.directiveId,
    runId: args.runId,
    approvalId: args.approvalId,
    workerToken: workerToken(),
  });
}

async function importContextForRun(client, run, directive, workspaceId) {
  if (run.kind === "email") {
    const reportRequest = isGmailContextReportRequest(run, directive);
    try {
      const context = await client.action(api.connectors.readGoogleWorkspaceContext, {
        workspaceId,
        queryText: `${run.title}\n${directive.objective}`,
        connectorIds: ["gmail"],
        requestedBy: WORKER_ID,
        workerToken: workerToken(),
      });
      const messages = context?.contexts?.gmail?.items?.map((item) => ({
        from: "Gmail",
        subject: item.title,
        snippet: item.detail,
        receivedAt: item.receivedAt,
      })) ?? [];
      if (messages.length > 0) {
        await append(
          client,
          run._id,
          reportRequest
            ? "I checked recent Gmail context for this list."
            : "I checked recent Gmail context for this draft.",
        );
        return importGmailContext({ messages });
      }
    } catch {
      // Fall through to a safe draft based on the task details.
    }

    await append(
      client,
      run._id,
      reportRequest
        ? "I could not use connected email context yet, so I will prepare the list from the task details."
        : "I could not use connected email context yet, so I will draft from the task details.",
      "info",
    );
    return importGmailContext();
  }

  try {
    const context = await client.action(api.connectors.readGoogleWorkspaceContext, {
      workspaceId,
      queryText: `${run.title}\n${directive.objective}`,
      connectorIds: ["google_calendar"],
      requestedBy: WORKER_ID,
      workerToken: workerToken(),
    });
    const availability = context?.contexts?.google_calendar?.items?.map((item) => ({
      label: item.title,
      start: item.detail,
      note: item.href ? `Calendar link: ${item.href}` : undefined,
    })) ?? [];
    if (availability.length > 0) {
      await append(client, run._id, "I checked calendar availability for this suggestion.");
      return importGoogleCalendarContext({ availability });
    }
  } catch {
    // Fall through to a safe suggestion based on the task details.
  }

  await append(client, run._id, "I could not use connected availability yet, so I will prepare the suggestion from the task details.", "info");
  return importGoogleCalendarContext();
}

export function prepareCommunicationResult(run, directive, context) {
  const prepared = run.kind === "email"
    ? isGmailContextReportRequest(run, directive)
      ? prepareGmailContextReport(run, directive, context)
      : prepareGmailDraft(run, directive, context)
    : prepareCalendarSuggestion(run, directive, context);
  const externalAction = detectCommunicationExternalAction(run, directive);

  return {
    ...prepared,
    externalAction,
    approvalPayload: approvalPayloadForCommunication(run, prepared, externalAction),
  };
}

async function createApprovalIfNeeded(client, run, prepared) {
  if (!prepared.externalAction) return null;

  return await convexMutation(client, api.approvals.createForRun, {
    directiveId: run.directiveId,
    runId: run._id,
    actionKind: prepared.externalAction.actionKind,
    actionTitle: prepared.externalAction.actionTitle,
    actionDescription: prepared.externalAction.actionDescription,
    actionPayload: prepared.approvalPayload,
    workerToken: workerToken(),
  });
}

async function finishApprovedCommunication(client, run, approvedAction) {
  const workspaceId = defaultWorkspaceId(run);
  const payload = approvedAction.actionPayload ?? {};
  const connectorId = payload.connectorId ??
    (approvedAction.actionKind === "create_calendar_event" ? "google_calendar" : "gmail");
  const actionType = payload.actionType ??
    (approvedAction.actionKind === "create_calendar_event" ? "create_calendar_event" : "send_email");

  let actionResult;
  try {
    actionResult = await requestConnectorAction(client, workspaceId, {
      connectorId,
      actionType,
      actionPayload: payload,
      approvalGranted: true,
      directiveId: run.directiveId,
      runId: run._id,
      approvalId: approvedAction.approvalId,
    });
  } catch (error) {
    actionResult = {
      allowed: false,
      safeMessage: safeGoogleWorkspaceError(error, "The approved step could not finish. Nothing external was performed."),
    };
  }

  if (!actionResult.allowed) {
    const failure = approvedCommunicationFailureResult(run, approvedAction, actionResult.safeMessage);
    await convexMutation(client, api.approvals.markApprovedActionHandled, {
      approvalId: approvedAction.approvalId,
      workerToken: workerToken(),
    });
    await convexMutation(client, api.workRuns.markNeedsReviewWithResult, {
      runId: run._id,
      leaseId: run.leaseId,
      summary: failure.summary,
      content: failure.content,
      internalNotes: JSON.stringify({
        mode: "communications_worker",
        requestedExternalAction: approvedAction,
        externalActionPerformed: false,
        safeMessage: actionResult.safeMessage,
      }),
      metadata: failure.metadata,
      message: failure.summary,
      workerToken: workerToken(),
    });
    return true;
  }

  const history = historyForApprovedCommunication(run, approvedAction, {
    connectorResult: actionResult,
  });
  if (!history) return false;

  const metadata = {
    mode: "communications_worker",
    requestedExternalAction: approvedAction,
    externalActionPerformed: true,
    connectorResult: {
      safeMessage: actionResult.safeMessage,
    },
    ...history.metadata,
  };

  await convexMutation(client, api.approvals.markApprovedActionHandled, {
    approvalId: approvedAction.approvalId,
    workerToken: workerToken(),
  });
  await convexMutation(client, api.workRuns.completeWithResult, {
    runId: run._id,
    leaseId: run.leaseId,
    summary: history.summary,
    content: history.content,
    internalNotes: JSON.stringify(metadata),
    metadata,
    workerToken: workerToken(),
  });
  return true;
}

async function processRun(client, run) {
  console.log(`Starting hidden communications run: ${run._id}`);
  const approvedAction = await client.query(api.approvals.getApprovedActionForRun, {
    runId: run._id,
    workerToken: workerToken(),
  });
  if (approvedAction) {
    await append(client, run._id, "I'm resuming the approved step.");
    await sleep(400);
    if (await finishApprovedCommunication(client, run, approvedAction)) {
      console.log(`Hidden communications run completed approved action: ${run._id}`);
      return;
    }

    await convexMutation(client, api.approvals.resumeApprovedActionWithoutConnector, {
      approvalId: approvedAction.approvalId,
      runId: run._id,
      leaseId: run.leaseId,
      workerToken: workerToken(),
    });
    console.log(`Hidden communications run returned approved action to review: ${run._id}`);
    return;
  }

  await append(
    client,
    run._id,
    run.kind === "email" ? "I'm preparing the draft." : "I'm preparing the scheduling suggestion.",
  );

  const directive = await client.query(api.directives.getDirectiveById, {
    directiveId: run.directiveId,
    workerToken: workerToken(),
  });
  if (!directive) throw new Error("Task not found.");

  await sleep(400);
  await append(client, run._id, "I'm importing the relevant context I can use.");
  const workspaceId = defaultWorkspaceId(run);
  const context = await importContextForRun(client, run, directive, workspaceId);

  await sleep(400);
  await append(client, run._id, "I'm getting this ready for review.");

  const result = prepareCommunicationResult(run, directive, context);

  await sleep(400);
  await convexMutation(client, api.workRuns.markNeedsReviewWithResult, {
    runId: run._id,
    leaseId: run.leaseId,
    summary: result.summary,
    content: result.content,
    internalNotes: JSON.stringify({
      mode: "communications_worker",
      action: result.kind,
      externalActionRequiresApproval: Boolean(result.externalAction),
      requestedExternalAction: result.externalAction,
      externalActionPerformed: false,
    }),
    metadata: {
      communication: {
        preparedKind: result.kind,
        externalActionRequiresApproval: Boolean(result.externalAction),
        contextSummary: result.context?.safeSummary,
      },
    },
    message: "This is ready for your review.",
    workerToken: workerToken(),
  });

  if (result.externalAction) {
    try {
      await createApprovalIfNeeded(client, run, result);
      await append(client, run._id, `Waiting for approval: ${result.externalAction.actionTitle}`, "blocked");
    } catch (error) {
      const message = safeGoogleWorkspaceError(
        error,
        "The draft is ready. Approval is still needed before anything external happens.",
      );
      await append(client, run._id, message, "blocked");
    }
  }

  console.log(`Hidden communications run ready for review: ${run._id}`);
}

async function tick(client) {
  const run = await convexMutation(client, api.workRuns.leaseNext, {
    kinds: ["email", "schedule"],
    workerId: WORKER_ID,
    leaseMs: LEASE_MS,
    workerToken: workerToken(),
  });
  if (!run) return false;

  try {
    await processRun(client, run);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Hidden communications run failed: ${message}`);
    await convexMutation(client, api.workRuns.markFailed, {
      runId: run._id,
      leaseId: run.leaseId,
      failureReason: "FounderOS could not prepare this for review yet.",
      internalError: message,
      workerToken: workerToken(),
    });
  }

  return true;
}

async function main() {
  const url = convexUrl();
  if (!url) {
    throw new Error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL before running the communications worker.");
  }

  const client = new ConvexHttpClient(url);
  const once = process.argv.includes("--once");

  do {
    const handled = await tick(client);
    if (once) break;
    if (!handled) await sleep(POLL_INTERVAL_MS);
  } while (true);
}

const directRunPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (import.meta.url === directRunPath) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export {
  createApprovalIfNeeded,
  finishApprovedCommunication,
  importContextForRun,
  processRun,
};
