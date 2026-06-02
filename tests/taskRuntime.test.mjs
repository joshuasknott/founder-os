import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadRuntimeModule() {
  const sourcePath = resolve(process.cwd(), "convex", "taskRuntime.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputDir = await mkdtemp(join(tmpdir(), "founderos-runtime-"));
  const outputPath = join(outputDir, "taskRuntime.mjs");
  await writeFile(outputPath, compiled.outputText, "utf8");
  return import(pathToFileURL(outputPath).href);
}

const runtime = await loadRuntimeModule();

test("classifies task objectives into structured worker categories", () => {
  assert.deepEqual(
    runtime.classifyTaskObjective({
      title: "Create onboarding checklist",
      objective: "Create a client onboarding checklist",
    }),
    {
      category: "document",
      runKind: "document",
      workerKind: "document",
      outputItemKind: "doc",
      outputDocumentKind: "document",
      requiresReview: false,
      confidence: 0.7,
      signals: ["checklist"],
    },
  );

  const build = runtime.classifyTaskObjective({
    title: "Landing page",
    objective: "Build a landing page preview for the new offer",
  });
  assert.equal(build.runKind, "code_preview");
  assert.equal(build.workerKind, "builder");
  assert.equal(build.outputItemKind, "website");

  const tool = runtime.classifyTaskObjective({
    title: "Internal dashboard",
    objective: "Build an internal tool for weekly sales metrics",
  });
  assert.equal(tool.runKind, "code_preview");
  assert.equal(tool.workerKind, "builder");
  assert.equal(tool.outputItemKind, "internal_tool");
  assert.equal(tool.outputDocumentKind, "internal_tool");

  const generic = runtime.classifyTaskObjective({
    objective: "Think through the next operating cadence",
  });
  assert.equal(generic.runKind, "generic");
  assert.equal(generic.workerKind, "generic");

  const gmail = runtime.classifyTaskObjective({
    objective: "Give me my most important gmails in the last 7 days as a priority list",
  });
  assert.equal(gmail.runKind, "email");
  assert.equal(gmail.workerKind, "communications");
  assert.equal(gmail.category, "communication");

  const memo = runtime.classifyTaskObjective({
    objective: "Write a founder memo for the quarterly review",
  });
  assert.equal(memo.runKind, "document");

  const sop = runtime.classifyTaskObjective({
    objective: "Create an SOP for client onboarding",
  });
  assert.equal(sop.runKind, "document");
});

test("leases only queued or expired work and increments attempts", () => {
  const now = 1000;
  const queued = {
    kind: "document",
    status: "queued",
    title: "Draft memo",
    attemptCount: 0,
    maxAttempts: 3,
  };

  assert.equal(runtime.canLeaseRun(queued, ["document"], now), true);

  const leased = {
    ...queued,
    ...runtime.leaseRunPatch(queued, {
      now,
      leaseId: "lease-1",
      leaseOwner: "worker-1",
      leaseMs: 500,
    }),
  };

  assert.equal(leased.status, "working");
  assert.equal(leased.attemptCount, 1);
  assert.equal(leased.leaseExpiresAt, 1500);
  assert.equal(runtime.canLeaseRun(leased, ["document"], 1200), false);
  assert.equal(runtime.canLeaseRun(leased, ["document"], 1600), true);

  const retryCoolingDown = {
    ...queued,
    nextRetryAt: 2000,
  };
  assert.equal(runtime.canLeaseRun(retryCoolingDown, ["document"], 1500), false);
  assert.equal(runtime.canLeaseRun(retryCoolingDown, ["document"], 2000), true);
});

test("run completion clears locks and records completion time", () => {
  const patch = runtime.finishRunPatch("completed", 2000);

  assert.equal(patch.status, "completed");
  assert.equal(patch.completedAt, 2000);
  assert.equal(patch.leaseId, undefined);
  assert.equal(patch.leaseOwner, undefined);
  assert.equal(patch.leaseExpiresAt, undefined);
});

test("approval requests pause leased work and approval queues the run for resume", () => {
  const requestPatch = runtime.approvalRequestRunPatch(3000);

  assert.equal(requestPatch.status, "waiting_for_approval");
  assert.equal(requestPatch.leaseId, undefined);
  assert.equal(requestPatch.leaseOwner, undefined);
  assert.equal(requestPatch.leaseExpiresAt, undefined);
  assert.equal(requestPatch.updatedAt, 3000);

  const approvedPatch = runtime.approvalDecisionRunPatch("approved", 4000);
  assert.equal(approvedPatch.status, "queued");
  assert.equal(approvedPatch.leaseId, undefined);
  assert.equal(runtime.approvalDecisionTaskStatus("approved"), "queued");

  const deniedPatch = runtime.approvalDecisionRunPatch("denied", 5000);
  assert.equal(deniedPatch.status, "needs_review");
  assert.equal(runtime.approvalDecisionTaskStatus("denied"), "blocked");
});

test("approval decisions append immutable audit events", () => {
  const patch = runtime.approvalDecisionPatch({
    decision: "approved",
    now: 6000,
    actionKind: "send_email",
    auditHistory: [
      {
        event: "requested",
        at: 5000,
        actor: "FounderOS",
        actionKind: "send_email",
        message: "Send the client email",
      },
    ],
  });

  assert.equal(patch.status, "approved");
  assert.equal(patch.decidedAt, 6000);
  assert.equal(patch.principalSignature, "approved:6000");
  assert.equal(patch.auditHistory.length, 2);
  assert.deepEqual(patch.auditHistory[1], {
    event: "approved",
    at: 6000,
    actor: "Founder",
    actionKind: "send_email",
  });
});

test("schedule recurrence advances without exposing cron details", () => {
  const mondayNine = Date.UTC(2026, 4, 25, 9, 0, 0);

  assert.equal(
    runtime.nextScheduledRunAt({
      cadence: "daily",
      currentRunAt: mondayNine,
      now: mondayNine,
    }),
    Date.UTC(2026, 4, 26, 9, 0, 0),
  );

  assert.equal(
    runtime.nextScheduledRunAt({
      cadence: "weekly",
      currentRunAt: mondayNine,
      now: mondayNine,
    }),
    Date.UTC(2026, 5, 1, 9, 0, 0),
  );

  const fridayNine = Date.UTC(2026, 4, 29, 9, 0, 0);
  assert.equal(
    runtime.nextScheduledRunAt({
      cadence: "weekdays",
      currentRunAt: fridayNine,
      now: fridayNine,
    }),
    Date.UTC(2026, 5, 1, 9, 0, 0),
  );

  assert.equal(
    runtime.nextScheduledRunAt({
      cadence: "once",
      currentRunAt: mondayNine,
      now: mondayNine,
    }),
    undefined,
  );

  assert.equal(runtime.scheduleIsDue({ status: "scheduled", nextRunAt: 1000, now: 1000 }), true);
  assert.equal(runtime.scheduleIsDue({ status: "paused", nextRunAt: 1000, now: 2000 }), false);
});

test("approved action fallback keeps external actions unperformed without a connector", () => {
  const result = runtime.approvedActionFallbackResult({
    actionKind: "delete_data",
    actionTitle: "Delete old customer records",
  });

  assert.equal(
    result.summary,
    "Delete data was approved, but no live connection is installed for that action yet. Nothing external was performed.",
  );
  assert.equal(result.content.includes("no data was deleted"), true);
  assert.equal(runtime.labelForSensitiveActionKind("spend_money"), "Spend money");
  assert.equal(runtime.labelForSensitiveActionKind("create_calendar_event"), "Create calendar event");
  assert.equal(runtime.approvalRiskCopy("post_externally").includes("external channel"), true);
  assert.equal(runtime.approvalRiskCopy("create_calendar_event").includes("calendar"), true);
});

test("failures retry until the final allowed attempt and keep messages plain", () => {
  const retry = runtime.failRunState(
    {
      kind: "document",
      status: "working",
      title: "Draft memo",
      attemptCount: 1,
      maxAttempts: 3,
      leaseId: "lease-1",
      leaseExpiresAt: 2000,
    },
    {
      now: 1500,
      failureReason: "CLI command stderr stack trace",
    },
  );

  assert.equal(retry.retryScheduled, true);
  assert.equal(retry.patch.status, "queued");
  assert.equal(retry.updateTone, "progress");
  assert.equal(retry.updateMessage, "I hit a temporary issue and will try again.");
  assert.equal(retry.patch.failureReason.includes("CLI"), false);
  assert.equal(retry.patch.retryDelayMs, 10000);
  assert.equal(retry.patch.nextRetryAt, 11500);

  const finalFailure = runtime.failRunState(
    {
      kind: "document",
      status: "working",
      title: "Draft memo",
      attemptCount: 3,
      maxAttempts: 3,
      leaseId: "lease-1",
      leaseExpiresAt: 2000,
    },
    {
      now: 2500,
      failureReason: "FounderOS could not prepare the document yet.",
    },
  );

  assert.equal(finalFailure.retryScheduled, false);
  assert.equal(finalFailure.patch.status, "failed");
  assert.equal(finalFailure.updateTone, "error");
  assert.equal(finalFailure.patch.failedAt, 2500);
  assert.equal(finalFailure.patch.nextRetryAt, undefined);
});

test("hidden local routing captures capability sensitivity output contract and approval needs", () => {
  const buildRouting = runtime.localRoutingForRun({
    kind: "code_preview",
    title: "Revenue dashboard",
    objective: "Build a private dashboard using revenue and customer data",
  });

  assert.equal(buildRouting.capability, "coding");
  assert.equal(buildRouting.sensitivity, "confidential");
  assert.equal(buildRouting.outputContract, "code_changes");

  const emailRouting = runtime.localRoutingForRun({
    kind: "email",
    title: "Follow up",
    objective: "Send an email to alex@example.com with the proposal",
  });

  assert.equal(emailRouting.capability, "communication");
  assert.equal(emailRouting.sensitivity, "confidential");
  assert.equal(emailRouting.outputContract, "library_item");
  assert.deepEqual(emailRouting.approvalNeeds, ["send_email"]);
});

test("local runner capability matching rejects unsafe or unsupported hidden routes", () => {
  const runner = {
    capabilities: ["coding"],
    outputContracts: ["code_changes"],
    maxSensitivity: "internal",
    approvalCapabilities: ["publish_preview"],
  };

  assert.equal(
    runtime.runnerCanHandleRouting(runner, {
      capability: "coding",
      sensitivity: "internal",
      outputContract: "code_changes",
      approvalNeeds: [],
    }),
    true,
  );
  assert.equal(
    runtime.runnerCanHandleRouting(runner, {
      capability: "document",
      sensitivity: "internal",
      outputContract: "library_item",
      approvalNeeds: [],
    }),
    false,
  );
  assert.equal(
    runtime.runnerCanHandleRouting(runner, {
      capability: "coding",
      sensitivity: "confidential",
      outputContract: "code_changes",
      approvalNeeds: [],
    }),
    false,
  );
  assert.equal(
    runtime.runnerCanHandleRouting(runner, {
      capability: "coding",
      sensitivity: "internal",
      outputContract: "code_changes",
      approvalNeeds: ["send_email"],
    }),
    false,
  );
});

test("hidden run statuses project to the founder-visible status set", () => {
  assert.equal(runtime.founderVisibleStatusForRun("queued"), "queued");
  assert.equal(runtime.founderVisibleStatusForRun("working"), "working");
  assert.equal(runtime.founderVisibleStatusForRun("needs_review"), "needs review");
  assert.equal(runtime.founderVisibleStatusForRun("waiting_for_approval"), "needs approval");
  assert.equal(runtime.founderVisibleStatusForRun("completed"), "done");
  assert.equal(runtime.founderVisibleStatusForRun("failed"), "failed");
  assert.equal(runtime.founderVisibleStatusForRun("stopped"), "failed");
});

test("output model creates Library-ready item and document fields", () => {
  const classification = runtime.classifyTaskObjective({
    objective: "Draft a launch plan",
  });
  const output = runtime.buildRunOutputModel(
    {
      kind: "document",
      title: "Launch plan",
      classification,
    },
    {
      summary: "A launch plan draft is ready.",
      content: "# Launch plan\n\nNext steps.",
    },
  );

  assert.equal(output.itemKind, "doc");
  assert.equal(output.documentKind, "document");
  assert.equal(output.artifactKind, "document");
  assert.equal(output.title, "Launch plan");
  assert.equal(output.content.includes("Next steps."), true);

  const previewOutput = runtime.buildRunOutputModel(
    {
      kind: "code_preview",
      title: "Website preview",
      previewUrl: "http://localhost:3000",
    },
  );

  assert.equal(previewOutput.itemKind, "website");
  assert.equal(previewOutput.documentKind, "website");
  assert.equal(previewOutput.artifactKind, "preview");
});

test("refinement run model turns founder changes into a new queued build step", () => {
  const classification = runtime.classifyTaskObjective({
    title: "Booking tool",
    objective: "Create a booking tool for my business",
  });
  const refinement = runtime.buildRefinementRunModel({
    title: "Booking tool",
    objective: "Create a booking tool for my business",
    refinement: "Make the form shorter and add pricing.",
    classification,
  });

  assert.equal(refinement.title, "Booking tool revision");
  assert.equal(refinement.taskTitle, "Revise Booking tool");
  assert.equal(refinement.runKind, "code_preview");
  assert.equal(refinement.workerKind, "builder");
  assert.equal(refinement.updatedObjective.includes("Founder requested changes"), true);
  assert.equal(refinement.message, "I added those changes and will prepare a new review version.");
});
