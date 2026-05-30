import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { actorFromIdentity, ensureDocWorkspace, requireCurrentUser, requireWorkspaceAccess } from "./authz";
import { recordAuditEvent } from "./audit";

// =========================================================================
// QUERIES
// =========================================================================

export const getDepartments = query({
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("departments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

export const getAgentsByDepartment = query({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const department = ensureDocWorkspace(await ctx.db.get(args.departmentId), workspaceId, "Department");
    return await ctx.db
      .query("agents")
      .withIndex("by_department", (q) => q.eq("departmentId", department._id))
      .collect();
  },
});

export const getAllAgents = query({
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const departments = await ctx.db
      .query("departments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const departmentIds = new Set(departments.map((department) => department._id));
    return (await ctx.db.query("agents").collect()).filter((agent) =>
      departmentIds.has(agent.departmentId),
    );
  },
});

export const getPlaybooksByDepartment = query({
  args: { departmentId: v.id("departments") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const department = ensureDocWorkspace(await ctx.db.get(args.departmentId), workspaceId, "Department");
    return await ctx.db
      .query("playbooks")
      .withIndex("by_department", (q) => q.eq("departmentId", department._id))
      .collect();
  },
});

export const getAllPlaybooks = query({
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const departments = await ctx.db
      .query("departments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const departmentIds = new Set(departments.map((department) => department._id));
    return (await ctx.db.query("playbooks").collect()).filter((playbook) =>
      departmentIds.has(playbook.departmentId),
    );
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
    const current = await requireCurrentUser(ctx);
    const departmentId = await ctx.db.insert("departments", {
      workspaceId: current.workspaceId,
      name: args.name,
      icon: args.icon,
      description: args.description,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "department.created",
      resourceType: "department",
      resourceId: String(departmentId),
      summary: `Created department ${args.name}.`,
    });
    return departmentId;
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
    const department = await ctx.db.get(args.departmentId);
    if (!department?.workspaceId) throw new Error("Department not found.");
    const current = await requireWorkspaceAccess(ctx, department.workspaceId, ["Owner"]);
    const agentId = await ctx.db.insert("agents", {
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
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: department.workspaceId,
      action: "agent.hired",
      resourceType: "agent",
      resourceId: String(agentId),
      summary: `Added ${args.name}.`,
    });
    return agentId;
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
    const department = await ctx.db.get(args.departmentId);
    if (!department?.workspaceId) throw new Error("Department not found.");
    await requireWorkspaceAccess(ctx, department.workspaceId, ["Owner", "Contributor"]);
    return await ctx.db.insert("playbooks", {
      name: args.name,
      departmentId: args.departmentId,
      description: args.description,
      taskMatrix: args.taskMatrix,
    });
  },
});
