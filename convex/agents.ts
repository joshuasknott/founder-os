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
    const agentGroups = await Promise.all(
      departments.map((department) =>
        ctx.db
          .query("agents")
          .withIndex("by_department", (q) => q.eq("departmentId", department._id))
          .collect()
      )
    );
    return agentGroups.flat();
  },
});
