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
      .map((m: any) => `${m.role === "user" ? "Human" : agent.name}: ${m.content}`)
      .join("\n");

    const capabilityToTier: Record<string, number> = {
      triage: 1, coding: 3, reasoning: 4, "long-context": 3, creative: 2,
    };
    const tier = capabilityToTier[agent.routingRequest] ?? 1;

    const systemPrompt = `${agent.systemPrompt}\n\nYou are in CHAT MODE. This is a read-only conversation with the founder. Help them understand, plan, and think through problems. You cannot execute tasks or make changes in this mode.\n\nConversation so far:\n${historyContext}`;

    const { executeAITask } = await import("./ai");
    let response: string;
    try {
      response = await executeAITask(tier, systemPrompt, args.content);
    } catch (error: any) {
      response = `[AI Error] ${error?.message ?? "Failed to get response. Check API keys in Settings."}`;
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      agentName: args.agentName,
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

export const updateSessionTimestamp = internalMutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastMessageAt: Date.now() });
  },
});
