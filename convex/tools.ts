import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// =========================================================================
// L3 TOOL ERROR (Atlas Debug Protocol)
// =========================================================================
export class L3ToolError extends Error {
  constructor(public toolName: string, public failedPayload: any, message: string) {
    super(message);
    this.name = "L3ToolError";
  }
}

// =========================================================================
// THE TOOL REGISTRY (Doc 6 §3)
//
// Every tool is registered with a strict anatomical structure:
//   - Name & Description
//   - Clearance Level (role required to invoke)
//   - Autonomy Tier (L1 = autonomous, L2 = shadow, L3 = hard gate)
// =========================================================================

export type AutonomyTier = 1 | 2 | 3;

interface ToolDefinition {
  name: string;
  description: string;
  clearanceLevel: string;
  autonomyTier: AutonomyTier;
  category: "internal" | "external";
}

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // -----------------------------------------------------------------------
  // INTERNAL TOOLS (L1 / L2) — Convex-only, no external side effects
  // -----------------------------------------------------------------------
  "memory.query": {
    name: "memory.query",
    description: "Query the Sovereign Knowledge Vault via RAG vector search",
    clearanceLevel: "specialist",
    autonomyTier: 1,
    category: "internal",
  },
  "task.markCompleted": {
    name: "task.markCompleted",
    description: "Mark a task as completed and wake downstream dependencies",
    clearanceLevel: "specialist",
    autonomyTier: 1,
    category: "internal",
  },
  "task.delegate": {
    name: "task.delegate",
    description: "Delegate a sub-task to another agent within the DAG",
    clearanceLevel: "lead",
    autonomyTier: 1,
    category: "internal",
  },
  "observability.log": {
    name: "observability.log",
    description: "Write a sanitized entry to the observabilityLogs table",
    clearanceLevel: "specialist",
    autonomyTier: 1,
    category: "internal",
  },
  "budget.allocate": {
    name: "budget.allocate",
    description: "Allocate or reallocate token budget for a directive",
    clearanceLevel: "lead",
    autonomyTier: 2,
    category: "internal",
  },
  "sandbox.executeTest": {
    name: "sandbox.executeTest",
    description: "Execute code in an isolated sandbox environment for verification",
    clearanceLevel: "specialist",
    autonomyTier: 1,
    category: "internal",
  },
  "debug.diagnose": {
    name: "debug.diagnose",
    description: "Analyze L3 tool failure logs and generate a rectified payload sequence",
    clearanceLevel: "specialist",
    autonomyTier: 1,
    category: "internal",
  },

  // -----------------------------------------------------------------------
  // EXTERNAL TOOLS (L3) — Hard Gate required, touches outside world
  // -----------------------------------------------------------------------
  "source.mutate": {
    name: "source.mutate",
    description: "Push code changes to an external repository (e.g., GitHub)",
    clearanceLevel: "lead",
    autonomyTier: 3,
    category: "external",
  },
  "deploy.trigger": {
    name: "deploy.trigger",
    description: "Trigger a deployment to staging or production (e.g., Vercel)",
    clearanceLevel: "chief",
    autonomyTier: 3,
    category: "external",
  },
  "api.externalCall": {
    name: "api.externalCall",
    description: "Make an authenticated call to a gated external API",
    clearanceLevel: "lead",
    autonomyTier: 3,
    category: "external",
  },
};

// =========================================================================
// CLEARANCE HIERARCHY
// specialist < lead < chief — a higher rank can always use lower-tier tools
// =========================================================================

const RANK_HIERARCHY: Record<string, number> = {
  specialist: 1,
  lead: 2,
  chief: 3,
};

function hasRequiredClearance(
  agentRank: string | undefined,
  requiredLevel: string
): boolean {
  const agentPower = RANK_HIERARCHY[agentRank ?? "specialist"] ?? 0;
  const requiredPower = RANK_HIERARCHY[requiredLevel] ?? 999;
  return agentPower >= requiredPower;
}

// =========================================================================
// HELPER: Fetch an agent by ID (for clearance validation)
// =========================================================================

export const getAgentForClearance = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) return null;
    return {
      name: agent.name,
      rank: agent.rank,
      toolClearance: agent.toolClearance,
    };
  },
});

// =========================================================================
// invokeTool — Validates clearance before routing tool execution
//
// This is the ONLY sanctioned entry point for agent tool access.
// =========================================================================

export const invokeTool = internalAction({
  args: {
    agentId: v.id("agents"),
    toolName: v.string(),
    directiveId: v.id("directives"),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    // 1. Validate the tool exists in the registry
    const tool = TOOL_REGISTRY[args.toolName];
    if (!tool) {
      await ctx.runMutation(internal.telemetry.logEvent, {
        traceId: args.directiveId,
        actor: `system: ToolRegistry`,
        eventType: "ERROR_ESCALATION" as const,
        rawPayload: {
          error: "TOOL_NOT_FOUND",
          toolName: args.toolName,
          agentId: args.agentId,
        },
      });
      throw new Error(`Tool "${args.toolName}" is not registered.`);
    }

    // 2. Fetch agent and validate clearance
    const agent = await ctx.runQuery(internal.tools.getAgentForClearance, {
      agentId: args.agentId,
    });

    if (!agent) {
      throw new Error("Agent not found.");
    }

    // Check tool-specific clearance from agent's toolClearance array
    if (!agent.toolClearance.includes(args.toolName)) {
      await ctx.runMutation(internal.telemetry.logEvent, {
        traceId: args.directiveId,
        actor: `agent: ${agent.name}`,
        eventType: "ERROR_ESCALATION" as const,
        rawPayload: {
          error: "CLEARANCE_DENIED",
          toolName: args.toolName,
          agentRank: agent.rank,
          requiredClearance: tool.clearanceLevel,
          message: `Agent "${agent.name}" does not have "${args.toolName}" in their toolClearance array.`,
        },
      });
      throw new Error(
        `Clearance denied: Agent "${agent.name}" is not authorized to invoke "${args.toolName}".`
      );
    }

    // Check rank hierarchy clearance
    if (!hasRequiredClearance(agent.rank, tool.clearanceLevel)) {
      await ctx.runMutation(internal.telemetry.logEvent, {
        traceId: args.directiveId,
        actor: `agent: ${agent.name}`,
        eventType: "ERROR_ESCALATION" as const,
        rawPayload: {
          error: "RANK_INSUFFICIENT",
          toolName: args.toolName,
          agentRank: agent.rank,
          requiredClearance: tool.clearanceLevel,
        },
      });
      throw new Error(
        `Rank insufficient: Agent "${agent.name}" (rank: ${agent.rank}) cannot invoke "${args.toolName}" (requires: ${tool.clearanceLevel}).`
      );
    }

    // 3. Log the successful invocation
    await ctx.runMutation(internal.telemetry.logEvent, {
      traceId: args.directiveId,
      actor: `agent: ${agent.name}`,
      eventType: "TOOL_INVOCATION" as const,
      rawPayload: {
        toolName: args.toolName,
        autonomyTier: tool.autonomyTier,
        category: tool.category,
        payload: args.payload,
      },
    });

    // 4. Return the validated tool metadata for the caller (engine.ts) to act on
    return {
      toolName: tool.name,
      autonomyTier: tool.autonomyTier,
      category: tool.category,
      clearanceVerified: true,
    };
  },
});
