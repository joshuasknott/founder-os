import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { actorFromIdentity, ensureDocWorkspace, requireCurrentUser } from "./authz";
import { recordAuditEvent } from "./audit";
import { tierForModelProfile } from "./modelProfiles";

export const createSession = mutation({
  args: {
    agentId: v.id("agents"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found.");
    const department = await ctx.db.get(agent.departmentId);
    ensureDocWorkspace(department, current.workspaceId, "Department");

    const sessionId = await ctx.db.insert("chatSessions", {
      workspaceId: current.workspaceId,
      userId: current.user._id,
      title: args.title,
      agentId: args.agentId,
      lastMessageAt: Date.now(),
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "chat.created",
      resourceType: "chatSession",
      resourceId: String(sessionId),
      summary: `Started chat: ${args.title}.`,
    });
    return sessionId;
  },
});

export const getSessions = query({
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("chatSessions")
      .withIndex("by_workspace_lastMessage", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(20);
  },
});

export const getMessages = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const session = ensureDocWorkspace(await ctx.db.get(args.sessionId), workspaceId, "Chat");
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
  },
});

export const sendMessage = action({
  args: {
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
    content: v.string(),
    modelProfile: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authorization = await ctx.runQuery(internal.chat.authorizeSessionForAction, {
      sessionId: args.sessionId,
      agentId: args.agentId,
    });

    await ctx.runMutation(internal.chat.storeMessage, {
      sessionId: args.sessionId,
      role: "user",
      content: args.content,
    });

    const agent = await ctx.runQuery(internal.chat.getAgentById, {
      agentId: args.agentId,
    });

    if (!agent) {
      await ctx.runMutation(internal.chat.storeMessage, {
        sessionId: args.sessionId,
        role: "assistant",
        content: "[Error] Agent not found.",
        agentName: "System",
      });
      return;
    }

    const history = await ctx.runQuery(internal.chat.getRecentHistory, {
      sessionId: args.sessionId,
    });

    const historyContext = history
      .map((message) => `${message.role === "user" ? "Human" : agent.name}: ${message.content}`)
      .join("\n");

    let libraryContext = "No relevant workspace context found.";
    try {
      const context = await ctx.runAction(internal.search.retrieveContext, {
        queryText: args.content,
        limit: 8,
        workspaceId: authorization.workspaceId,
      });
      libraryContext = context.text;
    } catch {
      libraryContext = "Workspace context is unavailable right now.";
    }
    let connectorContext = "";
    try {
      const context = await ctx.runAction(api.connectors.readGoogleWorkspaceContext, {
        workspaceId: authorization.workspaceId,
        queryText: args.content,
        requestedBy: `chat:${agent.name}`,
      });
      connectorContext = context.text && !context.text.startsWith("No matching")
        ? `\n\n${context.text}`
        : "";
    } catch {
      connectorContext = "";
    }

    const capabilityToTier: Record<string, number> = {
      triage: 1, coding: 3, reasoning: 4, "long-context": 3, creative: 2,
    };
    const autoTier = capabilityToTier[agent.routingRequest] ?? 1;
    const tier = tierForModelProfile(args.modelProfile, autoTier);

    const systemPrompt = `${agent.systemPrompt}\n\nYou are in CHAT MODE. This is a read-only conversation with the founder. Help them understand, plan, and think through problems. You may use read-only connected service context when it is provided, but you cannot execute tasks, create outputs, schedule work, publish, send messages, or make changes in this mode. If the founder wants work performed, help them shape a clear task instead.\n\nRelevant workspace context:\n${libraryContext}${connectorContext}\n\nConversation so far:\n${historyContext}`;

    const { executeChat, safeAIErrorMessage } = await import("./ai");
    let response: string;
    try {
      const result = await executeChat({
        tier,
        systemPrompt,
        userPrompt: args.content,
        onUsage: async (usage) => {
          await ctx.runMutation(internal.telemetry.logEvent, {
            traceId: args.sessionId as string,
            actor: `agent: ${agent.name}`,
            eventType: "AI_REQUEST",
            rawPayload: {
              useCase: usage.useCase,
              mode: "chat",
              readOnly: true,
              modelProfile: args.modelProfile ?? "auto",
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
      response = result.content;
    } catch (error: unknown) {
      response = safeAIErrorMessage(error);
    }

    await ctx.runMutation(internal.chat.storeMessage, {
      sessionId: args.sessionId,
      role: "assistant",
      content: response,
      agentName: agent.name,
    });

    await ctx.runMutation(internal.chat.updateSessionTimestamp, {
      sessionId: args.sessionId,
    });
  },
});

export const storeMessage = internalMutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    agentName: v.optional(v.string()),
    card: v.optional(
      v.object({
        type: v.union(v.literal("task_result"), v.literal("item_navigation")),
        title: v.string(),
        summary: v.optional(v.string()),
        href: v.optional(v.string()),
        label: v.optional(v.string()),
        itemId: v.optional(v.id("items")),
        documentId: v.optional(v.id("documents")),
        runId: v.optional(v.id("workRuns")),
        directiveId: v.optional(v.id("directives")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      agentName: args.agentName,
      card: args.card,
    });
  },
});

export const getAgentById = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => await ctx.db.get(args.agentId),
});

export const getRecentHistory = internalQuery({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return messages.slice(-20);
  },
});

export const authorizeSessionForAction = internalQuery({
  args: {
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const session = ensureDocWorkspace(await ctx.db.get(args.sessionId), workspaceId, "Chat");
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found.");
    const department = await ctx.db.get(agent.departmentId);
    ensureDocWorkspace(department, workspaceId, "Department");
    return { sessionId: session._id, workspaceId };
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");
    const current = await requireCurrentUser(ctx);
    ensureDocWorkspace(session, current.workspaceId, "Chat");

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.delete(args.sessionId);
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "chat.deleted",
      resourceType: "chatSession",
      resourceId: String(args.sessionId),
      summary: `Deleted chat: ${session.title}.`,
    });
  },
});

export const updateSessionTimestamp = internalMutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastMessageAt: Date.now() });
  },
});
