import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").collect();
  },
});

export const listSchedule = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("scheduleItems").withIndex("by_start").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    outcome: v.string(),
    departmentId: v.optional(v.id("departments")),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const department = args.departmentId ? await ctx.db.get(args.departmentId) : null;
    const workspace = department?.workspaceId
      ? await ctx.db.get(department.workspaceId)
      : await ctx.db.query("workspaces").first();
    const now = Date.now();

    return await ctx.db.insert("projects", {
      workspaceId: workspace?._id,
      departmentId: args.departmentId,
      name: args.name,
      outcome: args.outcome,
      status: "planned",
      dueAt: args.dueAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const schedule = mutation({
  args: {
    title: v.string(),
    startAt: v.number(),
    kind: v.union(
      v.literal("follow_up"),
      v.literal("review"),
      v.literal("deadline"),
      v.literal("meeting"),
    ),
    departmentId: v.optional(v.id("departments")),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const department = args.departmentId ? await ctx.db.get(args.departmentId) : null;
    const workspace = department?.workspaceId
      ? await ctx.db.get(department.workspaceId)
      : await ctx.db.query("workspaces").first();

    return await ctx.db.insert("scheduleItems", {
      workspaceId: workspace?._id,
      departmentId: args.departmentId,
      projectId: args.projectId,
      title: args.title,
      kind: args.kind,
      status: "scheduled",
      startAt: args.startAt,
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    projectId: v.id("projects"),
    status: v.union(
      v.literal("planned"),
      v.literal("active"),
      v.literal("waiting"),
      v.literal("complete"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});
