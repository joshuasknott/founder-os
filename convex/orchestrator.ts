import { internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const autoDispatchPlaybook = internalMutation({
  args: {
    directiveId: v.id("directives"),
    playbookId: v.id("playbooks"),
  },
  handler: async (ctx, args) => {
    const playbook = await ctx.db.get(args.playbookId);
    if (!playbook) throw new Error("Playbook not found");

    await ctx.db.patch(args.directiveId, { status: "in_progress" });

    await ctx.scheduler.runAfter(0, internal.telemetry.logEvent, {
      traceId: args.directiveId,
      actor: "agent: Orion",
      eventType: "STATE_TRANSITION" as const,
      rawPayload: {
        transition: "pending_spec → in_progress",
        message: `Orion auto-dispatching Playbook: ${playbook.name}`,
      },
    });

    await ctx.scheduler.runAfter(0, internal.engine.dispatchDirective, {
      directiveId: args.directiveId,
      taskMatrix: JSON.stringify(playbook.taskMatrix),
    });
  },
});

export const requireClarification = internalMutation({
  args: {
    directiveId: v.id("directives"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.directiveId, { status: "needs_clarification" });

    const directive = await ctx.db.get(args.directiveId);
    if (directive?.sessionId) {
      await ctx.db.insert("chatMessages", {
        sessionId: directive.sessionId,
        role: "assistant",
        agentName: "FounderOS",
        content: `I need one detail before continuing:\n\n${args.message}`,
      });
      await ctx.db.patch(directive.sessionId, { lastMessageAt: Date.now() });
    }
    
    await ctx.scheduler.runAfter(0, internal.telemetry.logEvent, {
      traceId: args.directiveId,
      actor: "agent: Orion",
      eventType: "STATE_TRANSITION" as const,
      rawPayload: {
        transition: "pending_spec → needs_clarification",
        message: args.message,
      },
    });
  }
});

export const initializePlaybook = action({
  args: {
    directiveId: v.id("directives"),
    directiveTitle: v.string(),
    directiveObjective: v.string(),
  },
  handler: async (ctx, args) => {
    // Determine the appropriate playbook
    const playbooks = await ctx.runQuery(internal.orchestrator.getAllPlaybooks, {});

    // MUST EXTRACT CONTEXT VIA RAG
    const results = await ctx.runAction(internal.memory.queryMemory, {
      queryText: `Directive: ${args.directiveTitle}\n${args.directiveObjective}`,
      limit: 5,
    });

    let ragContext = "No relevant context found.";
    if (results && results.length > 0) {
      ragContext = results.map((result, i) => `[Context ${i + 1}: ${result.title}]\n${result.content}`).join("\n\n");
    }

    const systemPrompt = `You are Orion, Chief of Staff. Map the founder's directive to an existing strict Playbook.
    
    AVAILABLE PLAYBOOKS:
    ${JSON.stringify(playbooks, null, 2)}
    
    SYSTEM CONTEXT (RAG):
    ${ragContext}
    
    INSTRUCTIONS:
    1. Select the Playbook that perfectly fits the directive.
    2. Make "Safe Assumptions" for minor context gaps.
    3. If CRITICAL context is missing such that no playbook can be safely mapped or executed, output exactly the string: NEEDS_CLARIFICATION followed by the specific questions you need answered.
    4. Otherwise, return only the ID of the chosen playbook. Do not markdown it.`;

    const userPrompt = `## Directive: ${args.directiveTitle}\n\n${args.directiveObjective}`;

    const { executeAITask } = await import("./ai");
    const result = await executeAITask(1, systemPrompt, userPrompt);
    const cleanedResult = result.trim();

    if (cleanedResult.startsWith("NEEDS_CLARIFICATION")) {
      const questions = cleanedResult.replace("NEEDS_CLARIFICATION", "").trim() || "The directive is ambiguous. Please provide more context.";
      await ctx.runMutation(internal.orchestrator.requireClarification, {
        directiveId: args.directiveId,
        message: questions,
      });
      return;
    }

    const matchedPlaybook = playbooks.find(p => p._id === cleanedResult);

    if (!matchedPlaybook) {
      await ctx.runMutation(internal.orchestrator.requireClarification, {
        directiveId: args.directiveId,
        message: `Failed to map accurately. AI returned invalid payload: ${cleanedResult}`,
      });
      return;
    }

    await ctx.runMutation(internal.orchestrator.autoDispatchPlaybook, {
      directiveId: args.directiveId,
      playbookId: matchedPlaybook._id,
    });
  },
});

export const getAllPlaybooks = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pbs = await ctx.db.query("playbooks").collect();
    return pbs.map(p => ({
      _id: p._id,
      name: p.name,
      description: p.description
    }));
  },
});
