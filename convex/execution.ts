import { action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";

// =========================================================================
// INTERNAL HELPERS (used by actions in this file)
// =========================================================================

export const getAgentById = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId);
  },
});

export const getPlaybookById = internalQuery({
  args: { playbookId: v.id("playbooks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.playbookId);
  },
});

export const getActiveAgentsByDepartment = internalQuery({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    const agents = await ctx.db
      .query("agents")
      .withIndex("by_department", (q) => q.eq("departmentId", args.departmentId))
      .collect();
    return agents.filter((a) => a.isActive);
  },
});

export const createPlaybookTask = internalMutation({
  args: {
    directiveId: v.id("directives"),
    agentId: v.id("agents"),
    specMarkdown: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Push spec to approval queue as a spec_gate
    await ctx.db.insert("approvalQueue", {
      type: "spec_gate",
      directiveId: args.directiveId,
      status: "pending",
      autonomyLevel: 3 as 1 | 2 | 3,
    });

    // 2. Transition directive to awaiting_approval
    await ctx.db.patch(args.directiveId, { status: "awaiting_approval" });

    // 3. Log the state transition via sanitized telemetry writer
    await ctx.scheduler.runAfter(0, internal.telemetry.logEvent, {
      traceId: args.directiveId,
      actor: "agent: Orion",
      eventType: "STATE_TRANSITION" as const,
      rawPayload: {
        transition: "pending_spec → awaiting_approval",
        specLength: args.specMarkdown.length,
      },
    });

    return args.directiveId;
  },
});

// =========================================================================
// LEVEL 1: Ad-Hoc Ping (Direct chat with a single agent, no approvals)
// =========================================================================

export const adHocPing = action({
  args: {
    agentId: v.id("agents"),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized: Principal identity required");

    // 1. Fetch agent from DB
    const agent = await ctx.runQuery(internal.execution.getAgentById, {
      agentId: args.agentId,
    });

    if (!agent) {
      return "[Error] Agent not found.";
    }

    if (!agent.isActive) {
      return `[Error] Agent "${agent.name}" is currently deactivated.`;
    }

    // 2. Route to the AI router using the agent's routingRequest capability
    //    Map capability class → tier for the legacy AI router
    const capabilityToTier: Record<string, number> = {
      triage: 1,
      coding: 3,
      reasoning: 4,
      "long-context": 3,
      creative: 2,
    };

    const tier = capabilityToTier[agent.routingRequest] ?? 1;

    const { executeAITask } = await import("./ai");
    const response = await executeAITask(tier, agent.systemPrompt, args.message);

    return response;
  },
});

// =========================================================================
// LEVEL 2: Playbook Execution (Scoped workflow, routes to approval queue)
// =========================================================================

export const triggerPlaybook = action({
  args: {
    playbookId: v.id("playbooks"),
    context: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized: Principal identity required");

    // 1. Fetch playbook from DB
    const playbook = await ctx.runQuery(internal.execution.getPlaybookById, {
      playbookId: args.playbookId,
    });

    if (!playbook) {
      return "[Error] Playbook not found.";
    }

    // 2. Fetch department agents
    const agents = await ctx.runQuery(
      internal.execution.getActiveAgentsByDepartment,
      { departmentId: playbook.departmentId }
    );

    // 3. Build the prompt using routingRequest capability instead of model
    const agentRoster = agents
      .map((agent) => `- ${agent.name} (${agent.role}, capability: ${agent.routingRequest})`)
      .join("\n");

    const steps = playbook.taskMatrix
      .map((t: { title: string; descriptionTemplate: string; assignedAgentId: string; autonomyLevel: number; dependencies: string[] }, i: number) => 
        `${i + 1}. [${t.title}] ${t.descriptionTemplate} (Agent: ${t.assignedAgentId}, Autonomy: Level ${t.autonomyLevel})`
      )
      .join("\n");

    const systemPrompt = `You are a department-level orchestrator executing the "${playbook.name}" playbook. You have the following agents available:\n${agentRoster}\n\nThe playbook steps are:\n${steps}\n\nWrite a detailed, scoped implementation spec that assigns each step to the most appropriate agent. Be specific about what each agent should do.`;

    const userPrompt = `Context from the founder:\n${args.context}`;

    // 4. Call the AI (Tier 1 for routing)
    const { executeAITask } = await import("./ai");
    const specMarkdown = await executeAITask(1, systemPrompt, userPrompt);

    return specMarkdown;
  },
});
