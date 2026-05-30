import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { appendItemVersion } from "./itemModel";
import {
  approvalRequestRunPatch,
  classifyTaskObjective,
  normalizePlainWorkerMessage,
  type SensitiveActionKind,
  type TaskClassification,
} from "./taskRuntime";
import { ensureDocWorkspace, requireCurrentUser } from "./authz";
import { recordAuditEvent } from "./audit";

const contextualActionKind = v.union(
  v.literal("question"),
  v.literal("edit"),
  v.literal("variant"),
  v.literal("summarize"),
  v.literal("add_section"),
  v.literal("polish"),
  v.literal("related_context"),
  v.literal("start_task"),
);

type ContextualActionKind =
  | "question"
  | "edit"
  | "variant"
  | "summarize"
  | "add_section"
  | "polish"
  | "related_context"
  | "start_task";

type ItemSnapshot = {
  item: Doc<"items">;
  currentVersion: Doc<"itemVersions"> | null;
  content: string;
  facts: Doc<"facts">[];
  relatedItems: Doc<"items">[];
};

const sensitiveActionPatterns: Array<[SensitiveActionKind, RegExp]> = [
  ["send_email", /\b(send|email|mail|outreach|reply)\b/i],
  ["create_calendar_event", /\b(calendar|schedule|invite|meeting)\b/i],
  ["post_externally", /\b(post|publish).*\b(linkedin|twitter|x|facebook|instagram|social|external)\b/i],
  ["publish_preview", /\b(publish|share|make public|public preview)\b/i],
  ["spend_money", /\b(spend|buy|purchase|subscribe|pay|charge|budget)\b/i],
  ["delete_data", /\b(delete|remove|erase|purge)\b/i],
  ["change_live_asset", /\b(live|production|deploy|change live|update live)\b/i],
];

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanDisplayText(value?: string | null) {
  return (value ?? "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\bRAG\b|\bAI Router\b|\bTOOL_INVOCATION\b/gi, "")
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/---+/g, "")
    .replace(/\*{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimForPrompt(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit).trim()}...` : normalized;
}

function summarizeFallback(content: string) {
  const sentences = cleanDisplayText(content)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  return sentences || "No content is saved on this item yet.";
}

function fallbackRevision(args: {
  actionKind: ContextualActionKind;
  instruction: string;
  currentContent: string;
}) {
  const content = args.currentContent.trim();
  if (args.actionKind === "summarize") {
    return {
      summary: "Summarized from the current Library item.",
      content: `# Summary\n\n${summarizeFallback(content)}`,
      changeNote: "Prepared a summary from the saved content.",
    };
  }

  if (args.actionKind === "add_section") {
    return {
      summary: "Added a requested section.",
      content: [content, "", "## Added section", "", args.instruction].filter(Boolean).join("\n"),
      changeNote: "Added a section from the request.",
    };
  }

  if (args.actionKind === "variant") {
    return {
      summary: "Created a variant from the current item.",
      content: [`# Variant`, "", content, "", "## Variant direction", "", args.instruction].join("\n"),
      changeNote: "Created a variant draft.",
    };
  }

  return {
    summary: "Updated from the contextual item assistant.",
    content: [content, "", "Revision note:", args.instruction].filter(Boolean).join("\n"),
    changeNote: "Captured the requested change as a new version.",
  };
}

function searchTextFor(args: {
  item: Doc<"items">;
  title?: string;
  summary?: string;
  content?: string;
  instruction?: string;
  contextText?: string;
}) {
  return [
    args.title ?? args.item.title,
    args.summary ?? args.item.summary,
    args.content,
    args.item.kind,
    args.item.source,
    args.item.tags?.join(" "),
    args.item.sourceUrl,
    args.instruction,
    args.contextText,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function detectSensitiveAction(text: string): SensitiveActionKind | undefined {
  return sensitiveActionPatterns.find(([, pattern]) => pattern.test(text))?.[0];
}

function actionInstruction(kind: ContextualActionKind, instruction: string) {
  if (kind === "variant") return `Create a distinct but faithful variant. Direction: ${instruction}`;
  if (kind === "summarize") return `Summarize the item into a concise, useful version. Direction: ${instruction || "general summary"}`;
  if (kind === "add_section") return `Add a well-integrated section. Section request: ${instruction}`;
  if (kind === "polish") return `Polish the copy without changing core meaning. Direction: ${instruction || "make it clearer and more polished"}`;
  return instruction;
}

function replyForVersion(args: {
  actionKind: ContextualActionKind;
  title: string;
  versionNumber: number;
  changeNote: string;
  usedFallback?: boolean;
}) {
  const actionLabels: Record<ContextualActionKind, string> = {
    question: "Answered",
    edit: "Updated",
    variant: "Created a variant",
    summarize: "Summarized",
    add_section: "Added a section",
    polish: "Polished",
    related_context: "Found context",
    start_task: "Started a task",
  };

  return `${actionLabels[args.actionKind]} "${args.title}" and saved version ${args.versionNumber}. ${args.changeNote}${
    args.usedFallback ? " The AI service was unavailable, so I used a local fallback." : ""
  }`;
}

async function chooseAssignedAgent(
  ctx: MutationCtx,
  classification: TaskClassification,
  workspaceId?: Id<"workspaces">,
): Promise<Doc<"agents"> | null> {
  const departments = workspaceId
    ? await ctx.db
        .query("departments")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .collect()
    : [];
  const departmentIds = new Set(departments.map((department) => department._id));
  const agents = (await ctx.db.query("agents").collect()).filter((agent) =>
    departmentIds.has(agent.departmentId),
  );
  if (agents.length === 0) return null;

  const preferredRouting: Record<TaskClassification["workerKind"], Array<Doc<"agents">["routingRequest"]>> = {
    builder: ["coding", "reasoning"],
    document: ["long-context", "reasoning", "triage"],
    design: ["creative", "reasoning"],
    communications: ["triage", "creative", "reasoning"],
    generic: ["triage", "reasoning"],
  };

  return (
    agents.find((agent) => preferredRouting[classification.workerKind].includes(agent.routingRequest)) ??
    agents.find((agent) => agent.isActive) ??
    agents[0]
  );
}

function autonomyForClassification(classification: TaskClassification): 1 | 2 | 3 {
  if (classification.workerKind === "builder") return 3;
  if (classification.requiresReview) return 2;
  return 1;
}

export const run = action({
  args: {
    itemId: v.id("items"),
    actionKind: contextualActionKind,
    instruction: v.string(),
    includeRelatedContext: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    reply: string;
    mode: "answer" | "version" | "task";
    versionId?: Id<"itemVersions">;
    versionNumber?: number;
    directiveId?: Id<"directives">;
    runId?: Id<"workRuns">;
    approvalRequired?: boolean;
    href?: string;
  }> => {
    await ctx.runQuery(internal.itemAi.authorizeItemForAction, {
      itemId: args.itemId,
    });
    const snapshot = await ctx.runQuery(internal.itemAi.getItemSnapshot, {
      itemId: args.itemId,
    });
    if (!snapshot) throw new Error("Item not found.");

    const queryText = args.instruction.trim() || snapshot.item.title;
    const relatedContext = await ctx.runAction(internal.search.retrieveContext, {
      queryText,
      itemId: args.itemId,
      limit: args.includeRelatedContext === false ? 4 : 10,
      workspaceId: snapshot.item.workspaceId,
    });

    if (args.actionKind === "start_task") {
      const task = await ctx.runMutation(internal.itemAi.startTaskFromItem, {
        itemId: args.itemId,
        instruction: args.instruction,
        contextText: relatedContext.text,
      });
      return {
        mode: "task",
        reply: task.approvalRequired
          ? `Started "${task.title}" from this item and queued an approval before anything external can happen.`
          : `Started "${task.title}" from this item.`,
        directiveId: task.directiveId,
        runId: task.runId,
        approvalRequired: task.approvalRequired,
        href: `/?task=${task.directiveId}`,
      };
    }

    if (args.actionKind === "question" || args.actionKind === "related_context") {
      const systemPrompt = [
        `You are the contextual Library item assistant.`,
        `Scope: answer only using this Library item and explicitly related workspace context.`,
        `Do not create tasks, perform external actions, or edit saved content in this mode.`,
        `If the founder asks for work to be performed, explain that they should use Start task from this item.`,
      ].join("\n");
      const userPrompt = [
        `Item title: ${snapshot.item.title}`,
        `Item summary: ${snapshot.item.summary ?? snapshot.currentVersion?.summary ?? "No summary"}`,
        `Current item content:\n${trimForPrompt(snapshot.content, 5000)}`,
        "",
        `Related context:\n${relatedContext.text}`,
        "",
        `Founder question: ${args.instruction}`,
      ].join("\n");

      try {
        const { executeChat } = await import("./ai");
        const result = await executeChat({
          tier: args.actionKind === "related_context" ? 3 : 1,
          systemPrompt,
          userPrompt,
          onUsage: async (usage) => {
            await ctx.runMutation(internal.telemetry.logEvent, {
              traceId: args.itemId,
              actor: "assistant: contextual item AI",
              eventType: "AI_REQUEST",
              rawPayload: {
                useCase: usage.useCase,
                mode: "item_context",
                actionKind: args.actionKind,
                readOnly: true,
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
          },
        });
        return { mode: "answer", reply: result.content };
      } catch {
        const related = relatedContext.groups
          .flatMap((group) => group.results.slice(0, 2).map((result) => `${group.label}: ${result.title}`))
          .slice(0, 5)
          .join("; ");
        return {
          mode: "answer",
          reply: [
            `I’m scoped to "${cleanDisplayText(snapshot.item.title)}".`,
            snapshot.item.summary ? `Saved summary: ${cleanDisplayText(snapshot.item.summary)}` : summarizeFallback(snapshot.content),
            related ? `Related context: ${related}.` : "",
          ].filter(Boolean).join(" "),
        };
      }
    }

    const editInstruction = actionInstruction(args.actionKind, args.instruction);
    let revision: { title?: string; summary: string; content: string; changeNote: string };
    let usedFallback = false;

    try {
      const { editItemContent } = await import("./ai");
      const result = await editItemContent({
        title: snapshot.item.title,
        currentContent: snapshot.content,
        instruction: [
          editInstruction,
          args.includeRelatedContext === false
            ? ""
            : `Use this related context for grounding only. Do not paste it into the item unless the founder explicitly asks for it:\n${relatedContext.text}`,
        ].filter(Boolean).join("\n\n"),
        onUsage: async (usage) => {
          await ctx.runMutation(internal.telemetry.logEvent, {
            traceId: args.itemId,
            actor: "assistant: contextual item AI",
            eventType: "AI_REQUEST",
            rawPayload: {
              useCase: usage.useCase,
              mode: "item_context",
              actionKind: args.actionKind,
              readOnly: false,
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
        },
      });
      revision = result.parsed ?? fallbackRevision({
        actionKind: args.actionKind,
        instruction: editInstruction,
        currentContent: snapshot.content,
      });
    } catch {
      usedFallback = true;
      revision = fallbackRevision({
        actionKind: args.actionKind,
        instruction: editInstruction,
        currentContent: snapshot.content,
      });
    }

    let embedding: number[] | undefined;
    try {
      const { executeEmbedding } = await import("./ai");
      embedding = await executeEmbedding([
        revision.title ?? snapshot.item.title,
        revision.summary,
        revision.content,
        relatedContext.text,
      ].join("\n"));
    } catch {
      embedding = undefined;
    }

    const version = await ctx.runMutation(internal.itemAi.createRevision, {
      itemId: args.itemId,
      title: revision.title,
      summary: revision.summary,
      content: revision.content,
      format: snapshot.currentVersion?.format ?? "markdown",
      actionKind: args.actionKind,
      instruction: args.instruction,
      changeNote: revision.changeNote,
      contextText: relatedContext.text,
      embedding,
    });

    return {
      mode: "version",
      reply: replyForVersion({
        actionKind: args.actionKind,
        title: revision.title ?? snapshot.item.title,
        versionNumber: version.versionNumber,
        changeNote: revision.changeNote,
        usedFallback,
      }),
      versionId: version.versionId,
      versionNumber: version.versionNumber,
      href: `/library/${args.itemId}`,
    };
  },
});

export const authorizeItemForAction = internalQuery({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    ensureDocWorkspace(await ctx.db.get(args.itemId), workspaceId, "Item");
    return { workspaceId };
  },
});

export const getItemSnapshot = internalQuery({
  args: { itemId: v.id("items") },
  handler: async (ctx, args): Promise<ItemSnapshot | null> => {
    const item = await ctx.db.get(args.itemId);
    if (!item || item.status === "archived" || item.status === "deprecated") return null;
    const currentVersion = item.currentVersionId ? await ctx.db.get(item.currentVersionId) : null;
    const versions = await ctx.db
      .query("itemVersions")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
    const latestVersion =
      currentVersion ??
      versions.sort((a, b) => b.versionNumber - a.versionNumber)[0] ??
      null;
    const facts = await ctx.db
      .query("facts")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();
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

    return {
      item,
      currentVersion: latestVersion,
      content: latestVersion?.content ?? "",
      facts,
      relatedItems,
    };
  },
});

export const createRevision = internalMutation({
  args: {
    itemId: v.id("items"),
    title: v.optional(v.string()),
    summary: v.string(),
    content: v.string(),
    format: v.optional(v.union(v.literal("markdown"), v.literal("plain_text"), v.literal("html"), v.literal("json"), v.literal("binary"), v.literal("external"))),
    actionKind: contextualActionKind,
    instruction: v.string(),
    changeNote: v.string(),
    contextText: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item || item.status === "archived" || item.status === "deprecated") {
      throw new Error("Item not found.");
    }
    if (!item.workspaceId) throw new Error("Item workspace is missing.");

    const now = Date.now();
    const versionId = await appendItemVersion(ctx, {
      itemId: args.itemId,
      title: args.title,
      summary: args.summary,
      content: args.content,
      format: args.format ?? "markdown",
      createdBy: "FounderOS",
      metadata: {
        actionKind: args.actionKind,
        instruction: args.instruction,
        changeNote: args.changeNote,
        searchText: searchTextFor({
          item,
          title: args.title,
          summary: args.summary,
          content: args.content,
          instruction: args.instruction,
          contextText: args.contextText,
        }),
      },
    });

    const version = await ctx.db.get(versionId);
    if (!version) throw new Error("Version not found.");
    const searchText = searchTextFor({
      item,
      title: args.title,
      summary: args.summary,
      content: args.content,
      instruction: args.instruction,
      contextText: args.contextText,
    });

    await ctx.db.patch(versionId, {
      ...(args.embedding ? { embedding: args.embedding } : {}),
      sizeBytes: new TextEncoder().encode(args.content).length,
    });
    await ctx.db.patch(args.itemId, {
      metadata: {
        ...metadataObject(item.metadata),
        searchText,
        lastContextualAIAction: {
          actionKind: args.actionKind,
          instruction: args.instruction,
          changeNote: args.changeNote,
          versionId,
          at: now,
        },
      },
      updatedAt: now,
    });

    if (item.legacyDocumentId) {
      const document = await ctx.db.get(item.legacyDocumentId);
      if (document && !document.isArchived) {
        const documentVersions = await ctx.db
          .query("documentVersions")
          .withIndex("by_document", (q) => q.eq("documentId", item.legacyDocumentId!))
          .collect();
        const documentVersionNumber = documentVersions.length + 1;
        const documentVersionId = await ctx.db.insert("documentVersions", {
          documentId: item.legacyDocumentId,
          itemVersionId: versionId,
          content: args.content,
          versionNumber: documentVersionNumber,
          createdAt: now,
          createdBy: "FounderOS",
          summary: args.summary,
        });
        await ctx.db.patch(item.legacyDocumentId, {
          currentVersionId: documentVersionId,
          title: args.title ?? item.title,
          summary: args.summary,
          versionCount: documentVersionNumber,
          updatedAt: now,
        });
        await ctx.db.patch(versionId, { legacyDocumentVersionId: documentVersionId });
      }
    }

    await recordAuditEvent(ctx, {
      actorId: "system",
      actorName: "FounderOS",
      actorType: "system",
      workspaceId: item.workspaceId,
      action: "item.ai_revision_created",
      resourceType: "item",
      resourceId: String(args.itemId),
      summary: `Created AI revision for ${item.title}.`,
      metadata: { versionId, actionKind: args.actionKind },
    });

    return {
      versionId,
      versionNumber: version.versionNumber,
    };
  },
});

export const startTaskFromItem = internalMutation({
  args: {
    itemId: v.id("items"),
    instruction: v.string(),
    contextText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item || item.status === "archived" || item.status === "deprecated") {
      throw new Error("Item not found.");
    }

    const currentVersion = item.currentVersionId ? await ctx.db.get(item.currentVersionId) : null;
    const title = `From ${cleanDisplayText(item.title).slice(0, 72)}: ${cleanDisplayText(args.instruction).slice(0, 60) || "New task"}`;
    const objective = [
      args.instruction,
      "",
      `Started from Library item: ${item.title}`,
      item.summary ? `Item summary: ${item.summary}` : "",
      currentVersion?.content ? `Current item content:\n${trimForPrompt(currentVersion.content, 1800)}` : "",
      args.contextText ? `Related context:\n${trimForPrompt(args.contextText, 1800)}` : "",
    ].filter(Boolean).join("\n");
    const classification = classifyTaskObjective({ title, objective });
    const assignedAgent = await chooseAssignedAgent(ctx, classification, item.workspaceId);
    const now = Date.now();
    const directiveId = await ctx.db.insert("directives", {
      workspaceId: item.workspaceId,
      title,
      objective,
      status: "pending_spec",
    });
    const taskId = await ctx.db.insert("tasks", {
      workspaceId: item.workspaceId,
      directiveId,
      title,
      description: objective,
      ...(assignedAgent ? { assignedAgentId: assignedAgent._id } : {}),
      status: "queued",
      autonomyLevel: autonomyForClassification(classification),
      dependencies: [],
      classification,
      workerKind: classification.workerKind,
      retryCount: 0,
      updatedAt: now,
    });
    const runId = await ctx.db.insert("workRuns", {
      workspaceId: item.workspaceId,
      directiveId,
      taskId,
      kind: classification.runKind,
      workerKind: classification.workerKind,
      classification,
      status: "queued",
      title,
      summary: `Started from Library item: ${item.title}`,
      internalNotes: `Source item: ${args.itemId}`,
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("itemRelations", {
      workspaceId: item.workspaceId,
      fromItemId: args.itemId,
      relationType: "used_by",
      summary: `Used to start task: ${title}`,
      createdBy: "FounderOS",
      createdAt: now,
    });

    const sensitiveActionKind = detectSensitiveAction(args.instruction);
    if (sensitiveActionKind) {
      await ctx.db.patch(runId, approvalRequestRunPatch(now));
      await ctx.db.patch(taskId, {
        status: "shadow_pending",
        updatedAt: now,
      });
      await ctx.db.patch(directiveId, {
        status: "awaiting_approval",
      });
      await ctx.db.insert("approvalQueue", {
        type: "integration_gate",
        directiveId,
        taskId,
        runId,
        actionKind: sensitiveActionKind,
        actionTitle: title,
        actionDescription: `Approve before FounderOS performs this external or sensitive action from "${item.title}".`,
        actionPayload: {
          sourceItemId: args.itemId,
          instruction: args.instruction,
        },
        status: "pending",
        autonomyLevel: 3,
        createdAt: now,
        auditHistory: [
          {
            event: "requested",
            at: now,
            actor: "FounderOS",
            actionKind: sensitiveActionKind,
            message: title,
          },
        ],
      });
      await ctx.db.insert("workRunUpdates", {
        runId,
        message: normalizePlainWorkerMessage(`Waiting for approval: ${title}`),
        tone: "blocked",
        createdAt: now,
      });
    } else {
      await ctx.db.insert("workRunUpdates", {
        runId,
        message: normalizePlainWorkerMessage("I've added this to your workspace and tied it to the Library item."),
        tone: "info",
        createdAt: now,
      });
    }

    await recordAuditEvent(ctx, {
      actorId: "system",
      actorName: "FounderOS",
      actorType: "system",
      workspaceId: item.workspaceId,
      action: "item.task_started",
      resourceType: "item",
      resourceId: String(args.itemId),
      summary: `Started task from Library item: ${item.title}.`,
      metadata: { directiveId, runId, approvalRequired: Boolean(sensitiveActionKind) },
    });

    return {
      title,
      directiveId,
      runId,
      approvalRequired: Boolean(sensitiveActionKind),
    };
  },
});
