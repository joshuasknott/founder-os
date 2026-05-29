import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// =========================================================================
// EMBEDDING GENERATION
// =========================================================================

export const indexDocument = internalAction({
  args: { versionId: v.id("documentVersions") },
  handler: async (ctx, args) => {
    const version = await ctx.runQuery(internal.memory.getVersion, { id: args.versionId });
    if (!version || version.embedding) return;

    const { executeEmbeddingWithUsage } = await import("./ai");
    const { embedding, usage } = await executeEmbeddingWithUsage(version.content);

    await ctx.runMutation(internal.memory.saveEmbedding, {
      versionId: args.versionId,
      embedding,
    });

    const doc = await ctx.runQuery(internal.memory.getDocument, { id: version.documentId });
    if (doc) {
      await ctx.runMutation(internal.telemetry.logEvent, {
        traceId: doc.traceId ?? "system_index",
        actor: "system: Sentinel",
        eventType: "STATE_TRANSITION",
        rawPayload: {
          action: "vector_indexed",
          documentId: doc._id,
          versionId: args.versionId,
        },
        metrics: {
          latencyMs: usage.latencyMs,
          tokensUsed: usage.tokensUsed,
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costUSD: usage.costUSD,
          useCase: usage.useCase,
        },
      });
    }
  },
});

// =========================================================================
// SOVEREIGN KNOWLEDGE VAULT (RAG)
// =========================================================================

export const queryMemory = internalAction({
  args: {
    queryText: v.string(),
    departmentTag: v.optional(v.id("departments")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;

    const { executeEmbeddingWithUsage } = await import("./ai");
    const { embedding: queryEmbedding } = await executeEmbeddingWithUsage(args.queryText, {
      onUsage: async (metrics) => {
        await ctx.runMutation(internal.telemetry.logEvent, {
          traceId: "memory_query",
          actor: "system: Sentinel",
          eventType: "AI_REQUEST",
          rawPayload: {
            useCase: metrics.useCase,
            action: "query_memory",
          },
          metrics: {
            latencyMs: metrics.latencyMs,
            tokensUsed: metrics.tokensUsed,
            model: metrics.model,
            inputTokens: metrics.inputTokens,
            outputTokens: metrics.outputTokens,
            costUSD: metrics.costUSD,
            useCase: metrics.useCase,
          },
        });
      },
    });

    const rawResults = await ctx.vectorSearch("documentVersions", "by_embedding", {
      vector: queryEmbedding,
      limit: limit * 4,
    });

    const versionIds = rawResults.map((hit) => hit._id);
    const hydratedVersions = await ctx.runQuery(internal.memory.getVersions, { ids: versionIds });

    type VersionRow = NonNullable<(typeof hydratedVersions)[number]>;
    type ScoredVersion = VersionRow & { _score: number };
    const scoredVersions: ScoredVersion[] = hydratedVersions
      .map((ver: VersionRow | null, i: number) => (ver ? { ...ver, _score: rawResults[i]._score } : null))
      .filter((entry: ScoredVersion | null): entry is ScoredVersion => entry !== null);

    const filteredResults: Array<{ title: string; content: string; score: number }> = [];
    const seenDocumentIds = new Set<string>();

    for (const ver of scoredVersions) {
      // Fetch the active document precisely via native filters to ignore archived documents completely
      const doc = await ctx.runQuery(internal.memory.getActiveDocument, { id: ver.documentId });
      if (!doc) continue;

      if (args.departmentTag && doc.departmentTag !== args.departmentTag) continue;

      if (doc.status !== "approved" && doc.status !== "finalized") continue;

      const docIdStr = doc._id as string;
      if (seenDocumentIds.has(docIdStr)) continue;
      seenDocumentIds.add(docIdStr);

      filteredResults.push({
        title: doc.title,
        content: ver.content,
        score: ver._score,
      });

      if (filteredResults.length >= limit) break;
    }

    return filteredResults;
  },
});

export const deprecateDocument = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      status: "deprecated",
      isArchived: true, // Switched to pure archival structure
    });

    const doc = await ctx.db.get(args.documentId);
    if (doc) {
      await ctx.runMutation(internal.telemetry.logEvent, {
        traceId: doc.traceId ?? "system_deprecation",
        actor: "system: Engine",
        eventType: "STATE_TRANSITION",
        rawPayload: {
          action: "document_archived",
          documentId: args.documentId,
          message: "Document moved to infinite archive.",
        },
      });
    }
  },
});

// =========================================================================
// HELPER INTERNAL QUERIES / MUTATIONS
// =========================================================================

export const getActiveDocument = internalQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    // Append a strict .filter(q => q.eq(q.field("isArchived"), false)) statement
    return await ctx.db.query("documents")
      .filter((q) => q.eq(q.field("_id"), args.id))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .first();
  }
});

export const getVersion = internalQuery({
  args: { id: v.id("documentVersions") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const getVersions = internalQuery({
  args: { ids: v.array(v.id("documentVersions")) },
  handler: async (ctx, args) => {
    return await Promise.all(args.ids.map((id) => ctx.db.get(id)));
  },
});

export const getDocument = internalQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const saveEmbedding = internalMutation({
  args: {
    versionId: v.id("documentVersions"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.versionId, { embedding: args.embedding });
  },
});
