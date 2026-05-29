import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const cadence = v.union(
  v.literal("once"),
  v.literal("daily"),
  v.literal("weekdays"),
  v.literal("weekly"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("scheduleItems").withIndex("by_start").collect();

    return items
      .filter((item) => item.kind === "automation" && item.status === "scheduled")
      .sort((a, b) => a.startAt - b.startAt);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    prompt: v.string(),
    startAt: v.number(),
    cadence,
  },
  handler: async (ctx, args) => {
    const workspace = await ctx.db.query("workspaces").first();
    const internalArea = await ctx.db.query("departments").first();
    const now = Date.now();

    return await ctx.db.insert("scheduleItems", {
      workspaceId: workspace?._id,
      departmentId: internalArea?._id,
      title: args.title,
      kind: "automation",
      status: "scheduled",
      startAt: args.startAt,
      prompt: args.prompt,
      cadence: args.cadence,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const pause = mutation({
  args: { automationId: v.id("scheduleItems") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.automationId, {
      status: "skipped",
      updatedAt: Date.now(),
    });
  },
});

