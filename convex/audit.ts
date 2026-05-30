import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireCurrentUser } from "./authz";

type Actor = {
  actorId: string;
  actorName: string;
  actorType: "user" | "worker" | "system";
};

export async function recordAuditEvent(
  ctx: MutationCtx,
  args: Actor & {
    workspaceId?: Id<"workspaces">;
    action: string;
    resourceType: string;
    resourceId?: string;
    summary: string;
    metadata?: unknown;
  },
) {
  if (!args.workspaceId) return;
  await ctx.db.insert("auditEvents", {
    workspaceId: args.workspaceId,
    actorId: args.actorId,
    actorName: args.actorName,
    actorType: args.actorType,
    action: args.action,
    resourceType: args.resourceType,
    resourceId: args.resourceId,
    summary: args.summary,
    metadata: args.metadata,
    createdAt: Date.now(),
  });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("auditEvents")
      .withIndex("by_workspace_created", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(100);
  },
});
