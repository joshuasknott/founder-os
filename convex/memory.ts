import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { actorFromIdentity, ensureDocWorkspace, requireCurrentUser } from "./authz";
import { recordAuditEvent } from "./audit";
import {
  createMemoryCandidate,
  dedupeMemoryCandidates,
  extractMemoryCandidates,
  formatMemoryContext,
  inferMemorySensitivity,
  memoryCanonicalKey,
  redactSecrets,
  selectedMemorySensitivity,
  selectRelevantMemories,
  type MemoryCandidate,
  type MemoryPurpose,
  type MemorySensitivity,
  type MemoryType,
} from "./memoryModel";
import { canUseLibraryContext } from "./documentContextRuntime";

const memoryType = v.union(
  v.literal("founder_preference"),
  v.literal("business_fact"),
  v.literal("decision"),
  v.literal("recurring_workflow"),
  v.literal("person"),
  v.literal("company"),
  v.literal("product"),
  v.literal("reusable_context"),
);

const memorySensitivity = v.union(
  v.literal("public"),
  v.literal("internal"),
  v.literal("confidential"),
  v.literal("sensitive"),
);

const memoryPurpose = v.union(
  v.literal("chat"),
  v.literal("document"),
  v.literal("workflow"),
  v.literal("builder"),
);

type DbCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function memoryEnabled(ctx: DbCtx, workspaceId: Id<"workspaces">) {
  const settings = await ctx.db
    .query("memorySettings")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .first();
  return settings?.enabled ?? true;
}

async function workspaceMemories(ctx: DbCtx, workspaceId: Id<"workspaces">) {
  return await ctx.db
    .query("memoryEntries")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
}

async function memorySourceAllowed(
  ctx: DbCtx,
  memory: Doc<"memoryEntries">,
  requestSensitivity: MemorySensitivity,
) {
  if (memory.sourceKind === "manual" || !memory.sourceItemId) return true;
  const item = await ctx.db.get(memory.sourceItemId);
  if (!item || item.workspaceId !== memory.workspaceId) return false;
  const version = memory.sourceVersionId
    ? await ctx.db.get(memory.sourceVersionId)
    : item.currentVersionId
      ? await ctx.db.get(item.currentVersionId)
      : null;
  return canUseLibraryContext({
    id: String(item._id),
    title: item.title,
    summary: item.summary,
    content: version?.content ?? "",
    status: memory.sourceKind === "completed_work" ? "approved" : item.status,
    metadata: item.metadata,
  }, requestSensitivity === "sensitive" ? "restricted" : requestSensitivity);
}

export async function buildMemoryContext(
  ctx: DbCtx,
  args: {
    workspaceId: Id<"workspaces">;
    queryText: string;
    purpose: MemoryPurpose;
    requestSensitivity?: MemorySensitivity;
    useMemory?: boolean;
    limit?: number;
  },
) {
  const enabled = await memoryEnabled(ctx, args.workspaceId);
  const requestSensitivity = args.requestSensitivity ?? inferMemorySensitivity(args.queryText);
  const memories = await Promise.all(
    (await workspaceMemories(ctx, args.workspaceId)).map(async (memory) => ({
      ...memory,
      sourceAllowed: await memorySourceAllowed(ctx, memory, requestSensitivity),
    })),
  );
  const selected = selectRelevantMemories({
    queryText: args.queryText,
    purpose: args.purpose,
    requestSensitivity,
    memories,
    memoryEnabled: enabled,
    useMemory: args.useMemory,
    limit: args.limit,
  });
  return {
    enabled,
    entries: selected,
    text: formatMemoryContext(selected),
  };
}

async function upsertMemoryFact(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    memoryId: Id<"memoryEntries">;
    candidate: MemoryCandidate;
    sourceItemId?: Id<"items">;
    sourceVersionId?: Id<"itemVersions">;
  },
) {
  const predicate = `remembered_${args.candidate.type}`;
  const facts = await ctx.db
    .query("facts")
    .withIndex("by_workspace_predicate", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("predicate", predicate),
    )
    .collect();
  const existing = facts.find((fact) =>
    metadataObject(fact.metadata).memoryEntryId === args.memoryId ||
    metadataObject(fact.metadata).memoryCanonicalKey === args.candidate.canonicalKey,
  );
  const now = Date.now();
  const patch = {
    subject: args.candidate.label,
    predicate,
    object: redactSecrets(args.candidate.value).text,
    confidence: 1,
    status: "observed" as const,
    sensitivity: args.candidate.sensitivity,
    isSensitive: args.candidate.sensitivity === "confidential" || args.candidate.sensitivity === "sensitive",
    sourceItemId: args.sourceItemId,
    sourceVersionId: args.sourceVersionId,
    metadata: {
      memoryEntryId: args.memoryId,
      memoryCanonicalKey: args.candidate.canonicalKey,
      memoryType: args.candidate.type,
    },
    updatedAt: now,
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }
  return await ctx.db.insert("facts", {
    workspaceId: args.workspaceId,
    ...patch,
    createdAt: now,
  });
}

async function upsertMemoryCandidates(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    candidates: MemoryCandidate[];
    sourceKind: "library_item" | "completed_work" | "manual";
    sourceItemId?: Id<"items">;
    sourceVersionId?: Id<"itemVersions">;
    sourceRunId?: Id<"workRuns">;
  },
) {
  let stored = 0;
  let skipped = 0;
  const now = Date.now();
  for (const candidate of dedupeMemoryCandidates(args.candidates)) {
    const existing = await ctx.db
      .query("memoryEntries")
      .withIndex("by_workspace_key", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("canonicalKey", candidate.canonicalKey),
      )
      .first();
    if (existing?.status === "deleted" && args.sourceKind !== "manual") {
      skipped++;
      continue;
    }

    const patch = {
      type: candidate.type,
      label: candidate.label,
      value: redactSecrets(candidate.value).text,
      canonicalKey: candidate.canonicalKey,
      searchText: candidate.searchText,
      sensitivity: candidate.sensitivity,
      status: "active" as const,
      sourceKind: args.sourceKind,
      sourceItemId: args.sourceItemId,
      sourceVersionId: args.sourceVersionId,
      sourceRunId: args.sourceRunId,
      updatedAt: now,
      deletedAt: undefined,
    };
    const memoryId = existing
      ? (await ctx.db.patch(existing._id, patch), existing._id)
      : await ctx.db.insert("memoryEntries", {
          workspaceId: args.workspaceId,
          ...patch,
          createdAt: now,
        });
    await upsertMemoryFact(ctx, {
      workspaceId: args.workspaceId,
      memoryId,
      candidate,
      sourceItemId: args.sourceItemId,
      sourceVersionId: args.sourceVersionId,
    });
    stored++;
  }
  return { stored, skipped };
}

// =========================================================================
// FOUNDER CONTROLS
// =========================================================================

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return { enabled: await memoryEnabled(ctx, workspaceId) };
  },
});

export const updateSettings = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query("memorySettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", current.workspaceId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled, updatedAt: now });
    } else {
      await ctx.db.insert("memorySettings", {
        workspaceId: current.workspaceId,
        enabled: args.enabled,
        updatedAt: now,
      });
    }
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "memory.settings_updated",
      resourceType: "memorySettings",
      summary: args.enabled ? "Enabled remembered details." : "Disabled remembered details.",
    });
  },
});

export const listRememberedDetails = query({
  args: { includeDeleted: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return (await workspaceMemories(ctx, workspaceId))
      .filter((entry) => args.includeDeleted || entry.status === "active")
      .sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const rememberDetail = mutation({
  args: {
    type: memoryType,
    label: v.string(),
    value: v.string(),
    sensitivity: v.optional(memorySensitivity),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const candidate = createMemoryCandidate(args.type as MemoryType, args.label, args.value);
    if (!candidate) throw new Error("That detail looks like a secret or is too short to remember.");
    const prepared = {
      ...candidate,
      sensitivity: selectedMemorySensitivity(
        candidate.sensitivity,
        args.sensitivity as MemorySensitivity | undefined,
      ),
    };
    const result = await upsertMemoryCandidates(ctx, {
      workspaceId: current.workspaceId,
      candidates: [prepared],
      sourceKind: "manual",
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "memory.detail_added",
      resourceType: "memoryEntry",
      summary: `Remembered detail: ${prepared.label}.`,
    });
    return result;
  },
});

export const updateDetail = mutation({
  args: {
    memoryId: v.id("memoryEntries"),
    type: memoryType,
    label: v.string(),
    value: v.string(),
    sensitivity: v.optional(memorySensitivity),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const existing = ensureDocWorkspace(await ctx.db.get(args.memoryId), current.workspaceId, "Remembered detail");
    const candidate = createMemoryCandidate(args.type as MemoryType, args.label, args.value);
    if (!candidate) throw new Error("That detail looks like a secret or is too short to remember.");
    const sensitivity = selectedMemorySensitivity(
      candidate.sensitivity,
      args.sensitivity as MemorySensitivity | undefined,
    );
    await ctx.db.patch(args.memoryId, {
      type: candidate.type,
      label: candidate.label,
      value: candidate.value,
      canonicalKey: memoryCanonicalKey(candidate.type, candidate.label, candidate.value),
      searchText: candidate.searchText,
      sensitivity,
      status: "active",
      sourceKind: "manual",
      updatedAt: Date.now(),
      deletedAt: undefined,
    });
    await upsertMemoryFact(ctx, {
      workspaceId: current.workspaceId,
      memoryId: existing._id,
      candidate: { ...candidate, sensitivity },
      sourceItemId: existing.sourceItemId,
      sourceVersionId: existing.sourceVersionId,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "memory.detail_updated",
      resourceType: "memoryEntry",
      resourceId: String(args.memoryId),
      summary: `Updated remembered detail: ${candidate.label}.`,
    });
  },
});

export const deleteDetail = mutation({
  args: { memoryId: v.id("memoryEntries") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const detail = ensureDocWorkspace(await ctx.db.get(args.memoryId), current.workspaceId, "Remembered detail");
    const now = Date.now();
    await ctx.db.patch(args.memoryId, {
      value: "",
      searchText: "",
      status: "deleted",
      deletedAt: now,
      updatedAt: now,
    });
    const facts = await ctx.db.query("facts").collect();
    for (const fact of facts) {
      if (metadataObject(fact.metadata).memoryEntryId === args.memoryId) {
        await ctx.db.patch(fact._id, {
          object: "",
          status: "retracted",
          updatedAt: now,
        });
      }
    }
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "memory.detail_deleted",
      resourceType: "memoryEntry",
      resourceId: String(args.memoryId),
      summary: `Deleted remembered detail: ${detail.label}.`,
    });
  },
});

export const rescanWorkspace = mutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 250);
    const items = (await ctx.db
      .query("items")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", current.workspaceId))
      .collect())
      .filter((item) => item.status !== "archived" && item.status !== "deprecated")
      .slice(0, limit);
    const runs = (await ctx.db
      .query("workRuns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", current.workspaceId))
      .collect())
      .filter((run) => run.status === "completed")
      .slice(0, limit);

    for (const item of items) {
      await ctx.scheduler.runAfter(0, internal.memory.extractFromItem, {
        itemId: item._id,
        versionId: item.currentVersionId,
      });
    }
    for (const run of runs) {
      await ctx.scheduler.runAfter(0, internal.memory.extractFromCompletedWork, {
        runId: run._id,
        itemId: run.outputItemId,
      });
    }
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "memory.workspace_rescan_queued",
      resourceType: "memoryEntry",
      summary: "Queued a remembered-details refresh from Library and completed work.",
      metadata: { itemCount: items.length, runCount: runs.length },
    });
    return { itemCount: items.length, runCount: runs.length };
  },
});

// =========================================================================
// SAFE EXTRACTION AND RETRIEVAL
// =========================================================================

export const extractFromItem = internalMutation({
  args: { itemId: v.id("items"), versionId: v.optional(v.id("itemVersions")) },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item?.workspaceId || item.status === "archived" || item.status === "deprecated") {
      return { stored: 0, skipped: 0 };
    }
    const version = args.versionId
      ? await ctx.db.get(args.versionId)
      : item.currentVersionId
        ? await ctx.db.get(item.currentVersionId)
        : null;
    const text = [item.title, item.summary, version?.summary, version?.content].filter(Boolean).join("\n");
    return await upsertMemoryCandidates(ctx, {
      workspaceId: item.workspaceId,
      candidates: extractMemoryCandidates(text),
      sourceKind: "library_item",
      sourceItemId: item._id,
      sourceVersionId: version?._id,
      sourceRunId: item.runId,
    });
  },
});

export const extractFromCompletedWork = internalMutation({
  args: { runId: v.id("workRuns"), itemId: v.optional(v.id("items")) },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run?.workspaceId || run.status !== "completed") return { stored: 0, skipped: 0 };
    const directive = await ctx.db.get(run.directiveId);
    const item = args.itemId ? await ctx.db.get(args.itemId) : run.outputItemId ? await ctx.db.get(run.outputItemId) : null;
    const version = item?.currentVersionId ? await ctx.db.get(item.currentVersionId) : null;
    const text = [
      directive?.title,
      directive?.objective,
      run.title,
      run.summary,
      item?.title,
      item?.summary,
      version?.summary,
      version?.content,
    ].filter(Boolean).join("\n");
    return await upsertMemoryCandidates(ctx, {
      workspaceId: run.workspaceId,
      candidates: extractMemoryCandidates(text),
      sourceKind: "completed_work",
      sourceItemId: item?._id,
      sourceVersionId: version?._id,
      sourceRunId: run._id,
    });
  },
});

export const retrieveForTask = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    queryText: v.string(),
    purpose: memoryPurpose,
    requestSensitivity: v.optional(memorySensitivity),
    useMemory: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await buildMemoryContext(ctx, {
      workspaceId: args.workspaceId,
      queryText: args.queryText,
      purpose: args.purpose as MemoryPurpose,
      requestSensitivity: args.requestSensitivity as MemorySensitivity | undefined,
      useMemory: args.useMemory,
      limit: args.limit,
    });
  },
});

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
    workspaceId: v.optional(v.id("workspaces")),
    requestSensitivity: v.optional(memorySensitivity),
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
      if (args.workspaceId && doc.workspaceId !== args.workspaceId) continue;

      if (doc.status !== "approved" && doc.status !== "finalized") continue;
      const requestSensitivity = args.requestSensitivity ?? inferMemorySensitivity(args.queryText);
      if (!canUseLibraryContext({
        id: String(doc._id),
        title: doc.title,
        summary: doc.summary,
        content: ver.content,
        status: doc.status,
      }, requestSensitivity === "sensitive" ? "restricted" : requestSensitivity)) continue;

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
