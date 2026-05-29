import { query } from "./_generated/server";

const legacySeedTitles = new Set([
  "Founder briefing",
  "Website preview request",
  "Launch messaging draft",
]);

function isLegacySeedLibraryItem(doc: { title: string; author: string; traceId?: unknown }) {
  return doc.author === "FounderOS" && doc.traceId === undefined && legacySeedTitles.has(doc.title);
}

export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    const workspace = await ctx.db.query("workspaces").first();
    const departments = await ctx.db.query("departments").collect();
    const agents = await ctx.db.query("agents").collect();
    const directives = await ctx.db.query("directives").order("desc").take(8);
    const tasks = await ctx.db.query("tasks").collect();
    const approvals = await ctx.db
      .query("approvalQueue")
      .filter((q) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "shadow_pending")),
      )
      .collect();
    const artifacts = (await ctx.db.query("documents").collect()).filter(
      (artifact) => !isLegacySeedLibraryItem(artifact),
    );
    const projects = await ctx.db.query("projects").collect();
    const schedule = await ctx.db.query("scheduleItems").withIndex("by_start").take(6);
    const buildActivity = await ctx.db
      .query("buildActivities")
      .withIndex("by_created")
      .order("desc")
      .take(5);

    const tasksByDirective = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const key = task.directiveId;
      tasksByDirective.set(key, [...(tasksByDirective.get(key) ?? []), task]);
    }

    const agentsByDepartment = new Map<string, number>();
    for (const agent of agents) {
      agentsByDepartment.set(
        agent.departmentId,
        (agentsByDepartment.get(agent.departmentId) ?? 0) + 1,
      );
    }

    const artifactsByDepartment = new Map<string, number>();
    for (const artifact of artifacts) {
      if (artifact.isArchived) continue;
      artifactsByDepartment.set(
        artifact.departmentTag,
        (artifactsByDepartment.get(artifact.departmentTag) ?? 0) + 1,
      );
    }

    const activeProjectsByDepartment = new Map<string, number>();
    for (const project of projects) {
      if (!project.departmentId || project.status === "complete") continue;
      activeProjectsByDepartment.set(
        project.departmentId,
        (activeProjectsByDepartment.get(project.departmentId) ?? 0) + 1,
      );
    }

    return {
      workspace,
      stats: {
        departments: departments.length,
        activeProjects: projects.filter((project) => project.status !== "complete").length,
        artifacts: artifacts.filter((artifact) => !artifact.isArchived).length,
        approvals: approvals.length,
      },
      departments: departments.map((department) => ({
        ...department,
        agentCount: agentsByDepartment.get(department._id) ?? 0,
        artifactCount: artifactsByDepartment.get(department._id) ?? 0,
        activeProjectCount: activeProjectsByDepartment.get(department._id) ?? 0,
      })),
      recentWork: directives.map((directive) => {
        const directiveTasks = tasksByDirective.get(directive._id) ?? [];
        const completed = directiveTasks.filter((task) => task.status === "completed").length;
        return {
          ...directive,
          taskCount: directiveTasks.length,
          completedTaskCount: completed,
        };
      }),
      projects: projects
        .filter((project) => project.status !== "complete")
        .sort((a, b) => (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER))
        .slice(0, 5),
      schedule,
      approvals,
      buildActivity,
      artifacts: artifacts
        .filter((artifact) => !artifact.isArchived)
        .sort((a, b) => (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime))
        .slice(0, 5),
    };
  },
});
