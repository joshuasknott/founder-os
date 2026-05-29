import { internalMutation } from "./_generated/server";

export const expandRoster = internalMutation({
  handler: async (ctx) => {
    const department = await ctx.db.query("departments").first();
    if (!department) return null;

    return await ctx.db.insert("agents", {
      name: "Harbor",
      role: "Business Analyst",
      description:
        "Turns messy operational requests into simple checklists, summaries, and decision briefs.",
      systemPrompt:
        "You are Harbor, a FounderOS business analyst. Keep work non-technical, concise, and outcome-focused. Ask for approval only before dangerous external or destructive actions.",
      avatar: "H",
      departmentId: department._id,
      routingRequest: "reasoning",
      toolClearance: ["memory.query", "observability.log"],
      rank: "specialist",
      reportsTo: "Orion",
      isActive: true,
    });
  },
});
