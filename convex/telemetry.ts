import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { ensureDocWorkspace, requireCurrentUser } from "./authz";

// =========================================================================
// SENSITIVE KEY PATTERNS — keys whose values must be redacted before logging
// =========================================================================

const SENSITIVE_KEYS = new Set([
  "apikey",
  "api_key",
  "token",
  "secret",
  "password",
  "authorization",
  "credential",
  "private_key",
  "privatekey",
  "access_token",
  "refresh_token",
  "webhook_secret",
  "bot_token",
]);

/**
 * Recursively sanitize a payload object, redacting values for sensitive keys.
 * Handles nested objects and arrays. Returns a new object (never mutates input).
 */
function sanitizePayload(input: unknown): unknown {
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) {
    return input.map((item) => sanitizePayload(item));
  }

  if (typeof input === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizePayload(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return input;
}

// =========================================================================
// QUERIES
// =========================================================================

export const getRecentLogs = query({
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("observabilityLogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(50);
  },
});

export const getLogsByDirective = query({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    ensureDocWorkspace(await ctx.db.get(args.directiveId), workspaceId, "Task");
    return await ctx.db
      .query("observabilityLogs")
      .withIndex("by_traceId", (q) => q.eq("traceId", args.directiveId))
      .order("desc")
      .collect();
  },
});

// =========================================================================
// logEvent — Immutable, sanitized observability log writer
//
// This is the ONLY sanctioned way to write to `observabilityLogs`.
// All backend actions and mutations must route through this function
// to ensure consistent sanitization and cost attribution.
// =========================================================================

export const logEvent = internalMutation({
  args: {
    traceId: v.union(v.id("directives"), v.string()),
    actor: v.string(),
    eventType: v.union(
      v.literal("STATE_TRANSITION"),
      v.literal("TOOL_INVOCATION"),
      v.literal("AI_REQUEST"),
      v.literal("RAG_QUERY"),
      v.literal("ERROR_ESCALATION"),
      v.literal("SYSTEM_HALT")
    ),
    rawPayload: v.any(),
    metrics: v.optional(
      v.object({
        latencyMs: v.number(),
        tokensUsed: v.number(),
        model: v.optional(v.string()),
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        costUSD: v.optional(v.number()),
        useCase: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Sanitize the raw payload — strip API keys, tokens, secrets
    const sanitized = sanitizePayload(args.rawPayload);
    const payload = JSON.stringify(sanitized);

    // 2. Build the metrics object for the schema
    const metrics = args.metrics
      ? {
          latencyMs: args.metrics.latencyMs,
          tokensUsed: args.metrics.tokensUsed,
          model: args.metrics.model,
          inputTokens: args.metrics.inputTokens,
          outputTokens: args.metrics.outputTokens,
          costUSD: args.metrics.costUSD,
          useCase: args.metrics.useCase,
        }
      : undefined;

    // 3. Insert the immutable log entry
    let workspaceId: Id<"workspaces"> | undefined;
    try {
      const directive = await ctx.db.get(args.traceId as Id<"directives">);
      workspaceId = directive?.workspaceId;
    } catch {
      workspaceId = undefined;
    }
    await ctx.db.insert("observabilityLogs", {
      workspaceId,
      traceId: args.traceId,
      actor: args.actor,
      eventType: args.eventType,
      payload,
      ...(metrics && { metrics }),
    });
  },
});
