import { query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireCurrentUser } from "./authz";
import { evaluateWorkspaceReadiness } from "./readinessRuntime";

type ReadinessCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export async function getWorkspaceReadiness(
  ctx: ReadinessCtx,
  args: { workspaceId: Id<"workspaces">; founder: Doc<"users"> },
) {
  const [workspace, connections, syncStates, setupSessions, runners] = await Promise.all([
    ctx.db.get(args.workspaceId),
    ctx.db.query("connectorConnections").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).take(50),
    ctx.db.query("connectorSyncStates").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).take(100),
    ctx.db.query("connectorSetupSessions").withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId)).take(25),
    ctx.db.query("localRunners").withIndex("by_status", (q) => q.eq("status", "online")).take(50),
  ]);

  return evaluateWorkspaceReadiness({
    workspace,
    founder: args.founder,
    connections,
    syncStates,
    setupSessions,
    runners,
    now: Date.now(),
  });
}

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId, user } = await requireCurrentUser(ctx);
    return await getWorkspaceReadiness(ctx, { workspaceId, founder: user });
  },
});
