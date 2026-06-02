import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  entityType,
  factStatus,
  itemKind,
  itemSource,
  relationType,
  savedViewScope,
  versionFormat,
  workflowKind,
  workflowStatus,
} from "./itemValidators";
import {
  appendItemVersion,
  createItemWithVersion,
  documentKindToItemKind,
  itemKindToDocumentKind,
  type DocumentKind,
} from "./itemModel";
import { actorFromIdentity, ensureDocWorkspace, requireCurrentUser, requireWorkspaceAccess } from "./authz";
import { recordAuditEvent } from "./audit";

const publicItemStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("under_review"),
  v.literal("approved"),
  v.literal("finalized"),
);

const workflowStep = v.object({
  key: v.string(),
  title: v.string(),
  kind: v.string(),
  config: v.optional(v.any()),
  outputItemKind: v.optional(itemKind),
});

const workflowInput = v.object({
  key: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("number"),
    v.literal("date"),
    v.literal("select"),
    v.literal("boolean"),
  ),
  required: v.boolean(),
  defaultValue: v.optional(v.any()),
  options: v.optional(v.array(v.string())),
});

const workflowOutput = v.object({
  key: v.string(),
  label: v.string(),
  kind: itemKind,
  description: v.optional(v.string()),
});

const workflowApprovalRule = v.object({
  actionKind: v.union(
    v.literal("publish_preview"),
    v.literal("send_email"),
    v.literal("create_calendar_event"),
    v.literal("post_externally"),
    v.literal("spend_money"),
    v.literal("delete_data"),
    v.literal("change_live_asset"),
    v.literal("generic"),
  ),
  policy: v.union(v.literal("always"), v.literal("when_external"), v.literal("over_threshold")),
  threshold: v.optional(v.number()),
  description: v.optional(v.string()),
});

function activeItem(status: string, includeArchived?: boolean) {
  return includeArchived || (status !== "archived" && status !== "deprecated");
}

function canonicalName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstUsefulLine(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^#+\s*/, ""))
    .find((line) => line.length >= 8);
}

function summarizeContent(content?: string, fallback = "Saved to Library.") {
  const normalized = (content ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;

  const sentence = normalized.match(/^.{40,220}?[.!?](?:\s|$)/)?.[0]?.trim();
  const summary = sentence ?? normalized.slice(0, 180).trim();
  return summary.length < normalized.length ? `${summary.replace(/[,\s]+$/, "")}...` : summary;
}

function inferTitle(args: { title?: string; content?: string; sourceUrl?: string; fileNames?: string[] }) {
  const explicit = args.title?.trim();
  if (explicit) return explicit;

  const firstFile = args.fileNames?.find((name) => name.trim());
  if (firstFile) return firstFile.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || firstFile;

  if (args.sourceUrl) {
    try {
      const url = new URL(args.sourceUrl);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return args.sourceUrl;
    }
  }

  return firstUsefulLine(args.content ?? "") ?? "Untitled Library item";
}

function inferTags(content?: string, sourceUrl?: string, fileNames?: string[]) {
  const normalized = `${content ?? ""} ${sourceUrl ?? ""} ${(fileNames ?? []).join(" ")}`.toLowerCase();
  const tags = new Set<string>();
  const signals: Array<[string, RegExp]> = [
    ["pricing", /\b(price|pricing|plan|subscription|revenue|arr|mrr)\b/],
    ["customer", /\b(customer|user|buyer|lead|prospect|interview)\b/],
    ["sales", /\b(sales|pipeline|deal|crm|outreach)\b/],
    ["product", /\b(product|feature|roadmap|bug|release)\b/],
    ["meeting", /\b(meeting|notes|agenda|action items?)\b/],
    ["research", /\b(research|market|competitor|analysis)\b/],
    ["finance", /\b(finance|budget|cash|runway|invoice)\b/],
  ];

  for (const [tag, pattern] of signals) {
    if (pattern.test(normalized)) tags.add(tag);
  }

  if (sourceUrl) tags.add("web");
  if ((fileNames ?? []).length > 0) tags.add("upload");
  return Array.from(tags).slice(0, 8);
}

async function getOwnedItem(ctx: Parameters<typeof requireCurrentUser>[0], itemId: Id<"items">) {
  const current = await requireCurrentUser(ctx);
  const item = ensureDocWorkspace(await ctx.db.get(itemId), current.workspaceId, "Item");
  return { ...current, item };
}

export const list = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    kind: v.optional(itemKind),
    traceId: v.optional(v.id("directives")),
    includeArchived: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const limit = args.limit ?? 100;
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    const workspaceId = current.workspaceId;
    const kind = args.kind;
    const traceId = args.traceId;
    let items =
      workspaceId && kind
        ? await ctx.db
            .query("items")
            .withIndex("by_workspace_kind", (q) =>
              q.eq("workspaceId", workspaceId).eq("kind", kind),
            )
            .collect()
        : workspaceId
          ? await ctx.db
              .query("items")
              .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
              .collect()
          : await ctx.db
              .query("items")
              .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
              .collect();

    if (traceId) {
      ensureDocWorkspace(await ctx.db.get(traceId), workspaceId, "Task");
      items = items.filter((item) => item.traceId === traceId);
    }

    return await Promise.all(
      items
        .filter((item) => activeItem(item.status, args.includeArchived))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit)
        .map(async (item) => {
          const currentVersion = item.currentVersionId
            ? await ctx.db.get(item.currentVersionId)
            : null;
          return { ...item, currentVersion };
        }),
    );
  },
});

export const get = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const { item } = await getOwnedItem(ctx, args.itemId);
    const currentVersion = item.currentVersionId ? await ctx.db.get(item.currentVersionId) : null;
    return { ...item, currentVersion };
  },
});

export const getDetail = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const { item, workspaceId } = await getOwnedItem(ctx, args.itemId);

    const currentVersion = item.currentVersionId ? await ctx.db.get(item.currentVersionId) : null;
    const versions = (
      await ctx.db
        .query("itemVersions")
        .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
        .collect()
    ).sort((a, b) => b.versionNumber - a.versionNumber);

    const document = item.legacyDocumentId ? await ctx.db.get(item.legacyDocumentId) : null;
    const documentVersions = document
      ? (
          await ctx.db
            .query("documentVersions")
            .withIndex("by_document", (q) => q.eq("documentId", document._id))
            .collect()
        ).sort((a, b) => (b.versionNumber ?? b._creationTime) - (a.versionNumber ?? a._creationTime))
      : [];

    const directive = item.traceId ? await ctx.db.get(item.traceId) : null;
    const metadata = metadataObject(item.metadata);
    const metadataChatSessionId = metadata.sourceChatSessionId as Id<"chatSessions"> | undefined;
    const chatSession = directive?.sessionId
      ? await ctx.db.get(directive.sessionId)
      : metadataChatSessionId
        ? await ctx.db.get(metadataChatSessionId)
        : null;
    const sourceTask = item.taskId ? await ctx.db.get(item.taskId) : null;
    const sourceRun = item.runId ? await ctx.db.get(item.runId) : null;

    const sourceArtifacts = item.traceId
      ? await ctx.db
          .query("workArtifacts")
          .withIndex("by_directive", (q) => q.eq("directiveId", item.traceId))
          .collect()
      : [];

    const outgoing = await ctx.db
      .query("itemRelations")
      .withIndex("by_from", (q) => q.eq("fromItemId", args.itemId))
      .collect();
    const incoming = await ctx.db
      .query("itemRelations")
      .withIndex("by_to_item", (q) => q.eq("toItemId", args.itemId))
      .collect();

    const relatedItemIds = Array.from(
      new Set([
        ...outgoing.flatMap((relation) => (relation.toItemId ? [relation.toItemId] : [])),
        ...incoming.map((relation) => relation.fromItemId),
      ]),
    ).slice(0, 8);
    const relatedItems = (await Promise.all(relatedItemIds.map((id) => ctx.db.get(id)))).filter(
      (relatedItem) => relatedItem !== null && relatedItem.workspaceId === workspaceId,
    );

    const relatedEntityIds = Array.from(
      new Set(outgoing.flatMap((relation) => (relation.toEntityId ? [relation.toEntityId] : []))),
    ).slice(0, 8);
    const relatedEntities = (await Promise.all(relatedEntityIds.map((id) => ctx.db.get(id)))).filter(
      (entity) => entity !== null && entity.workspaceId === workspaceId,
    );

    const facts = await ctx.db
      .query("facts")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    return {
      item: { ...item, currentVersion },
      document,
      versions,
      documentVersions,
      directive,
      chatSession,
      sourceTask,
      sourceRun,
      sourceArtifacts: sourceArtifacts.slice(0, 8),
      relations: {
        outgoing,
        incoming,
      },
      relatedItems,
      relatedEntities,
      facts: facts.slice(0, 12),
    };
  },
});

export const getVersions = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    await getOwnedItem(ctx, args.itemId);
    const versions = await ctx.db
      .query("itemVersions")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  },
});

export const create = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    departmentId: v.optional(v.id("departments")),
    title: v.string(),
    kind: itemKind,
    status: v.optional(publicItemStatus),
    source: v.optional(itemSource),
    author: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    format: v.optional(versionFormat),
    traceId: v.optional(v.id("directives")),
    taskId: v.optional(v.id("tasks")),
    runId: v.optional(v.id("workRuns")),
    sourceUrl: v.optional(v.string()),
    externalId: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    createDocumentMirror: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    if (args.departmentId) {
      ensureDocWorkspace(await ctx.db.get(args.departmentId), current.workspaceId, "Department");
    }
    if (args.traceId) ensureDocWorkspace(await ctx.db.get(args.traceId), current.workspaceId, "Task");
    const { itemId, versionId } = await createItemWithVersion(ctx, {
      ...args,
      workspaceId: current.workspaceId,
    });

    if (args.createDocumentMirror && args.departmentId) {
      const now = Date.now();
      const documentKind = itemKindToDocumentKind(args.kind);
      const docId = await ctx.db.insert("documents", {
        workspaceId: current.workspaceId,
        itemId,
        title: args.title,
        departmentTag: args.departmentId,
        author: args.author ?? "FounderOS",
        traceId: args.traceId,
        kind: documentKind,
        summary: args.summary,
        status: args.status === "finalized" ? "finalized" : "draft",
        isArchived: false,
        versionCount: 1,
        createdAt: now,
        updatedAt: now,
      });

      const docVersionId = await ctx.db.insert("documentVersions", {
        documentId: docId,
        itemVersionId: versionId,
        content: args.content ?? "",
        versionNumber: 1,
        createdAt: now,
        createdBy: args.author ?? "FounderOS",
        summary: args.summary ?? "Initial version.",
      });

      await ctx.db.patch(docId, { currentVersionId: docVersionId });
      await ctx.db.patch(itemId, { legacyDocumentId: docId });
      await ctx.db.patch(versionId, { legacyDocumentVersionId: docVersionId });
    }

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "item.created",
      resourceType: "item",
      resourceId: String(itemId),
      summary: `Created Library item: ${args.title}.`,
      metadata: { kind: args.kind, versionId },
    });

    return itemId;
  },
});

export const intake = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    departmentId: v.id("departments"),
    title: v.optional(v.string()),
    content: v.string(),
    kind: v.optional(itemKind),
    sourceUrl: v.optional(v.string()),
    traceId: v.optional(v.id("directives")),
    taskId: v.optional(v.id("tasks")),
    runId: v.optional(v.id("workRuns")),
    sourceChatSessionId: v.optional(v.id("chatSessions")),
    files: v.optional(
      v.array(
        v.object({
          name: v.string(),
          mimeType: v.optional(v.string()),
          sizeBytes: v.optional(v.number()),
          lastModified: v.optional(v.number()),
        }),
      ),
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    const department = await ctx.db.get(args.departmentId);
    ensureDocWorkspace(department, current.workspaceId, "Department");
    if (args.traceId) ensureDocWorkspace(await ctx.db.get(args.traceId), current.workspaceId, "Task");
    if (args.sourceChatSessionId) {
      ensureDocWorkspace(await ctx.db.get(args.sourceChatSessionId), current.workspaceId, "Chat");
    }

    const now = Date.now();
    const fileNames = args.files?.map((file) => file.name);
    const title = inferTitle({
      title: args.title,
      content: args.content,
      sourceUrl: args.sourceUrl,
      fileNames,
    });
    const summary = summarizeContent(args.content, "Uploaded to Library.");
    const kind = args.kind ?? (args.files?.length ? "upload" : args.sourceUrl ? "website" : "doc");
    const tags = inferTags(args.content, args.sourceUrl, fileNames);
    const wordCount = args.content.trim() ? args.content.trim().split(/\s+/).length : 0;
    const lineCount = args.content ? args.content.split(/\r?\n/).length : 0;
    const extractedUrls = Array.from(args.content.matchAll(/https?:\/\/[^\s)]+/g), (match) => match[0]).slice(0, 10);
    const extractedEmails = Array.from(
      args.content.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
      (match) => match[0],
    ).slice(0, 10);
    const intakeMetadata = {
      ...metadataObject(args.metadata),
      intake: {
        mode: args.files?.length ? "file_text" : "pasted_text",
        storageStrategy: "convex-text-first",
        storageStatus: "content_saved_as_text",
        storageExtensionPoint: "Attach Convex file storage by passing storageId on items/itemVersions.",
        files: args.files ?? [],
        sourceUrl: args.sourceUrl,
        sourceChatSessionId: args.sourceChatSessionId,
        extracted: {
          wordCount,
          lineCount,
          urls: extractedUrls,
          emails: extractedEmails,
        },
      },
      searchText: [title, summary, args.content, tags.join(" "), fileNames?.join(" "), args.sourceUrl]
        .filter(Boolean)
        .join("\n")
        .toLowerCase(),
    };

    const { itemId, versionId: itemVersionId } = await createItemWithVersion(ctx, {
      workspaceId: current.workspaceId,
      departmentId: args.departmentId,
      title,
      kind,
      status: "active",
      source: args.files?.length ? "upload" : args.sourceUrl ? "website" : "user",
      author: "FounderOS",
      summary,
      content: args.content,
      format: "plain_text",
      traceId: args.traceId,
      taskId: args.taskId,
      runId: args.runId,
      sourceUrl: args.sourceUrl,
      mimeType: args.files?.length === 1 ? args.files[0].mimeType : undefined,
      tags,
      metadata: intakeMetadata,
      createdAt: now,
    });

    const documentKind = itemKindToDocumentKind(kind);
    const docId = await ctx.db.insert("documents", {
      workspaceId: current.workspaceId,
      itemId,
      title,
      departmentTag: args.departmentId,
      author: "FounderOS",
      traceId: args.traceId,
      kind: documentKind,
      summary,
      status: "draft",
      isArchived: false,
      versionCount: 1,
      createdAt: now,
      updatedAt: now,
    });

    const documentVersionId = await ctx.db.insert("documentVersions", {
      documentId: docId,
      itemVersionId,
      content: args.content,
      versionNumber: 1,
      createdAt: now,
      createdBy: "FounderOS",
      summary,
    });

    await ctx.db.patch(docId, { currentVersionId: documentVersionId });
    await ctx.db.patch(itemId, { legacyDocumentId: docId });
    await ctx.db.patch(itemVersionId, {
      legacyDocumentVersionId: documentVersionId,
      metadata: intakeMetadata,
      sizeBytes: new TextEncoder().encode(args.content).length,
    });

    if (extractedUrls.length > 0) {
      await ctx.db.insert("facts", {
        workspaceId: current.workspaceId,
        itemId,
        subject: title,
        predicate: "mentions_url",
        object: extractedUrls[0],
        status: "observed",
        sourceItemId: itemId,
        sourceVersionId: itemVersionId,
        metadata: { count: extractedUrls.length, urls: extractedUrls },
        createdAt: now,
        updatedAt: now,
      });
    }

    if (extractedEmails.length > 0) {
      await ctx.db.insert("facts", {
        workspaceId: current.workspaceId,
        itemId,
        subject: title,
        predicate: "mentions_email",
        object: extractedEmails[0],
        status: "observed",
        sourceItemId: itemId,
        sourceVersionId: itemVersionId,
        metadata: { count: extractedEmails.length, emails: extractedEmails },
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "item.intaked",
      resourceType: "item",
      resourceId: String(itemId),
      summary: `Added to Library: ${title}.`,
      metadata: { documentId: docId, versionId: itemVersionId, sourceUrl: args.sourceUrl },
    });

    return { itemId, documentId: docId, versionId: itemVersionId };
  },
});

export const update = mutation({
  args: {
    itemId: v.id("items"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    format: v.optional(versionFormat),
    sourceUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const item = ensureDocWorkspace(await ctx.db.get(args.itemId), current.workspaceId, "Item");
    const versionId = await appendItemVersion(ctx, args);
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "item.updated",
      resourceType: "item",
      resourceId: String(args.itemId),
      summary: `Updated Library item: ${args.title ?? item.title}.`,
      metadata: { versionId },
    });
    return versionId;
  },
});

export const archive = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const item = ensureDocWorkspace(await ctx.db.get(args.itemId), current.workspaceId, "Item");
    const now = Date.now();
    await ctx.db.patch(args.itemId, {
      status: "archived",
      archivedAt: now,
      updatedAt: now,
    });
    if (item.legacyDocumentId) {
      await ctx.db.patch(item.legacyDocumentId, {
        isArchived: true,
        status: "deprecated",
        deprecatedAt: now,
        updatedAt: now,
      });
    }
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "item.archived",
      resourceType: "item",
      resourceId: String(args.itemId),
      summary: `Archived Library item: ${item.title}.`,
    });
  },
});

export const restore = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const item = ensureDocWorkspace(await ctx.db.get(args.itemId), current.workspaceId, "Item");
    const now = Date.now();
    await ctx.db.patch(args.itemId, {
      status: item.status === "deprecated" ? "draft" : "active",
      archivedAt: undefined,
      updatedAt: now,
    });
    if (item.legacyDocumentId) {
      await ctx.db.patch(item.legacyDocumentId, {
        isArchived: false,
        status: "draft",
        deprecatedAt: undefined,
        updatedAt: now,
      });
    }
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "item.restored",
      resourceType: "item",
      resourceId: String(args.itemId),
      summary: `Restored Library item: ${item.title}.`,
    });
  },
});

export const approve = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const item = ensureDocWorkspace(await ctx.db.get(args.itemId), current.workspaceId, "Item");
    if (item.status === "archived" || item.status === "deprecated") {
      throw new Error("Restore this Library item before approving it.");
    }
    const now = Date.now();
    await ctx.db.patch(args.itemId, {
      status: "approved",
      updatedAt: now,
    });
    if (item.legacyDocumentId) {
      await ctx.db.patch(item.legacyDocumentId, {
        status: "approved",
        updatedAt: now,
      });
    }
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "item.approved",
      resourceType: "item",
      resourceId: String(args.itemId),
      summary: `Approved Library item: ${item.title}.`,
    });
    return args.itemId;
  },
});

export const setPinned = mutation({
  args: {
    itemId: v.id("items"),
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const item = ensureDocWorkspace(await ctx.db.get(args.itemId), current.workspaceId, "Item");
    await ctx.db.patch(args.itemId, {
      metadata: {
        ...((item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata))
          ? item.metadata
          : {}),
        isPinned: args.isPinned,
      },
      updatedAt: Date.now(),
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: args.isPinned ? "item.pinned" : "item.unpinned",
      resourceType: "item",
      resourceId: String(args.itemId),
      summary: `${args.isPinned ? "Pinned" : "Unpinned"} Library item: ${item.title}.`,
    });
  },
});

export const remove = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item?.workspaceId) throw new Error("Item not found.");
    const current = await requireWorkspaceAccess(ctx, item.workspaceId, ["Owner"]);
    const versions = await ctx.db
      .query("itemVersions")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    const relations = await ctx.db
      .query("itemRelations")
      .withIndex("by_from", (q) => q.eq("fromItemId", args.itemId))
      .collect();
    for (const relation of relations) {
      await ctx.db.delete(relation._id);
    }

    await ctx.db.delete(args.itemId);
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "item.deleted",
      resourceType: "item",
      resourceId: String(args.itemId),
      summary: `Deleted Library item: ${item.title}.`,
    });
  },
});

export const relate = mutation({
  args: {
    fromItemId: v.id("items"),
    toItemId: v.optional(v.id("items")),
    toEntityId: v.optional(v.id("entities")),
    relationType,
    summary: v.optional(v.string()),
    strength: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.toItemId && !args.toEntityId) {
      throw new Error("Relation needs a target item or entity.");
    }

    const current = await requireCurrentUser(ctx);
    const item = ensureDocWorkspace(await ctx.db.get(args.fromItemId), current.workspaceId, "Item");
    if (args.toItemId) {
      ensureDocWorkspace(await ctx.db.get(args.toItemId), current.workspaceId, "Related item");
    }
    if (args.toEntityId) {
      ensureDocWorkspace(await ctx.db.get(args.toEntityId), current.workspaceId, "Entity");
    }

    const relationId = await ctx.db.insert("itemRelations", {
      workspaceId: current.workspaceId,
      fromItemId: args.fromItemId,
      toItemId: args.toItemId,
      toEntityId: args.toEntityId,
      relationType: args.relationType,
      summary: args.summary,
      strength: args.strength,
      metadata: args.metadata,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "item.related",
      resourceType: "itemRelation",
      resourceId: String(relationId),
      summary: `Related Library item: ${item.title}.`,
      metadata: { relationType: args.relationType, toItemId: args.toItemId, toEntityId: args.toEntityId },
    });
    return relationId;
  },
});

export const listRelations = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    ensureDocWorkspace(await ctx.db.get(args.itemId), workspaceId, "Item");
    const outgoing = await ctx.db
      .query("itemRelations")
      .withIndex("by_from", (q) => q.eq("fromItemId", args.itemId))
      .collect();
    const incoming = await ctx.db
      .query("itemRelations")
      .withIndex("by_to_item", (q) => q.eq("toItemId", args.itemId))
      .collect();
    return {
      outgoing: outgoing.filter((relation) => relation.workspaceId === workspaceId),
      incoming: incoming.filter((relation) => relation.workspaceId === workspaceId),
    };
  },
});

export const upsertEntity = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    type: entityType,
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    sourceItemId: v.optional(v.id("items")),
    externalId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    if (args.sourceItemId) {
      ensureDocWorkspace(await ctx.db.get(args.sourceItemId), current.workspaceId, "Source item");
    }
    const canonical = canonicalName(args.name);
    const existing = await ctx.db
      .query("entities")
      .withIndex("by_canonical", (q) =>
        q.eq("workspaceId", current.workspaceId).eq("canonicalName", canonical),
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.type,
        name: args.name,
        aliases: args.aliases,
        description: args.description ?? existing.description,
        sourceItemId: args.sourceItemId ?? existing.sourceItemId,
        externalId: args.externalId ?? existing.externalId,
        metadata: args.metadata ?? existing.metadata,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("entities", {
      workspaceId: current.workspaceId,
      type: args.type,
      name: args.name,
      canonicalName: canonical,
      aliases: args.aliases,
      description: args.description,
      sourceItemId: args.sourceItemId,
      externalId: args.externalId,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addFact = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    entityId: v.optional(v.id("entities")),
    itemId: v.optional(v.id("items")),
    subject: v.string(),
    predicate: v.string(),
    object: v.string(),
    value: v.optional(v.any()),
    confidence: v.optional(v.number()),
    status: v.optional(factStatus),
    sourceItemId: v.optional(v.id("items")),
    sourceVersionId: v.optional(v.id("itemVersions")),
    validFrom: v.optional(v.number()),
    validTo: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    if (args.entityId) ensureDocWorkspace(await ctx.db.get(args.entityId), current.workspaceId, "Entity");
    if (args.itemId) ensureDocWorkspace(await ctx.db.get(args.itemId), current.workspaceId, "Item");
    if (args.sourceItemId) ensureDocWorkspace(await ctx.db.get(args.sourceItemId), current.workspaceId, "Source item");
    const now = Date.now();
    return await ctx.db.insert("facts", {
      workspaceId: current.workspaceId,
      entityId: args.entityId,
      itemId: args.itemId,
      subject: args.subject,
      predicate: args.predicate,
      object: args.object,
      value: args.value,
      confidence: args.confidence,
      status: args.status ?? "observed",
      sourceItemId: args.sourceItemId,
      sourceVersionId: args.sourceVersionId,
      validFrom: args.validFrom,
      validTo: args.validTo,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listFacts = query({
  args: {
    entityId: v.optional(v.id("entities")),
    itemId: v.optional(v.id("items")),
    sourceItemId: v.optional(v.id("items")),
  },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    if (args.entityId) {
      ensureDocWorkspace(await ctx.db.get(args.entityId), workspaceId, "Entity");
      return await ctx.db
        .query("facts")
        .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
        .collect();
    }
    if (args.itemId) {
      ensureDocWorkspace(await ctx.db.get(args.itemId), workspaceId, "Item");
      return await ctx.db
        .query("facts")
        .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
        .collect();
    }
    if (args.sourceItemId) {
      ensureDocWorkspace(await ctx.db.get(args.sourceItemId), workspaceId, "Source item");
      return await ctx.db
        .query("facts")
        .withIndex("by_source_item", (q) => q.eq("sourceItemId", args.sourceItemId))
        .collect();
    }
    return (await ctx.db.query("facts").collect()).filter((fact) => fact.workspaceId === workspaceId);
  },
});

export const listSavedViews = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    pinnedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    const workspaceId = current.workspaceId;
    const pinnedOnly = args.pinnedOnly;
    const views =
      workspaceId && pinnedOnly !== undefined
        ? await ctx.db
            .query("savedViews")
            .withIndex("by_pinned", (q) =>
              q.eq("workspaceId", workspaceId).eq("isPinned", pinnedOnly),
            )
            .collect()
        : workspaceId
          ? await ctx.db
              .query("savedViews")
              .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
              .collect()
          : await ctx.db
              .query("savedViews")
              .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
              .collect();

    return views.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const saveView = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    description: v.optional(v.string()),
    scope: savedViewScope,
    query: v.optional(v.string()),
    itemKinds: v.optional(v.array(itemKind)),
    filters: v.optional(v.any()),
    sort: v.optional(v.any()),
    isPinned: v.optional(v.boolean()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    const now = Date.now();
    return await ctx.db.insert("savedViews", {
      workspaceId: current.workspaceId,
      title: args.title,
      description: args.description,
      scope: args.scope,
      query: args.query,
      itemKinds: args.itemKinds,
      filters: args.filters,
      sort: args.sort,
      isPinned: args.isPinned ?? false,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setViewPinned = mutation({
  args: {
    viewId: v.id("savedViews"),
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const view = await ctx.db.get(args.viewId);
    ensureDocWorkspace(view, current.workspaceId, "Saved view");
    await ctx.db.patch(args.viewId, {
      isPinned: args.isPinned,
      updatedAt: Date.now(),
    });
  },
});

export const removeView = mutation({
  args: { viewId: v.id("savedViews") },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const view = await ctx.db.get(args.viewId);
    ensureDocWorkspace(view, current.workspaceId, "Saved view");
    await ctx.db.delete(args.viewId);
  },
});

export const recordViewUse = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    description: v.optional(v.string()),
    scope: savedViewScope,
    query: v.optional(v.string()),
    itemKinds: v.optional(v.array(itemKind)),
    filters: v.optional(v.any()),
    sort: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    const now = Date.now();
    const views = await ctx.db
      .query("savedViews")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", current.workspaceId))
      .collect();
    const signature = JSON.stringify({
      scope: args.scope,
      query: args.query ?? "",
      itemKinds: args.itemKinds ?? [],
      filters: args.filters ?? {},
      sort: args.sort ?? {},
    });
    const existing = views.find((view) => {
      const viewSignature = JSON.stringify({
        scope: view.scope,
        query: view.query ?? "",
        itemKinds: view.itemKinds ?? [],
        filters: view.filters ?? {},
        sort: view.sort ?? {},
      });
      return viewSignature === signature;
    });

    if (existing) {
      const usageCount = (existing.usageCount ?? 0) + 1;
      await ctx.db.patch(existing._id, {
        usageCount,
        lastUsedAt: now,
        suggestedAt: existing.suggestedAt ?? (usageCount >= 3 ? now : undefined),
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("savedViews", {
      workspaceId: current.workspaceId,
      title: args.title,
      description: args.description,
      scope: args.scope,
      query: args.query,
      itemKinds: args.itemKinds,
      filters: args.filters,
      sort: args.sort,
      isPinned: false,
      usageCount: 1,
      lastUsedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listWorkflows = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    status: v.optional(workflowStatus),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    const workspaceId = current.workspaceId;
    const status = args.status;
    const workflows =
      workspaceId && status
        ? await ctx.db
            .query("workflows")
            .withIndex("by_status", (q) =>
              q.eq("workspaceId", workspaceId).eq("status", status),
            )
            .collect()
        : workspaceId
          ? await ctx.db
              .query("workflows")
              .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
              .collect()
          : await ctx.db
              .query("workflows")
              .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
              .collect();

    return workflows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const saveWorkflow = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    description: v.optional(v.string()),
    kind: workflowKind,
    status: v.optional(workflowStatus),
    trigger: v.optional(v.any()),
    inputs: v.optional(v.array(workflowInput)),
    steps: v.array(workflowStep),
    outputs: v.optional(v.array(workflowOutput)),
    approvalRules: v.optional(v.array(workflowApprovalRule)),
    ownerId: v.optional(v.id("users")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    if (args.workspaceId && args.workspaceId !== current.workspaceId) {
      throw new Error("You do not have access to that workspace.");
    }
    if (args.ownerId) {
      const owner = await ctx.db.get(args.ownerId);
      if (!owner || owner.workspaceId !== current.workspaceId) throw new Error("Owner not found.");
    }
    const now = Date.now();
    const workflowId = await ctx.db.insert("workflows", {
      workspaceId: current.workspaceId,
      title: args.title,
      description: args.description,
      kind: args.kind,
      status: args.status ?? "draft",
      trigger: args.trigger,
      inputs: args.inputs,
      steps: args.steps,
      outputs: args.outputs,
      approvalRules: args.approvalRules,
      ownerId: args.ownerId,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "workflow.saved",
      resourceType: "workflow",
      resourceId: String(workflowId),
      summary: `Saved workflow: ${args.title}.`,
      metadata: { kind: args.kind, status: args.status ?? "draft" },
    });
    return workflowId;
  },
});

export const migrateLegacyDocuments = mutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const current = await requireWorkspaceAccess(ctx, undefined, ["Owner"]);
    const docs = (await ctx.db.query("documents").collect())
      .filter((doc) => !doc.itemId && doc.workspaceId === current.workspaceId)
      .slice(0, args.limit ?? 50);
    let migrated = 0;

    for (const doc of docs) {
      const docVersions = (
        await ctx.db
          .query("documentVersions")
          .withIndex("by_document", (q) => q.eq("documentId", doc._id))
          .collect()
      ).sort(
        (a, b) =>
          (a.versionNumber ?? a._creationTime) - (b.versionNumber ?? b._creationTime),
      );
      const firstVersion = docVersions[0];

      const { itemId, versionId } = await createItemWithVersion(ctx, {
        workspaceId: doc.workspaceId,
        departmentId: doc.departmentTag,
        title: doc.title,
        kind: documentKindToItemKind(doc.kind as DocumentKind | undefined),
        status: doc.isArchived ? "draft" : doc.status === "finalized" ? "finalized" : "draft",
        source: "migration",
        author: doc.author,
        summary: doc.summary,
        content: firstVersion?.content,
        format: "markdown",
        traceId: doc.traceId,
        createdAt: doc.createdAt ?? doc._creationTime,
      });

      await ctx.db.patch(doc._id, { itemId });
      await ctx.db.patch(itemId, {
        legacyDocumentId: doc._id,
        status: doc.isArchived ? "archived" : "active",
        versionCount: doc.versionCount ?? 1,
        updatedAt: doc.updatedAt ?? doc._creationTime,
      });
      let currentItemVersionId = firstVersion?._id === doc.currentVersionId ? versionId : undefined;
      if (firstVersion) {
        await ctx.db.patch(firstVersion._id, { itemVersionId: versionId });
        await ctx.db.patch(versionId, { legacyDocumentVersionId: firstVersion._id });
      }

      for (const docVersion of docVersions.slice(1)) {
        const nextItemVersionId = await appendItemVersion(ctx, {
          itemId,
          summary: docVersion.summary,
          content: docVersion.content,
          format: "markdown",
          createdBy: docVersion.createdBy ?? doc.author,
          createdAt: docVersion.createdAt ?? docVersion._creationTime,
        });
        await ctx.db.patch(docVersion._id, { itemVersionId: nextItemVersionId });
        await ctx.db.patch(nextItemVersionId, { legacyDocumentVersionId: docVersion._id });
        if (docVersion._id === doc.currentVersionId) {
          currentItemVersionId = nextItemVersionId;
        }
      }
      await ctx.db.patch(itemId, {
        status: doc.isArchived ? "archived" : "active",
        versionCount: docVersions.length || (doc.versionCount ?? 1),
        updatedAt: doc.updatedAt ?? doc._creationTime,
      });
      if (currentItemVersionId) {
        await ctx.db.patch(itemId, { currentVersionId: currentItemVersionId });
      }
      migrated++;
    }

    return { migrated };
  },
});
