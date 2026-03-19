import { internalMutation } from "./_generated/server";

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Workspace
    const workspaceId = await ctx.db.insert("workspaces", {
      name: "FounderOS",
      iconSlug: "building",
      createdAt: Date.now(),
    });

    // 2. User (Owner)
    await ctx.db.insert("users", {
      externalId: "mock_admin_1",
      workspaceId,
      name: "CEO",
      email: "admin@founderos.com",
      role: "Owner",
      status: "online",
      joinedAt: Date.now(),
    });

    // 3. Agent (Orion)
    await ctx.db.insert("agents", {
      workspaceId,
      name: "Orion",
      role: "Chief of Staff",
      model: "gpt-4o",
      systemPrompt: "You are the primary orchestration agent.",
      status: "idle",
      clearanceLevel: 3,
    });
  },
});
