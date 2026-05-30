import { query } from "./_generated/server";
import { requireCurrentUser } from "./authz";

export const get = query({
  args: {},
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
