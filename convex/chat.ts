import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const createSession = mutation({
  args: {
    agentId: v.id("agents"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatSessions", {
      title: args.title,
      agentId: args.agentId,
      lastMessageAt: Date.now(),
    });
  },
});

export const getSessions = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("chatSessions")
      .withIndex("by_lastMessage")
      .order("desc")
      .take(20);
  },
});

export const getMessages = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const sendMessage = action({
  args: {
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
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
      });
      libraryContext = context.text;
    } catch {
      libraryContext = "Workspace context is unavailable right now.";
    }

    const capabilityToTier: Record<string, number> = {
      triage: 1, coding: 3, reasoning: 4, "long-context": 3, creative: 2,
    };
    const tier = capabilityToTier[agent.routingRequest] ?? 1;

    const systemPrompt = `${agent.systemPrompt}\n\nYou are in CHAT MODE. This is a read-only conversation with the founder. Help them understand, plan, and think through problems. You cannot execute tasks, create outputs, schedule work, publish, send messages, or make changes in this mode. If the founder wants work performed, help them shape a clear task instead.\n\nRelevant workspace context:\n${libraryContext}\n\nConversation so far:\n${historyContext}`;

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

export const deleteSession = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.delete(args.sessionId);
  },
});

export const updateSessionTimestamp = internalMutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastMessageAt: Date.now() });
  },
});
