import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// =========================================================================
// QUERIES
// =========================================================================

export const getDepartments = query({
  handler: async (ctx) => {
    return await ctx.db.query("departments").collect();
  },
});

export const getAgentsByDepartment = query({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_department", (q) => q.eq("departmentId", args.departmentId))
      .collect();
  },
});

export const getAllAgents = query({
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

export const getPlaybooksByDepartment = query({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("playbooks")
      .withIndex("by_department", (q) => q.eq("departmentId", args.departmentId))
      .collect();
  },
});

export const getAllPlaybooks = query({
  handler: async (ctx) => {
    return await ctx.db.query("playbooks").collect();
  },
});

// =========================================================================
// MUTATIONS (Swarm Studio CRUD)
// =========================================================================

export const createDepartment = mutation({
  args: {
    name: v.string(),
    icon: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("departments", {
      name: args.name,
      icon: args.icon,
      description: args.description,
    });
  },
});

export const hireAgent = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    description: v.string(),
    systemPrompt: v.string(),
    avatar: v.string(),
    departmentId: v.id("departments"),
    routingRequest: v.union(
      v.literal("triage"),
      v.literal("reasoning"),
      v.literal("coding"),
      v.literal("long-context"),
      v.literal("creative")
    ),
    toolClearance: v.array(v.string()),
    rank: v.union(v.literal("chief"), v.literal("lead"), v.literal("specialist")),
    reportsTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agents", {
      name: args.name,
      role: args.role,
      description: args.description,
      systemPrompt: args.systemPrompt,
      avatar: args.avatar,
      departmentId: args.departmentId,
      routingRequest: args.routingRequest,
      toolClearance: args.toolClearance,
      rank: args.rank,
      reportsTo: args.reportsTo,
      isActive: true,
    });
  },
});

export const createPlaybook = mutation({
  args: {
    name: v.string(),
    departmentId: v.id("departments"),
    description: v.string(),
    taskMatrix: v.array(
      v.object({
        title: v.string(),
        descriptionTemplate: v.string(),
        assignedAgentId: v.string(),
        autonomyLevel: v.number(),
        dependencies: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("playbooks", {
      name: args.name,
      departmentId: args.departmentId,
      description: args.description,
      taskMatrix: args.taskMatrix,
    });
  },
});
