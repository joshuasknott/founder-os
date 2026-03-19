import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getPending = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("approval_queue")
      .withIndex("by_status", (q) => q.eq("status", "Pending"))
      .collect();

    // Join agent name and role for each item
    const enriched = await Promise.all(
      items.map(async (item) => {
        const agent = await ctx.db.get(item.agentId);
        return {
          ...item,
          agentName: agent?.name ?? "Unknown Agent",
          agentRole: agent?.role ?? "",
        };
      })
    );

    return enriched;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const process = mutation({
  args: {
    taskId: v.id("approval_queue"),
    newStatus: v.union(v.literal("Approved"), v.literal("Denied")),
    workspaceId: v.id("workspaces"),
    actorId: v.string(),
  },
  handler: async (ctx, { taskId, newStatus, workspaceId, actorId }) => {
    const item = await ctx.db.get(taskId);
    if (!item) return;

    // Update the approval queue record
    await ctx.db.patch(taskId, { status: newStatus });

    // Append to the immutable event ledger
    await ctx.db.insert("event_ledger", {
      workspaceId,
      actorType: "Human",
      actorId,
      action: newStatus === "Approved" ? "approve_task" : "deny_task",
      displayLabel: `${newStatus}: ${item.title}`,
      targetResource: taskId,
      timestamp: Date.now(),
    });
  },
});
