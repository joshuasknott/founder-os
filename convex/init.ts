import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { actorFromIdentity, ensureUserWorkspace, findUserForIdentity, requireIdentity } from "./authz";
import { recordAuditEvent } from "./audit";

export const isSeeded = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const user = await findUserForIdentity(ctx, identity);
    if (!user) return false;
    const workspace = await ctx.db.get(user.workspaceId);
    const strategyDepartment = await ctx.db
      .query("departments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", user.workspaceId))
      .filter((q) => q.eq(q.field("name"), "Strategy"))
      .first();
    const departments = await ctx.db
      .query("departments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", user.workspaceId))
      .collect();
    const departmentIds = departments.map((department) => department._id);
    const agent = (await ctx.db.query("agents").collect()).find((candidate) =>
      departmentIds.includes(candidate.departmentId),
    );
    const playbook = (await ctx.db.query("playbooks").collect()).find((candidate) =>
      departmentIds.includes(candidate.departmentId),
    );

    return workspace !== null && strategyDepartment !== null && agent !== null && playbook !== null;
  },
});

export const seedSwarm = mutation({
  args: {},
  handler: async (ctx) => {
    const { identity, user, workspaceId } = await ensureUserWorkspace(ctx);

    const workspace = await ctx.db.get(workspaceId);

    const departmentSeeds = [
      {
        name: "Strategy",
        icon: "Compass",
        description: "Keeps requests clear, creates practical plans, and keeps the founder briefed.",
        objective: "Keep every business request clear, owned, and moving.",
      },
      {
        name: "Product",
        icon: "PanelsTopLeft",
        description: "Creates product plans, websites, internal tools, and launch-ready outputs.",
        objective: "Ship useful previews and operational tools without exposing the build process.",
      },
      {
        name: "Growth",
        icon: "Megaphone",
        description: "Drafts campaigns, customer messaging, research summaries, and publishing packages.",
        objective: "Create business-ready marketing assets that stay in the approved voice.",
      },
      {
        name: "Operations",
        icon: "ShieldCheck",
        description: "Organizes files, schedules reviews, and keeps workspace history easy to review.",
        objective: "Keep the business workspace tidy, current, and easy to review.",
      },
      {
        name: "Finance",
        icon: "WalletCards",
        description: "Tracks money decisions, budget guardrails, and finance-ready summaries.",
        objective: "Keep spending and finance context clear before money moves.",
      },
      {
        name: "Admin",
        icon: "ClipboardList",
        description: "Keeps admin records and routine business operations organized.",
        objective: "Keep business administration simple and current.",
      },
      {
        name: "Legal",
        icon: "Scale",
        description: "Prepares legal-ready records and highlights when expert review is needed.",
        objective: "Keep legal context organized without replacing professional advice.",
      },
      {
        name: "Customer",
        icon: "Users",
        description: "Keeps customer feedback, support themes, and relationship context easy to use.",
        objective: "Make customer context available when the business makes decisions.",
      },
      {
        name: "Content",
        icon: "FileText",
        description: "Organizes reusable content, messaging, and publishing drafts.",
        objective: "Keep content work consistent and ready for review.",
      },
      {
        name: "Research",
        icon: "Search",
        description: "Collects market notes, competitor context, and research summaries.",
        objective: "Turn research into reusable business context.",
      },
    ];

    const departmentIds = new Map<string, Id<"departments">>();

    for (const departmentSeed of departmentSeeds) {
      const existing = await ctx.db
        .query("departments")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .filter((q) => q.eq(q.field("name"), departmentSeed.name))
        .first();

      const id =
        existing?._id ??
        (await ctx.db.insert("departments", {
          workspaceId,
          name: departmentSeed.name,
          icon: departmentSeed.icon,
          description: departmentSeed.description,
          objective: departmentSeed.objective,
        }));

      departmentIds.set(departmentSeed.name, id);
    }

    const strategyId = departmentIds.get("Strategy");
    const productId = departmentIds.get("Product");
    const growthId = departmentIds.get("Growth");
    const operationsId = departmentIds.get("Operations");

    if (!workspace || !strategyId || !productId || !growthId || !operationsId) {
      throw new Error("Unable to initialize FounderOS workspace.");
    }

    const agentSeeds = [
      {
        name: "Orion",
        role: "Chief of Staff",
        description: "Interprets requests, chooses the right next step, and produces clear founder briefings.",
        systemPrompt:
          "You are Orion, FounderOS Chief of Staff. Convert plain founder requests into practical business outcomes. Plan carefully, choose the right internal team, and explain results in concise non-technical language. Ask for approval only before publishing, deploying, deleting important data, spending money, or contacting external people.",
        avatar: "O",
        departmentId: strategyId,
        routingRequest: "reasoning" as const,
        toolClearance: ["task.delegate", "memory.query", "observability.log"],
        rank: "chief" as const,
        reportsTo: "Founder",
      },
      {
        name: "Atlas",
        role: "Systems Lead",
        description: "Creates internal tools, connects data flows, checks quality, and prepares safe previews.",
        systemPrompt:
          "You are Atlas, FounderOS Systems Lead. Build and improve internal business tools, data flows, and operational processes. Work inside the workspace. Stop for approval before deploys, external repository changes, destructive data changes, purchases, or external outreach.",
        avatar: "A",
        departmentId: productId,
        routingRequest: "coding" as const,
        toolClearance: ["sandbox.executeTest", "observability.log", "debug.diagnose"],
        rank: "lead" as const,
        reportsTo: "Orion",
      },
      {
        name: "Cipher",
        role: "Preview Designer",
        description: "Creates website, dashboard, and internal-tool previews for review before launch.",
        systemPrompt:
          "You are Cipher, FounderOS Preview Designer. Turn business ideas into polished website and internal tool previews. Keep explanations outcome-focused and non-technical. Prepare reviewable Library outputs and request approval only before publishing or deploying.",
        avatar: "C",
        departmentId: productId,
        routingRequest: "creative" as const,
        toolClearance: ["ui.generate", "sandbox.executeTest", "observability.log"],
        rank: "specialist" as const,
        reportsTo: "Atlas",
      },
      {
        name: "Nova",
        role: "Growth Lead",
        description: "Drafts customer-facing documents, campaigns, research briefs, and launch messages.",
        systemPrompt:
          "You are Nova, FounderOS Growth Lead. Draft clear business documents, campaigns, and research summaries. Work on drafts and internal organization. Require founder approval before publishing, emailing, posting, or contacting external people.",
        avatar: "N",
        departmentId: growthId,
        routingRequest: "long-context" as const,
        toolClearance: ["memory.query", "content.draft", "observability.log"],
        rank: "lead" as const,
        reportsTo: "Orion",
      },
      {
        name: "Sentinel",
        role: "Operations Steward",
        description: "Maintains schedules, workspace organization, version history, and activity summaries.",
        systemPrompt:
          "You are Sentinel, FounderOS Operations Steward. Keep the workspace organized, produce simple status summaries, maintain version history, and monitor activity. Stop before destructive or external actions.",
        avatar: "S",
        departmentId: operationsId,
        routingRequest: "triage" as const,
        toolClearance: ["system.audit", "memory.index", "observability.log"],
        rank: "lead" as const,
        reportsTo: "Orion",
      },
    ];

    for (const agentSeed of agentSeeds) {
      const existing = await ctx.db
        .query("agents")
        .withIndex("by_department", (q) => q.eq("departmentId", agentSeed.departmentId))
        .filter((q) => q.eq(q.field("name"), agentSeed.name))
        .first();

      if (!existing) {
        await ctx.db.insert("agents", {
          ...agentSeed,
          isActive: true,
        });
      }
    }

    const playbookSeeds = [
      {
        name: "Business Request Intake",
        departmentId: strategyId,
        description: "Turns any plain-language request into a plan, owner, Library item, schedule, or approval.",
        taskMatrix: [
          {
            title: "Understand request",
            descriptionTemplate: "Identify the desired business outcome, business area, and output type.",
            assignedAgentId: "Orion",
            autonomyLevel: 1,
            dependencies: [],
          },
          {
            title: "Plan the work",
            descriptionTemplate: "Assign the work to the best role and prepare a concise action plan.",
            assignedAgentId: "Orion",
            autonomyLevel: 1,
            dependencies: [],
          },
          {
            title: "Summarize next steps",
            descriptionTemplate: "Write a short founder-facing summary with any required approvals.",
            assignedAgentId: "Sentinel",
            autonomyLevel: 1,
            dependencies: ["0", "1"],
          },
        ],
      },
      {
        name: "Preview Creation",
        departmentId: productId,
        description: "Creates a reviewable website or internal tool preview and records it in Library.",
        taskMatrix: [
          {
            title: "Define preview outcome",
            descriptionTemplate: "Clarify the target user, core workflow, and visible preview outcome.",
            assignedAgentId: "Orion",
            autonomyLevel: 1,
            dependencies: [],
          },
          {
            title: "Create preview draft",
            descriptionTemplate: "Draft the preview structure, interface, and supporting copy.",
            assignedAgentId: "Cipher",
            autonomyLevel: 1,
            dependencies: ["0"],
          },
          {
            title: "Prepare review notes",
            descriptionTemplate: "Summarize what changed and what requires founder approval before publishing.",
            assignedAgentId: "Atlas",
            autonomyLevel: 1,
            dependencies: ["1"],
          },
        ],
      },
      {
        name: "Document Production",
        departmentId: growthId,
        description: "Drafts, revises, and versions business documents without publishing externally.",
        taskMatrix: [
          {
            title: "Gather context",
            descriptionTemplate: "Find relevant prior Library items and workspace context.",
            assignedAgentId: "Sentinel",
            autonomyLevel: 1,
            dependencies: [],
          },
          {
            title: "Draft document",
            descriptionTemplate: "Create the document draft in the requested business voice.",
            assignedAgentId: "Nova",
            autonomyLevel: 1,
            dependencies: ["0"],
          },
          {
            title: "Version and summarize",
            descriptionTemplate: "Record the new Library version and summarize what changed.",
            assignedAgentId: "Sentinel",
            autonomyLevel: 1,
            dependencies: ["1"],
          },
        ],
      },
      {
        name: "Workspace Maintenance",
        departmentId: operationsId,
        description: "Organizes files, schedules reviews, watches activity, and prepares a high-level briefing.",
        taskMatrix: [
          {
            title: "Inspect workspace",
            descriptionTemplate: "Review Library items, tasks, and scheduled items.",
            assignedAgentId: "Sentinel",
            autonomyLevel: 1,
            dependencies: [],
          },
          {
            title: "Clean up organization",
            descriptionTemplate: "Suggest organization improvements and perform safe internal updates.",
            assignedAgentId: "Sentinel",
            autonomyLevel: 1,
            dependencies: ["0"],
          },
          {
            title: "Prepare founder briefing",
            descriptionTemplate: "Summarize completed work, risks, approvals, and next scheduled actions.",
            assignedAgentId: "Orion",
            autonomyLevel: 1,
            dependencies: ["1"],
          },
        ],
      },
    ];

    for (const playbookSeed of playbookSeeds) {
      const existing = await ctx.db
        .query("playbooks")
        .withIndex("by_department", (q) => q.eq("departmentId", playbookSeed.departmentId))
        .filter((q) => q.eq(q.field("name"), playbookSeed.name))
        .first();

      if (!existing) {
        await ctx.db.insert("playbooks", playbookSeed);
      }
    }

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(identity, user),
      workspaceId,
      action: "workspace.onboarded",
      resourceType: "workspace",
      resourceId: String(workspaceId),
      summary: "Workspace prepared.",
    });

    return workspaceId;
  },
});
