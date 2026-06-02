import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export type ItemKind =
  | "created_output"
  | "upload"
  | "website"
  | "deck"
  | "doc"
  | "email"
  | "contact"
  | "company"
  | "decision"
  | "research"
  | "automation"
  | "tool"
  | "task_output"
  | "document"
  | "file"
  | "internal_tool"
  | "presentation"
  | "conversation"
  | "record"
  | "brief"
  | "plan";

export type DocumentKind =
  | "document"
  | "file"
  | "website"
  | "internal_tool"
  | "tool"
  | "presentation"
  | "automation"
  | "task_output"
  | "conversation"
  | "record"
  | "brief"
  | "plan";

export type ReusableTraceItem = {
  _id: Id<"items">;
  status: string;
  updatedAt: number;
  legacyDocumentId?: Id<"documents">;
};

export function selectReusableTraceItem(items: ReusableTraceItem[]) {
  return items
    .filter((item) => item.status !== "archived" && item.status !== "deprecated")
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

export function reviewStatusForLibraryOutput(metadata?: unknown) {
  const value = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
  return value.needsReview === true ? "under_review" as const : "draft" as const;
}

export function documentKindToItemKind(kind?: DocumentKind): ItemKind {
  if (kind === "file") return "upload";
  if (kind === "presentation") return "deck";
  if (kind === "document") return "doc";
  if (kind === "internal_tool") return "tool";
  return kind ?? "doc";
}

export function itemKindToDocumentKind(kind: ItemKind): DocumentKind {
  if (kind === "upload") return "file";
  if (kind === "deck") return "presentation";
  if (kind === "doc" || kind === "created_output" || kind === "email" || kind === "decision" || kind === "research") {
    return "document";
  }
  if (kind === "contact" || kind === "company") return "record";
  if (kind === "tool" || kind === "internal_tool") return "tool";
  if (kind === "website") return "website";
  if (kind === "automation") return "automation";
  if (kind === "task_output") return "task_output";
  if (kind === "conversation") return "conversation";
  if (kind === "brief") return "brief";
  if (kind === "plan") return "plan";
  if (kind === "file") return "file";
  if (kind === "presentation") return "presentation";
  if (kind === "record") return "record";
  return "document";
}

export async function createItemWithVersion(
  ctx: MutationCtx,
  args: {
    workspaceId?: Id<"workspaces">;
    departmentId?: Id<"departments">;
    title: string;
    kind: ItemKind;
    status?: "draft" | "active" | "under_review" | "approved" | "finalized";
    source?: "user" | "agent" | "upload" | "website" | "connector" | "migration" | "system";
    author?: string;
    summary?: string;
    content?: string;
    format?: "markdown" | "plain_text" | "html" | "json" | "binary" | "external";
    traceId?: Id<"directives">;
    taskId?: Id<"tasks">;
    runId?: Id<"workRuns">;
    sourceUrl?: string;
    externalId?: string;
    storageId?: Id<"_storage">;
    mimeType?: string;
    tags?: string[];
    metadata?: unknown;
    createdAt?: number;
  },
) {
  const now = args.createdAt ?? Date.now();
  const itemId = await ctx.db.insert("items", {
    workspaceId: args.workspaceId,
    departmentId: args.departmentId,
    title: args.title,
    kind: args.kind,
    status: args.status ?? "draft",
    source: args.source ?? "user",
    author: args.author,
    summary: args.summary,
    versionCount: 1,
    traceId: args.traceId,
    taskId: args.taskId,
    runId: args.runId,
    sourceUrl: args.sourceUrl,
    externalId: args.externalId,
    storageId: args.storageId,
    mimeType: args.mimeType,
    tags: args.tags,
    metadata: args.metadata,
    createdAt: now,
    updatedAt: now,
  });

  const versionId = await ctx.db.insert("itemVersions", {
    itemId,
    versionNumber: 1,
    title: args.title,
    summary: args.summary,
    content: args.content,
    format: args.format ?? (args.content ? "markdown" : "external"),
    sourceUrl: args.sourceUrl,
    storageId: args.storageId,
    mimeType: args.mimeType,
    createdBy: args.author,
    createdAt: now,
    metadata: args.metadata,
  });

  await ctx.db.patch(itemId, { currentVersionId: versionId });
  return { itemId, versionId };
}

export async function appendItemVersion(
  ctx: MutationCtx,
  args: {
    itemId: Id<"items">;
    title?: string;
    summary?: string;
    content?: string;
    format?: "markdown" | "plain_text" | "html" | "json" | "binary" | "external";
    sourceUrl?: string;
    storageId?: Id<"_storage">;
    mimeType?: string;
    createdBy?: string;
    createdAt?: number;
    metadata?: unknown;
  },
) {
  const item = await ctx.db.get(args.itemId);
  if (!item || item.status === "archived" || item.status === "deprecated") {
    throw new Error("Item not found.");
  }

  const versions = await ctx.db
    .query("itemVersions")
    .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
    .collect();

  const versionNumber = versions.length + 1;
  const now = args.createdAt ?? Date.now();
  const versionId = await ctx.db.insert("itemVersions", {
    itemId: args.itemId,
    versionNumber,
    title: args.title,
    summary: args.summary,
    content: args.content,
    format: args.format ?? (args.content ? "markdown" : "external"),
    sourceUrl: args.sourceUrl,
    storageId: args.storageId,
    mimeType: args.mimeType,
    createdBy: args.createdBy,
    createdAt: now,
    metadata: args.metadata,
  });

  await ctx.db.patch(args.itemId, {
    currentVersionId: versionId,
    versionCount: versionNumber,
    title: args.title ?? item.title,
    summary: args.summary ?? item.summary,
    updatedAt: now,
  });

  return versionId;
}
