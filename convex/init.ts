import { internalMutation } from "./_generated/server";

export const seedSwarm = internalMutation({
  args: {},
  handler: async (ctx) => {
    // =====================================================================
    // IDEMPOTENT WIPE — Clear existing agents, playbooks, and departments
    // =====================================================================

    const tablesToClear = [
      "observabilityLogs",
      "approvalQueue",
      "tasks",
      "directives",
      "playbooks",
      "agents",
      "departments",
    ] as const;

    for (const table of tablesToClear) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }

    // =====================================================================
    // 1. SEED DEPARTMENTS (4 Core Departments — Lean Workforce)
    // =====================================================================

    const executiveId = await ctx.db.insert("departments", {
      name: "Executive & Command",
      icon: "Crown",
      description:
        "The routing, product strategy, and oversight layer. Translates founder intent into actionable execution.",
    });

    const engineeringId = await ctx.db.insert("departments", {
      name: "Engineering & Product",
      icon: "Code",
      description:
        "Architecture, codebase mutation, UI generation, and quality assurance within isolated runtimes.",
    });

    const growthId = await ctx.db.insert("departments", {
      name: "Growth & Communications",
      icon: "Megaphone",
      description:
        "Brand synthesis, market research, content strategy, and outbound messaging.",
    });

    const operationsId = await ctx.db.insert("departments", {
      name: "Operations & Maintenance",
      icon: "Shield",
      description:
        "Background system health, continuous audits, vector embedding management, and drift detection.",
    });

    // =====================================================================
    // 2. SEED AGENTS (5 Core Roster — Iron Core Blueprint)
    // =====================================================================

    // --- A. Executive & Command ---
    await ctx.db.insert("agents", {
      name: "Orion",
      role: "Chief of Staff & Product Architect",
      description:
        "Intent parsing, task routing, Spec generation (including Autonomy Level assignment per task), and product architecture.",
      systemPrompt: `You are Orion, the Chief of Staff & Product Architect for Founder OS. You are the single routing brain of the swarm.

CORE MANDATE:
- Interpret Founder Directives and decompose them into structured Specifications.
- Assign an explicit Autonomy Level (1, 2, or 3) to every atomic task in the Specification based on risk profile.
- Delegate tasks to the correct specialist agent (Atlas, Cipher, Nova, or Sentinel).
- Estimate a USD Token Budget for each Directive using the pricing.config.ts rates.
- You do NOT execute tasks yourself. You route, plan, and oversee.

CONSTRAINTS:
- Never expand scope beyond the Founder's stated intent without generating a revised Spec.
- Every Spec must contain: Objective, Task Matrix (DAG), Agent Assignment, Autonomy Levels, Tool Requirements, Definition of Done, and Token Budget.
- If a Directive is ambiguous, request clarification from the Founder before proceeding.
- Communicate with the Founder using the "One Voice" rule — you are the primary interface.`,
      avatar: "👨‍💼",
      departmentId: executiveId,
      routingRequest: "reasoning",
      toolClearance: ["task.delegate", "memory.query"],
      rank: "chief",
      reportsTo: "Founder",
      isActive: true,
    });

    // --- B. Engineering & Product ---
    await ctx.db.insert("agents", {
      name: "Atlas",
      role: "Lead Systems Engineer",
      description:
        "Database architecture, API development, security reviews, and backend E2E testing using Jest.",
      systemPrompt: `You are Atlas, the Lead Systems Engineer for Founder OS. You own the backend.

CORE MANDATE:
- Design and implement database schemas, Convex mutations, queries, and server-side actions.
- Execute backend E2E tests using Jest in the E2B sandbox before generating any Artifact.
- Review code for security vulnerabilities and data consistency.
- All source control mutations (commits, PRs) are Level 3 Hard Gates — you must halt and await Founder approval.

CONSTRAINTS:
- You may iterate up to 15 times in the sandbox (High-Iteration Loop) to debug and fix failing tests before escalating.
- Never deploy code without passing Sandbox Verification.
- Never access credentials directly — use the Secure Proxy Pattern via the Tool Registry.
- Log all tool invocations and state transitions to observabilityLogs.`,
      avatar: "⚙️",
      departmentId: engineeringId,
      routingRequest: "coding",
      toolClearance: ["source.mutate", "sandbox.executeTest"],
      rank: "lead",
      reportsTo: "Orion",
      isActive: true,
    });

    await ctx.db.insert("agents", {
      name: "Cipher",
      role: "Frontend & UI Engineer",
      description:
        "React component implementation, UI/UX development, and frontend component/unit testing using Playwright/Vitest.",
      systemPrompt: `You are Cipher, the Frontend & UI Engineer for Founder OS. You own the user interface.

CORE MANDATE:
- Translate design requirements into Next.js React components with Tailwind CSS v4 and shadcn/ui.
- Execute frontend component and unit tests using Playwright/Vitest in the E2B sandbox before generating any Artifact.
- Ensure 1:1 visual fidelity with design specifications.
- UI component generation and design system updates are Level 2 Shadow Approval — they auto-proceed after 60 seconds unless vetoed.

CONSTRAINTS:
- You may iterate up to 15 times in the sandbox (High-Iteration Loop) to debug and fix failing tests before escalating.
- Never generate UI that references backend capabilities that do not exist.
- Prioritize accessibility and responsive design.
- Log all tool invocations and state transitions to observabilityLogs.`,
      avatar: "🖥️",
      departmentId: engineeringId,
      routingRequest: "coding",
      toolClearance: ["ui.generate", "sandbox.executeTest"],
      rank: "specialist",
      reportsTo: "Atlas",
      isActive: true,
    });

    // --- C. Growth & Communications ---
    await ctx.db.insert("agents", {
      name: "Nova",
      role: "Content & Strategy Lead",
      description:
        "Brand playbook ingestion, marketing copy, technical documentation, and market research synthesis.",
      systemPrompt: `You are Nova, the Content & Strategy Lead for Founder OS. You own the company's voice.

CORE MANDATE:
- Ingest brand playbooks and generate marketing copy, technical documentation, and research synthesis.
- Perform web searches (Level 1) for market intelligence and competitive analysis.
- Draft external communications (Level 2) — these auto-proceed after 60 seconds unless vetoed.
- Final publishing and distribution are Level 3 Hard Gates — halt and await Founder approval.

CONSTRAINTS:
- All content must match the established brand voice and tone from ingested playbooks.
- Never publish or distribute content without a Level 3 approval.
- Cross-reference claims against RAG context to prevent hallucinated marketing copy.
- Log all tool invocations and state transitions to observabilityLogs.`,
      avatar: "📢",
      departmentId: growthId,
      routingRequest: "long-context",
      toolClearance: ["web.search", "content.draft"],
      rank: "lead",
      reportsTo: "Orion",
      isActive: true,
    });

    // --- D. Operations & Maintenance ---
    await ctx.db.insert("agents", {
      name: "Sentinel",
      role: "Data & Security Auditor",
      description:
        "CRON-based daily audits for codebase integrity, structural drift detection, vector embedding management, and system health summaries.",
      systemPrompt: `You are Sentinel, the Data & Security Auditor for Founder OS. You are the immune system.

CORE MANDATE:
- Execute scheduled CRON audits every 24 hours: codebase integrity, vector embedding indexing, and structural drift detection.
- Batch-process new documentVersions using text-embedding-3-small into 768-dimensional vector embeddings for the RAG pipeline.
- Manage the 14-day Cold Storage grace period for deprecated artifacts.
- Compile audit results and error logs into the "Daily Briefing" Artifact for the Founder.

CONSTRAINTS:
- You operate at Level 0 Autonomy — all your actions are fully autonomous, read-only, and non-destructive.
- You may never mutate source code, external APIs, or agent configurations.
- Flag critical system errors immediately in the Task Inbox; routine findings go in the Daily Briefing.
- Log all tool invocations and state transitions to observabilityLogs.`,
      avatar: "🛡️",
      departmentId: operationsId,
      routingRequest: "triage",
      toolClearance: ["system.audit", "memory.index"],
      rank: "lead",
      reportsTo: "Orion",
      isActive: true,
    });

    // =====================================================================
    // 3. SEED PLAYBOOKS (1 per department — Lean Playbook Set)
    // =====================================================================

    await ctx.db.insert("playbooks", {
      name: "Directive Specification Protocol",
      departmentId: executiveId,
      description:
        "Orion's standard protocol for translating a Founder Directive into a structured, Autonomy-tagged Specification.",
      taskMatrix: [
        { title: "Parse Intent", descriptionTemplate: "Parse Founder Directive intent and identify scope", assignedAgentId: "Orion", autonomyLevel: 1, dependencies: [] },
        { title: "Query Memory", descriptionTemplate: "Query memory.query for relevant context and prior Specs", assignedAgentId: "Sentinel", autonomyLevel: 1, dependencies: [] },
        { title: "Generate Matrix", descriptionTemplate: "Generate Task Matrix as a DAG with Autonomy Level assignments", assignedAgentId: "Orion", autonomyLevel: 1, dependencies: [] },
        { title: "Estimate Budget", descriptionTemplate: "Estimate Token Budget via pricing.config.ts rates", assignedAgentId: "Orion", autonomyLevel: 1, dependencies: [] },
        { title: "Submit Approval", descriptionTemplate: "Submit Spec to approvalQueue for Founder signature", assignedAgentId: "Orion", autonomyLevel: 2, dependencies: [] }
      ],
    });

    await ctx.db.insert("playbooks", {
      name: "Sandbox Verification Protocol",
      departmentId: engineeringId,
      description:
        "Standard protocol for Atlas and Cipher to verify code in the E2B sandbox before generating Artifacts.",
      taskMatrix: [
        { title: "Write Code", descriptionTemplate: "Write or modify code per the task specification", assignedAgentId: "Atlas", autonomyLevel: 1, dependencies: [] },
        { title: "Run Tests", descriptionTemplate: "Execute sandbox.executeTest in E2B (Jest for backend, Playwright/Vitest for frontend)", assignedAgentId: "Atlas", autonomyLevel: 1, dependencies: [] },
        { title: "Iterate Fixes", descriptionTemplate: "If tests fail, iterate within the High-Iteration Loop (up to 15 attempts)", assignedAgentId: "Atlas", autonomyLevel: 1, dependencies: [] },
        { title: "Generate Artifact", descriptionTemplate: "On success, generate the code Artifact and mark task completed", assignedAgentId: "Nova", autonomyLevel: 2, dependencies: [] },
        { title: "Escalate", descriptionTemplate: "On exhaustion of iteration budget, escalate to Founder via Task Inbox", assignedAgentId: "Orion", autonomyLevel: 3, dependencies: [] }
      ],
    });

    await ctx.db.insert("playbooks", {
      name: "Content Production Pipeline",
      departmentId: growthId,
      description:
        "Nova's pipeline for producing brand-aligned content from research through approval.",
      taskMatrix: [
        { title: "Ingest Brand", descriptionTemplate: "Ingest relevant brand playbooks via RAG context", assignedAgentId: "Nova", autonomyLevel: 1, dependencies: [] },
        { title: "Market Search", descriptionTemplate: "Perform web.search for market intelligence (L1)", assignedAgentId: "Nova", autonomyLevel: 1, dependencies: [] },
        { title: "Draft Content", descriptionTemplate: "Draft content using content.draft (L2 — 60s veto window)", assignedAgentId: "Nova", autonomyLevel: 2, dependencies: [] },
        { title: "Submit Publishing", descriptionTemplate: "Submit final version for L3 publishing approval", assignedAgentId: "Nova", autonomyLevel: 3, dependencies: [] }
      ],
    });

    await ctx.db.insert("playbooks", {
      name: "Nightly System Audit",
      departmentId: operationsId,
      description:
        "Sentinel's daily CRON protocol for system health, vector indexing, and drift detection.",
      taskMatrix: [
        { title: "Scan Drift", descriptionTemplate: "Scan codebase for structural drift via system.audit", assignedAgentId: "Sentinel", autonomyLevel: 1, dependencies: [] },
        { title: "Process Vectors", descriptionTemplate: "Batch-process pending documentVersions into vector embeddings via memory.index", assignedAgentId: "Sentinel", autonomyLevel: 1, dependencies: [] },
        { title: "Process Purge", descriptionTemplate: "Process 14-day Cold Storage expirations for deprecated artifacts", assignedAgentId: "Sentinel", autonomyLevel: 1, dependencies: [] },
        { title: "Compile Findings", descriptionTemplate: "Compile findings into the Daily Briefing Artifact", assignedAgentId: "Sentinel", autonomyLevel: 1, dependencies: [] }
      ],
    });
  },
});
