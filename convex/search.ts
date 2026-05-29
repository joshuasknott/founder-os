import { internalAction, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";

type GroupId = "library" | "versions" | "chats" | "tasks" | "work" | "facts" | "entities";

type SearchResult = {
  id: string;
  groupId: GroupId;
  title: string;
  excerpt: string;
  label: string;
  href?: string;
  targetType: "item" | "version" | "document" | "chat" | "task" | "work" | "fact" | "entity";
  targetId: string;
  itemId?: Id<"items">;
  updatedAt: number;
};

type ScoredSearchResult = SearchResult & { score: number };

const groupLabels: Record<GroupId, string> = {
  library: "Library",
  versions: "Versions",
  chats: "Chats",
  tasks: "Tasks",
  work: "Work",
  facts: "Saved Facts",
  entities: "People, Companies, Ideas",
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "the",
  "this",
  "to",
  "we",
  "what",
  "with",
]);

function cleanDisplayText(value?: string | null) {
  return (value ?? "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\*\*?Autonomy Level\s*\d+\s*(?:[-\u2013\u2014]\s*[^*]+)?\*\*?/gi, "")
    .replace(/\bAutonomy Level\s*\d+\s*(?:[-\u2013\u2014]\s*[A-Za-z ]+)?/gi, "")
    .replace(/\bRAG\b|\bAI Router\b|\bTOOL_INVOCATION\b/gi, "")
    .replace(/last commit:\s*`?HEAD`?\s*\([^)]*\)/gi, "workspace history is up to date")
    .replace(/\bBuild\/Webhook Activity\b/gi, "Activity")
    .replace(/\bcommit\b/gi, "version")
    .replace(/\bexecute\b/gi, "run")
    .replace(/\bwork\s*runs?\b|\bworkRuns\b/gi, "work")
    .replace(/\bdirectives?\b/gi, "tasks")
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/\boperator(s)?\b/gi, "worker$1")
    .replace(/\brouting\b/gi, "planning")
    .replace(/\bcommand center\b/gi, "workspace")
    .replace(/#{1,6}\s*/g, "")
    .replace(/---+/g, "")
    .replace(/\*{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return cleanDisplayText(value).toLowerCase();
}

function queryTerms(queryText: string) {
  const rawTerms = normalize(queryText)
    .split(/[^a-z0-9@._-]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !stopWords.has(term));
  return Array.from(new Set(rawTerms)).slice(0, 12);
}

function scoreText(text: string, terms: string[], queryText: string) {
  const normalizedText = normalize(text);
  if (!normalizedText || terms.length === 0) return 0;

  let score = 0;
  const normalizedQuery = normalize(queryText);
  if (normalizedQuery.length >= 3 && normalizedText.includes(normalizedQuery)) {
    score += 30 + Math.min(normalizedQuery.length, 40);
  }

  for (const term of terms) {
    if (!normalizedText.includes(term)) continue;
    const matches = normalizedText.match(new RegExp(escapeRegExp(term), "g"))?.length ?? 1;
    score += Math.min(matches, 8) * (term.length >= 5 ? 5 : 3);
    if (normalizedText.startsWith(term)) score += 4;
  }

  return score;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function excerptFrom(text: string, terms: string[], fallback: string) {
  const cleaned = cleanDisplayText(text);
  if (!cleaned) return cleanDisplayText(fallback).slice(0, 220);

  const normalized = cleaned.toLowerCase();
  const firstIndex = terms
    .map((term) => normalized.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstIndex === undefined) return cleaned.slice(0, 220);
  const start = Math.max(0, firstIndex - 70);
  const end = Math.min(cleaned.length, firstIndex + 170);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < cleaned.length ? "..." : "";
  return `${prefix}${cleaned.slice(start, end).trim()}${suffix}`;
}

function itemKindLabel(kind: string) {
  const labels: Record<string, string> = {
    created_output: "Created output",
    upload: "Upload",
    website: "Website",
    deck: "Deck",
    doc: "Document",
    email: "Email",
    contact: "Contact",
    company: "Company",
    decision: "Decision",
    research: "Research",
    automation: "Automation",
    tool: "Tool",
    task_output: "Task output",
    document: "Document",
    file: "File",
    internal_tool: "Tool",
    presentation: "Deck",
    conversation: "Conversation",
    record: "Record",
    brief: "Brief",
    plan: "Plan",
  };
  return labels[kind] ?? kind.replace(/_/g, " ");
}

function sourceLabel(source?: string) {
  const labels: Record<string, string> = {
    user: "Created",
    agent: "Generated",
    upload: "Uploaded",
    website: "Website",
    connector: "Connected",
    migration: "Imported",
    system: "System",
  };
  return source ? labels[source] ?? source : "Workspace";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    active: "Active",
    under_review: "Needs review",
    approved: "Approved",
    finalized: "Final",
    archived: "Archived",
    deprecated: "Archived",
    pending_spec: "Preparing",
    needs_clarification: "Needs details",
    custom_fallback: "Needs details",
    awaiting_approval: "Needs review",
    in_progress: "In progress",
    blocked: "Blocked",
    aborted_by_principal: "Stopped",
    completed: "Completed",
    queued: "Preparing",
    working: "In progress",
    needs_review: "Needs review",
    waiting_for_approval: "Needs approval",
    failed: "Could not finish",
    stopped: "Stopped",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

function metadataText(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const record = metadata as Record<string, unknown>;
  const searchText = record.searchText;
  const parts = [typeof searchText === "string" ? searchText : ""];
  const intake = record.intake;
  if (intake && typeof intake === "object" && !Array.isArray(intake)) {
    const files = (intake as { files?: Array<{ name?: string }> }).files ?? [];
    parts.push(files.map((file) => file.name).filter(Boolean).join(" "));
  }
  return parts.join(" ");
}

function taskHref(task: Doc<"directives">) {
  return task.sessionId ? `/?session=${task.sessionId}&task=${task._id}` : `/?task=${task._id}`;
}

function withoutScore({ score, ...result }: ScoredSearchResult) {
  void score;
  return result;
}

function addCandidate(
  candidates: ScoredSearchResult[],
  result: SearchResult,
  searchableText: string,
  args: {
    terms: string[];
    queryText: string;
    boostItemIds?: Set<string>;
    boostEntityIds?: Set<string>;
    boostTaskIds?: Set<string>;
  },
) {
  const score = scoreText(searchableText, args.terms, args.queryText);
  const relatedBoost =
    (result.itemId && args.boostItemIds?.has(result.itemId)) ||
    args.boostItemIds?.has(result.targetId) ||
    args.boostEntityIds?.has(result.targetId) ||
    args.boostTaskIds?.has(result.targetId)
      ? 20
      : 0;

  if (score <= 0 && relatedBoost <= 0) return;
  candidates.push({ ...result, excerpt: result.excerpt || excerptFrom(searchableText, args.terms, result.title), score: score + relatedBoost });
}

async function relationshipBoosts(ctx: QueryCtx, itemId?: Id<"items">) {
  const boostItemIds = new Set<string>();
  const boostEntityIds = new Set<string>();
  const boostTaskIds = new Set<string>();
  if (!itemId) return { boostItemIds, boostEntityIds, boostTaskIds };

  boostItemIds.add(itemId);
  const item = await ctx.db.get(itemId);
  if (item?.traceId) boostTaskIds.add(item.traceId);
  if (item?.taskId) boostTaskIds.add(item.taskId);
  if (item?.runId) boostTaskIds.add(item.runId);

  const outgoing = await ctx.db
    .query("itemRelations")
    .withIndex("by_from", (q) => q.eq("fromItemId", itemId))
    .collect();
  const incoming = await ctx.db
    .query("itemRelations")
    .withIndex("by_to_item", (q) => q.eq("toItemId", itemId))
    .collect();

  for (const relation of outgoing) {
    if (relation.toItemId) boostItemIds.add(relation.toItemId);
    if (relation.toEntityId) boostEntityIds.add(relation.toEntityId);
  }
  for (const relation of incoming) {
    boostItemIds.add(relation.fromItemId);
  }

  const facts = await ctx.db
    .query("facts")
    .withIndex("by_item", (q) => q.eq("itemId", itemId))
    .collect();
  for (const fact of facts) {
    if (fact.entityId) boostEntityIds.add(fact.entityId);
    if (fact.sourceItemId) boostItemIds.add(fact.sourceItemId);
  }

  return { boostItemIds, boostEntityIds, boostTaskIds };
}

async function buildKeywordResults(
  ctx: QueryCtx,
  args: {
    queryText: string;
    limit: number;
    includeArchived?: boolean;
    itemId?: Id<"items">;
  },
) {
  const terms = queryTerms(args.queryText);
  if (terms.length === 0) return [];

  const candidates: ScoredSearchResult[] = [];
  const boosts = await relationshipBoosts(ctx, args.itemId);

  const [
    items,
    itemVersions,
    documents,
    chatSessions,
    chatMessages,
    directives,
    tasks,
    workRuns,
    workRunUpdates,
    workArtifacts,
    facts,
    entities,
  ] = await Promise.all([
    ctx.db.query("items").collect(),
    ctx.db.query("itemVersions").collect(),
    ctx.db.query("documents").collect(),
    ctx.db.query("chatSessions").collect(),
    ctx.db.query("chatMessages").collect(),
    ctx.db.query("directives").collect(),
    ctx.db.query("tasks").collect(),
    ctx.db.query("workRuns").collect(),
    ctx.db.query("workRunUpdates").collect(),
    ctx.db.query("workArtifacts").collect(),
    ctx.db.query("facts").collect(),
    ctx.db.query("entities").collect(),
  ]);

  const itemsById = new Map<string, Doc<"items">>(items.map((item: Doc<"items">) => [item._id, item]));
  const sessionsById = new Map<string, Doc<"chatSessions">>(chatSessions.map((session: Doc<"chatSessions">) => [session._id, session]));
  const directivesById = new Map<string, Doc<"directives">>(directives.map((directive: Doc<"directives">) => [directive._id, directive]));
  const workRunsById = new Map<string, Doc<"workRuns">>(workRuns.map((run: Doc<"workRuns">) => [run._id, run]));
  const updatesByRunId = new Map<string, Doc<"workRunUpdates">[]>();
  for (const update of workRunUpdates as Doc<"workRunUpdates">[]) {
    updatesByRunId.set(update.runId, [...(updatesByRunId.get(update.runId) ?? []), update]);
  }

  for (const item of items as Doc<"items">[]) {
    if (!args.includeArchived && (item.status === "archived" || item.status === "deprecated")) continue;
    const searchableText = [
      item.title,
      item.summary,
      item.kind,
      item.source,
      item.tags?.join(" "),
      item.sourceUrl,
      metadataText(item.metadata),
    ].join(" ");
    addCandidate(
      candidates,
      {
        id: `item:${item._id}`,
        groupId: "library",
        title: cleanDisplayText(item.title) || "Untitled Library item",
        excerpt: "",
        label: `${itemKindLabel(item.kind)} · ${sourceLabel(item.source)}`,
        href: `/library/${item._id}`,
        targetType: "item",
        targetId: item._id,
        itemId: item._id,
        updatedAt: item.updatedAt ?? item._creationTime,
      },
      searchableText,
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const version of itemVersions as Doc<"itemVersions">[]) {
    const item = itemsById.get(version.itemId);
    if (!item || (!args.includeArchived && (item.status === "archived" || item.status === "deprecated"))) continue;
    const searchableText = [item.title, version.title, version.summary, version.content, version.sourceUrl].join(" ");
    addCandidate(
      candidates,
      {
        id: `version:${version._id}`,
        groupId: "versions",
        title: `${cleanDisplayText(version.title ?? item.title)} · Version ${version.versionNumber}`,
        excerpt: "",
        label: itemKindLabel(item.kind),
        href: `/library/${item._id}`,
        targetType: "version",
        targetId: version._id,
        itemId: item._id,
        updatedAt: version.createdAt ?? version._creationTime,
      },
      searchableText,
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const document of documents as Doc<"documents">[]) {
    if (document.itemId || (!args.includeArchived && document.isArchived)) continue;
    const currentVersion = document.currentVersionId
      ? (await ctx.db.get(document.currentVersionId)) as Doc<"documentVersions"> | null
      : null;
    const searchableText = [document.title, document.summary, document.kind, currentVersion?.content, currentVersion?.summary].join(" ");
    addCandidate(
      candidates,
      {
        id: `document:${document._id}`,
        groupId: "library",
        title: cleanDisplayText(document.title) || "Untitled Library item",
        excerpt: "",
        label: itemKindLabel(document.kind ?? "doc"),
        href: document.itemId ? `/library/${document.itemId}` : `/library?item=${document._id}`,
        targetType: "document",
        targetId: document._id,
        updatedAt: document.updatedAt ?? document._creationTime,
      },
      searchableText,
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const session of chatSessions as Doc<"chatSessions">[]) {
    addCandidate(
      candidates,
      {
        id: `chat:${session._id}`,
        groupId: "chats",
        title: cleanDisplayText(session.title) || "Chat",
        excerpt: "",
        label: "Chat",
        href: `/?session=${session._id}`,
        targetType: "chat",
        targetId: session._id,
        updatedAt: session.lastMessageAt ?? session._creationTime,
      },
      session.title,
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const message of chatMessages as Doc<"chatMessages">[]) {
    const session = sessionsById.get(message.sessionId);
    addCandidate(
      candidates,
      {
        id: `chat-message:${message._id}`,
        groupId: "chats",
        title: cleanDisplayText(session?.title) || "Chat message",
        excerpt: "",
        label: message.role === "user" ? "You" : cleanDisplayText(message.agentName) || "FounderOS",
        href: `/?session=${message.sessionId}`,
        targetType: "chat",
        targetId: message.sessionId,
        updatedAt: message._creationTime,
      },
      [session?.title, message.content, message.agentName].join(" "),
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const directive of directives as Doc<"directives">[]) {
    addCandidate(
      candidates,
      {
        id: `task:${directive._id}`,
        groupId: "tasks",
        title: cleanDisplayText(directive.title) || "Task",
        excerpt: "",
        label: statusLabel(directive.status),
        href: taskHref(directive),
        targetType: "task",
        targetId: directive._id,
        updatedAt: directive._creationTime,
      },
      [directive.title, directive.objective, directive.status].join(" "),
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const task of tasks as Doc<"tasks">[]) {
    const directive = directivesById.get(task.directiveId);
    addCandidate(
      candidates,
      {
        id: `task-step:${task._id}`,
        groupId: "tasks",
        title: cleanDisplayText(task.title) || cleanDisplayText(directive?.title) || "Task detail",
        excerpt: "",
        label: `Task detail · ${statusLabel(task.status)}`,
        href: directive ? taskHref(directive) : `/?task=${task.directiveId}`,
        targetType: "task",
        targetId: task._id,
        updatedAt: task._creationTime,
      },
      [directive?.title, directive?.objective, task.title, task.description, task.status].join(" "),
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const run of workRuns as Doc<"workRuns">[]) {
    const directive = directivesById.get(run.directiveId);
    const updates = (updatesByRunId.get(run._id) ?? []).map((update) => update.message).join(" ");
    addCandidate(
      candidates,
      {
        id: `work:${run._id}`,
        groupId: "work",
        title: cleanDisplayText(run.title) || cleanDisplayText(directive?.title) || "Work",
        excerpt: "",
        label: statusLabel(run.status),
        href: directive ? taskHref(directive) : `/?task=${run.directiveId}`,
        targetType: "work",
        targetId: run._id,
        updatedAt: run.updatedAt ?? run._creationTime,
      },
      [directive?.title, directive?.objective, run.title, run.summary, updates].join(" "),
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const artifact of workArtifacts as Doc<"workArtifacts">[]) {
    const run = workRunsById.get(artifact.runId);
    const directive = artifact.directiveId ? directivesById.get(artifact.directiveId) : run ? directivesById.get(run.directiveId) : undefined;
    addCandidate(
      candidates,
      {
        id: `work-item:${artifact._id}`,
        groupId: "work",
        title: cleanDisplayText(artifact.title) || "Work output",
        excerpt: "",
        label: "Work output",
        href: artifact.libraryItemId
          ? `/library/${artifact.libraryItemId}`
          : directive
            ? taskHref(directive)
            : undefined,
        targetType: "work",
        targetId: artifact._id,
        itemId: artifact.libraryItemId,
        updatedAt: artifact.createdAt ?? artifact._creationTime,
      },
      [artifact.title, artifact.summary, artifact.url].join(" "),
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const fact of facts as Doc<"facts">[]) {
    const itemId = fact.itemId ?? fact.sourceItemId;
    addCandidate(
      candidates,
      {
        id: `fact:${fact._id}`,
        groupId: "facts",
        title: cleanDisplayText(fact.subject) || "Saved fact",
        excerpt: "",
        label: "Fact",
        href: itemId ? `/library/${itemId}` : undefined,
        targetType: "fact",
        targetId: fact._id,
        itemId,
        updatedAt: fact.updatedAt ?? fact._creationTime,
      },
      [fact.subject, fact.predicate, fact.object, JSON.stringify(fact.value ?? "")].join(" "),
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  for (const entity of entities as Doc<"entities">[]) {
    addCandidate(
      candidates,
      {
        id: `entity:${entity._id}`,
        groupId: "entities",
        title: cleanDisplayText(entity.name) || "Saved entity",
        excerpt: "",
        label: entity.type.replace(/_/g, " "),
        href: entity.sourceItemId ? `/library/${entity.sourceItemId}` : undefined,
        targetType: "entity",
        targetId: entity._id,
        itemId: entity.sourceItemId,
        updatedAt: entity.updatedAt ?? entity._creationTime,
      },
      [entity.name, entity.canonicalName, entity.aliases?.join(" "), entity.description, entity.type].join(" "),
      { ...boosts, terms, queryText: args.queryText },
    );
  }

  const bestById = new Map<string, ScoredSearchResult>();
  for (const candidate of candidates) {
    const existing = bestById.get(candidate.id);
    if (!existing || candidate.score > existing.score) bestById.set(candidate.id, candidate);
  }

  return Array.from(bestById.values())
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
    .slice(0, args.limit);
}

function groupResults(results: SearchResult[]) {
  const order: GroupId[] = ["library", "versions", "chats", "tasks", "work", "facts", "entities"];
  return order
    .map((groupId) => ({
      id: groupId,
      label: groupLabels[groupId],
      results: results.filter((result) => result.groupId === groupId),
    }))
    .filter((group) => group.results.length > 0);
}

export const globalSearch = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 40, 1), 80);
    const results = await buildKeywordResults(ctx, {
      queryText: args.query,
      limit,
      includeArchived: args.includeArchived,
    });
    const publicResults = results.map(withoutScore);
    return {
      query: args.query,
      totalCount: publicResults.length,
      groups: groupResults(publicResults),
      searchMode: {
        keyword: true,
        semanticExtension: "available_for_ai_context",
      },
    };
  },
});

export const itemContext = query({
  args: {
    itemId: v.id("items"),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) return null;

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
      (related): related is Doc<"items"> => related !== null,
    );

    const entityIds = Array.from(
      new Set(outgoing.flatMap((relation) => (relation.toEntityId ? [relation.toEntityId] : []))),
    ).slice(0, 8);
    const entities = (await Promise.all(entityIds.map((id) => ctx.db.get(id)))).filter(
      (entity): entity is Doc<"entities"> => entity !== null,
    );

    const facts = await ctx.db
      .query("facts")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    const directive = item.traceId ? await ctx.db.get(item.traceId) : null;
    const sourceTask = item.taskId ? await ctx.db.get(item.taskId) : null;
    const sourceRun = item.runId ? await ctx.db.get(item.runId) : null;

    const queryText = args.query?.trim() || [item.title, item.summary, item.tags?.join(" ")].filter(Boolean).join(" ");
    const suggested = await buildKeywordResults(ctx, {
      queryText,
      itemId: args.itemId,
      limit: args.limit ?? 12,
      includeArchived: false,
    });

    return {
      item: {
        title: cleanDisplayText(item.title),
        summary: cleanDisplayText(item.summary),
      },
      sections: [
        {
          label: "Source",
          items: [
            directive ? { title: cleanDisplayText(directive.title), detail: statusLabel(directive.status), href: taskHref(directive) } : null,
            sourceTask ? { title: cleanDisplayText(sourceTask.title), detail: statusLabel(sourceTask.status), href: directive ? taskHref(directive) : undefined } : null,
            sourceRun ? { title: cleanDisplayText(sourceRun.title), detail: statusLabel(sourceRun.status), href: directive ? taskHref(directive) : undefined } : null,
          ].filter(Boolean),
        },
        {
          label: "Related Library",
          items: relatedItems.map((related) => ({
            title: cleanDisplayText(related.title),
            detail: itemKindLabel(related.kind),
            href: `/library/${related._id}`,
          })),
        },
        {
          label: "People, Companies, Ideas",
          items: entities.map((entity) => ({
            title: cleanDisplayText(entity.name),
            detail: entity.type.replace(/_/g, " "),
            href: entity.sourceItemId ? `/library/${entity.sourceItemId}` : undefined,
          })),
        },
        {
          label: "Saved Facts",
          items: facts.slice(0, 8).map((fact) => ({
            title: cleanDisplayText(fact.subject),
            detail: cleanDisplayText(`${fact.predicate.replace(/_/g, " ")} ${fact.object}`),
            href: fact.sourceItemId ? `/library/${fact.sourceItemId}` : undefined,
          })),
        },
        {
          label: "Suggested Context",
          items: suggested
            .filter((result) => result.itemId !== args.itemId)
            .slice(0, 6)
            .map((result) => ({
              title: result.title,
              detail: result.excerpt || result.label,
              href: result.href,
            })),
        },
      ].filter((section) => section.items.length > 0),
    };
  },
});

export const keywordContext = internalQuery({
  args: {
    queryText: v.string(),
    itemId: v.optional(v.id("items")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await buildKeywordResults(ctx, {
      queryText: args.queryText,
      itemId: args.itemId,
      limit: args.limit ?? 12,
      includeArchived: false,
    });
    return {
      groups: groupResults(results.map(withoutScore)),
    };
  },
});

export const getItemVersionsByIds = internalQuery({
  args: { ids: v.array(v.id("itemVersions")) },
  handler: async (ctx, args) => {
    return await Promise.all(args.ids.map((id) => ctx.db.get(id)));
  },
});

export const getItemsByIds = internalQuery({
  args: { ids: v.array(v.id("items")) },
  handler: async (ctx, args) => {
    return await Promise.all(args.ids.map((id) => ctx.db.get(id)));
  },
});

export const retrieveContext = internalAction({
  args: {
    queryText: v.string(),
    itemId: v.optional(v.id("items")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    text: string;
    groups: Array<{ id: string; label: string; results: SearchResult[] }>;
    semanticMatches: Array<{ title: string; content: string }>;
  }> => {
    const limit = args.limit ?? 8;
    const keyword = await ctx.runQuery(internal.search.keywordContext, {
      queryText: args.queryText,
      itemId: args.itemId,
      limit,
    });

    const semanticMatches: Array<{ title: string; content: string }> = [];
    try {
      const { executeEmbedding } = await import("./ai");
      const vector = await executeEmbedding(args.queryText);
      const itemHits = await ctx.vectorSearch("itemVersions", "by_embedding", {
        vector,
        limit: Math.min(limit, 6),
      });
      const versions = await ctx.runQuery(internal.search.getItemVersionsByIds, {
        ids: itemHits.map((hit) => hit._id),
      });
      const itemIds = Array.from(
        new Set(
          versions
            .filter((version): version is Doc<"itemVersions"> => version !== null)
            .map((version) => version.itemId),
        ),
      );
      const items = await ctx.runQuery(internal.search.getItemsByIds, { ids: itemIds });
      const itemsById = new Map(
        items.filter((item): item is Doc<"items"> => item !== null).map((item) => [item._id, item]),
      );

      for (const version of versions) {
        if (!version) continue;
        const item = itemsById.get(version.itemId);
        if (!item || item.status === "archived" || item.status === "deprecated") continue;
        semanticMatches.push({
          title: cleanDisplayText(version.title ?? item.title),
          content: cleanDisplayText([version.summary, version.content].filter(Boolean).join("\n")).slice(0, 1200),
        });
      }
    } catch {
      // Keyword retrieval remains the dependable baseline when embeddings are not available.
    }

    try {
      const documentMatches = await ctx.runAction(internal.memory.queryMemory, {
        queryText: args.queryText,
        limit: Math.min(limit, 4),
      });
      for (const match of documentMatches) {
        semanticMatches.push({
          title: cleanDisplayText(match.title),
          content: cleanDisplayText(match.content).slice(0, 1200),
        });
      }
    } catch {
      // Existing document embeddings are optional context, not a hard dependency.
    }

    const keywordLines = keyword.groups.flatMap((group) =>
      group.results.slice(0, 4).map((result) => `- ${group.label}: ${result.title}${result.excerpt ? ` — ${result.excerpt}` : ""}`),
    );
    const semanticLines = semanticMatches
      .slice(0, 6)
      .map((match) => `- Library: ${match.title}${match.content ? ` — ${match.content}` : ""}`);

    return {
      text: [
        keywordLines.length ? "Relevant workspace context:\n" + keywordLines.join("\n") : "",
        semanticLines.length ? "Additional Library context:\n" + semanticLines.join("\n") : "",
      ]
        .filter(Boolean)
        .join("\n\n") || "No relevant workspace context found.",
      groups: keyword.groups,
      semanticMatches,
    };
  },
});
