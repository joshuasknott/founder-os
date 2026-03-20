import { internalMutation } from "./_generated/server";

export const expandRoster = internalMutation({
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    const workspaceId = workspaces[0]._id;

    await ctx.db.insert("agents", {
      workspaceId,
      name: "Atlas",
      role: "Backend Engineer",
      model: "claude-4.6-opus",
      systemPrompt:
        "You architect and manage server-side logic, databases, and system integrations.",
      status: "working",
      clearanceLevel: 2,
    });

    await ctx.db.insert("agents", {
      workspaceId,
      name: "Cipher",
      role: "Frontend Engineer",
      model: "claude-4.6-sonnet",
      systemPrompt:
        "You build and maintain user interfaces, ensuring responsive, accessible, and high-performance client-side experiences.",
      status: "idle",
      clearanceLevel: 2,
    });

    await ctx.db.insert("agents", {
      workspaceId,
      name: "Nova",
      role: "Product Manager",
      model: "gpt-5.4",
      systemPrompt:
        "You handle product strategy, workflow planning, and translation of business requirements into actionable developer tasks.",
      status: "offline",
      clearanceLevel: 1,
    });

    await ctx.db.insert("agents", {
      workspaceId,
      name: "Sentinel",
      role: "Security Engineer",
      model: "gemini-3.1-pro",
      systemPrompt:
        "You monitor system logs, validate permissions, and ensure application security and compliance.",
      status: "idle",
      clearanceLevel: 1,
    });
  },
});
