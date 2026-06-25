import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { actorFromIdentity, ensureDocWorkspace, requireCurrentUser, requireWorkspaceAccess } from "./authz";
import { recordAuditEvent } from "./audit";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(200);
  },
});

export const listSchedule = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("scheduleItems")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(200);
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
    const current = await requireCurrentUser(ctx);
    const department = args.departmentId ? await ctx.db.get(args.departmentId) : null;
    if (department) ensureDocWorkspace(department, current.workspaceId, "Department");
    const now = Date.now();

    const projectId = await ctx.db.insert("projects", {
      workspaceId: current.workspaceId,
      departmentId: args.departmentId,
      name: args.name,
      outcome: args.outcome,
      status: "planned",
      dueAt: args.dueAt,
      createdAt: now,
      updatedAt: now,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "project.created",
      resourceType: "project",
      resourceId: String(projectId),
      summary: `Created project ${args.name}.`,
    });
    return projectId;
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
    const current = await requireCurrentUser(ctx);
    const department = args.departmentId ? await ctx.db.get(args.departmentId) : null;
    if (department) ensureDocWorkspace(department, current.workspaceId, "Department");
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      ensureDocWorkspace(project, current.workspaceId, "Project");
    }

    return await ctx.db.insert("scheduleItems", {
      workspaceId: current.workspaceId,
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
    const project = await ctx.db.get(args.projectId);
    if (!project?.workspaceId) throw new Error("Project not found.");
    await requireWorkspaceAccess(ctx, project.workspaceId, ["Owner", "Contributor"]);
    await ctx.db.patch(args.projectId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});
