import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  appendItemVersion,
  createItemWithVersion,
  documentKindToItemKind,
} from "./itemModel";

const artifactKind = v.union(
  v.literal("document"),
  v.literal("file"),
  v.literal("website"),
  v.literal("internal_tool"),
  v.literal("tool"),
  v.literal("presentation"),
  v.literal("automation"),
  v.literal("task_output"),
  v.literal("conversation"),
  v.literal("record"),
  v.literal("brief"),
  v.literal("plan"),
);

const legacySeedTitles = new Set([
  "Founder briefing",
  "Website preview request",
  "Launch messaging draft",
]);

function isLegacySeedLibraryItem(doc: { title: string; author: string; traceId?: unknown }) {
  return doc.author === "FounderOS" && doc.traceId === undefined && legacySeedTitles.has(doc.title);
}

export const list = query({
  args: {
    departmentId: v.optional(v.id("departments")),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const docs = args.departmentId
      ? await ctx.db
          .query("documents")
          .withIndex("by_department", (q) => q.eq("departmentTag", args.departmentId!))
          .collect()
      : await ctx.db.query("documents").collect();

    const activeDocs = docs.filter(
      (doc) => (args.includeArchived || !doc.isArchived) && !isLegacySeedLibraryItem(doc),
    );
    const departments = await ctx.db.query("departments").collect();
    const departmentById = new Map(departments.map((department) => [department._id, department]));

    return await Promise.all(
      activeDocs
        .sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime))
        .map(async (doc) => {
          const versions = await ctx.db
            .query("documentVersions")
            .withIndex("by_document", (q) => q.eq("documentId", doc._id))
            .collect();

          const sortedVersions = versions.sort(
            (a, b) => (b.versionNumber ?? b._creationTime) - (a.versionNumber ?? a._creationTime),
          );

          const current =
            (doc.currentVersionId
              ? sortedVersions.find((version) => version._id === doc.currentVersionId)
              : undefined) ?? sortedVersions[0];

          return {
            ...doc,
            departmentName: departmentById.get(doc.departmentTag)?.name ?? "Workspace",
            versionCount: doc.versionCount ?? versions.length,
            currentVersion: current
              ? {
                  _id: current._id,
                  versionNumber: current.versionNumber ?? versions.length,
                  createdAt: current.createdAt ?? current._creationTime,
                  createdBy: current.createdBy ?? doc.author,
                  summary: current.summary,
                  contentPreview: current.content.slice(0, 220),
                }
              : null,
          };
        }),
    );
  },
});

export const getVersions = query({
  args: { artifactId: v.id("documents") },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.artifactId))
      .collect();

    return versions.sort(
      (a, b) => (b.versionNumber ?? b._creationTime) - (a.versionNumber ?? a._creationTime),
    );
  },
});

export const listByTrace = query({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .filter((q) => q.eq(q.field("traceId"), args.directiveId))
      .collect();

    return docs
      .filter((doc) => !doc.isArchived)
      .sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime))
      .map((doc) => ({
        _id: doc._id,
        title: doc.title,
        kind: doc.kind,
        summary: doc.summary,
        versionCount: doc.versionCount ?? 1,
        updatedAt: doc.updatedAt ?? doc._creationTime,
      }));
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    departmentId: v.id("departments"),
    content: v.string(),
    kind: v.optional(artifactKind),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const department = await ctx.db.get(args.departmentId);
    const now = Date.now();
    const kind = args.kind ?? "document";
    const { itemId, versionId: itemVersionId } = await createItemWithVersion(ctx, {
      workspaceId: department?.workspaceId,
      departmentId: args.departmentId,
      title: args.title,
      kind: documentKindToItemKind(kind),
      status: "draft",
      source: "user",
      author: "FounderOS",
      summary: args.summary,
      content: args.content,
      format: "markdown",
      createdAt: now,
    });

    const docId = await ctx.db.insert("documents", {
      workspaceId: department?.workspaceId,
      itemId,
      title: args.title,
      departmentTag: args.departmentId,
      author: "FounderOS",
      kind,
      summary: args.summary,
      status: "draft",
      isArchived: false,
      versionCount: 1,
      createdAt: now,
      updatedAt: now,
    });

    const versionId = await ctx.db.insert("documentVersions", {
      documentId: docId,
      itemVersionId,
      content: args.content,
      versionNumber: 1,
      createdAt: now,
      createdBy: "FounderOS",
      summary: args.summary ?? "Initial version.",
    });

    await ctx.db.patch(docId, { currentVersionId: versionId });
    await ctx.db.patch(itemId, { legacyDocumentId: docId });
    await ctx.db.patch(itemVersionId, { legacyDocumentVersionId: versionId });
    return docId;
  },
});

export const update = mutation({
  args: {
    artifactId: v.id("documents"),
    content: v.string(),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.artifactId);
    if (!doc || doc.isArchived) throw new Error("Library item not found.");

    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.artifactId))
      .collect();

    const versionNumber = versions.length + 1;
    const now = Date.now();
    const itemVersionId = doc.itemId
      ? await appendItemVersion(ctx, {
          itemId: doc.itemId,
          summary: args.summary ?? `Version ${versionNumber}`,
          content: args.content,
          format: "markdown",
          createdBy: "FounderOS",
        })
      : undefined;

    const versionId = await ctx.db.insert("documentVersions", {
      documentId: args.artifactId,
      itemVersionId,
      content: args.content,
      versionNumber,
      createdAt: now,
      createdBy: "FounderOS",
      summary: args.summary ?? `Version ${versionNumber}`,
    });

    await ctx.db.patch(args.artifactId, {
      currentVersionId: versionId,
      versionCount: versionNumber,
      summary: args.summary ?? doc.summary,
      updatedAt: now,
    });

    if (itemVersionId) {
      await ctx.db.patch(itemVersionId, { legacyDocumentVersionId: versionId });
    }

    return versionId;
  },
});

export const remove = mutation({
  args: { artifactId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.artifactId);
    if (!doc) throw new Error("Library item not found.");

    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.artifactId))
      .collect();

    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    if (doc.itemId) {
      const itemVersions = await ctx.db
        .query("itemVersions")
        .withIndex("by_item", (q) => q.eq("itemId", doc.itemId!))
        .collect();
      for (const itemVersion of itemVersions) {
        await ctx.db.delete(itemVersion._id);
      }

      const outgoingRelations = await ctx.db
        .query("itemRelations")
        .withIndex("by_from", (q) => q.eq("fromItemId", doc.itemId!))
        .collect();
      for (const relation of outgoingRelations) {
        await ctx.db.delete(relation._id);
      }

      const incomingRelations = await ctx.db
        .query("itemRelations")
        .withIndex("by_to_item", (q) => q.eq("toItemId", doc.itemId!))
        .collect();
      for (const relation of incomingRelations) {
        await ctx.db.delete(relation._id);
      }

      await ctx.db.delete(doc.itemId);
    }

    await ctx.db.delete(args.artifactId);
  },
});

export const archive = mutation({
  args: { artifactId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.artifactId);
    if (!doc) throw new Error("Library item not found.");
    const now = Date.now();
    await ctx.db.patch(args.artifactId, {
      isArchived: true,
      status: "deprecated",
      deprecatedAt: now,
      updatedAt: now,
    });
    if (doc.itemId) {
      await ctx.db.patch(doc.itemId, {
        status: "archived",
        archivedAt: now,
        updatedAt: now,
      });
    }
  },
});

export const restore = mutation({
  args: { artifactId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.artifactId);
    if (!doc) throw new Error("Library item not found.");
    const now = Date.now();
    await ctx.db.patch(args.artifactId, {
      isArchived: false,
      status: "draft",
      deprecatedAt: undefined,
      updatedAt: now,
    });
    if (doc.itemId) {
      await ctx.db.patch(doc.itemId, {
        status: "active",
        archivedAt: undefined,
        updatedAt: now,
      });
    }
  },
});

export const revert = mutation({
  args: {
    artifactId: v.id("documents"),
    versionId: v.id("documentVersions"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.artifactId);
    const target = await ctx.db.get(args.versionId);
    if (!doc || doc.isArchived || !target || target.documentId !== args.artifactId) {
      throw new Error("Version not found.");
    }

    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.artifactId))
      .collect();

    const versionNumber = versions.length + 1;
    const now = Date.now();
    const itemVersionId = doc.itemId
      ? await appendItemVersion(ctx, {
          itemId: doc.itemId,
          summary: `Restored from version ${target.versionNumber ?? "selected"}.`,
          content: target.content,
          format: "markdown",
          createdBy: "FounderOS",
        })
      : undefined;

    const revertedVersionId = await ctx.db.insert("documentVersions", {
      documentId: args.artifactId,
      itemVersionId,
      content: target.content,
      versionNumber,
      createdAt: now,
      createdBy: "FounderOS",
      summary: `Restored from version ${target.versionNumber ?? "selected"}.`,
    });

    await ctx.db.patch(args.artifactId, {
      currentVersionId: revertedVersionId,
      versionCount: versionNumber,
      updatedAt: now,
    });

    if (itemVersionId) {
      await ctx.db.patch(itemVersionId, { legacyDocumentVersionId: revertedVersionId });
    }

    return revertedVersionId;
  },
});
