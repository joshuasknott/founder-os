import { anyApi, cronJobs } from "convex/server";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// =========================================================================
// SENTINEL'S BACKGROUND PROCESSES (Doc 8 §2, Doc 6 §1)
//
// These are Level 0 Autonomy jobs — fully autonomous, no human approval
// required. They maintain the health and integrity of the backend.
// =========================================================================

// -------------------------------------------------------------------------
// BATCH INDEX: Find all documentVersions without embeddings and schedule
// indexDocument for each one.
// -------------------------------------------------------------------------
export const batchIndexDocuments = internalAction({
  args: {},
  handler: async (ctx) => {
    // Fetch all documentVersions missing embeddings
    const unindexed = await ctx.runQuery(
      internal.crons.getUnindexedVersions,
      {}
    );

    let scheduled = 0;
    for (const versionId of unindexed) {
      await ctx.scheduler.runAfter(scheduled * 200, internal.memory.indexDocument, {
        versionId,
      });
      scheduled++;
    }

    if (scheduled > 0) {
      await ctx.runMutation(internal.telemetry.logEvent, {
        traceId: "system_cron",
        actor: "system: Sentinel",
        eventType: "STATE_TRANSITION" as const,
        rawPayload: {
          action: "batch_index_documents",
          versionsScheduled: scheduled,
          message: "Nightly vector indexing batch scheduled.",
        },
      });
    }
  },
});

// Helper: query to find documentVersions without embeddings
import { internalQuery } from "./_generated/server";

export const getUnindexedVersions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allVersions = await ctx.db.query("documentVersions").collect();
    return allVersions
      .filter((v) => !v.embedding || v.embedding.length === 0)
      .map((v) => v._id);
  },
});

// =========================================================================
// CRON SCHEDULE
// =========================================================================

const crons = cronJobs();
const internalApi = anyApi as unknown as typeof internal;

// Nightly vector indexing of un-embedded documents (every 24h)
crons.interval(
  "batch-index-unvectorized-documents",
  { hours: 24 },
  internal.crons.batchIndexDocuments,
);

// Poll due founder-created schedules and queue the corresponding work.
crons.interval(
  "queue-due-schedules",
  { minutes: 5 },
  internalApi.automations.runDueSchedulesFromCron,
  { limit: 20 },
);

export default crons;
