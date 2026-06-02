import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { actorFromIdentity, ensureDocWorkspace, requireCurrentUser, requireWorkerToken, workerActor } from "./authz";
import { recordAuditEvent } from "./audit";
import { normalizeModelProfile, tierForModelProfile } from "./modelProfiles";
import {
  classifyHomeChatIntake,
  localRoutingForChatWork,
  titleFromChatContent,
} from "./chatRuntime";
import {
  normalizePlainWorkerMessage,
  runnerCanHandleRouting,
  type TaskClassification,
} from "./taskRuntime";
import {
  localRunnerHeartbeatPatch,
  localRunnerIsAlive,
} from "./localRunnerRuntime";

const localRunnerCapability = v.union(
  v.literal("coding"),
  v.literal("debugging"),
  v.literal("document"),
  v.literal("design"),
  v.literal("communication"),
  v.literal("schedule"),
  v.literal("data"),
  v.literal("generic"),
  v.literal("business_reasoning"),
  v.literal("product_marketing_docs"),
  v.literal("planning"),
);

const localRunnerSensitivity = v.union(
  v.literal("public"),
  v.literal("low"),
  v.literal("internal"),
  v.literal("confidential"),
  v.literal("restricted"),
);

const localRunnerOutputContract = v.union(
  v.literal("plain_text"),
  v.literal("structured_json"),
  v.literal("library_item"),
  v.literal("code_changes"),
  v.literal("public_draft"),
);

const sensitiveActionKind = v.union(
  v.literal("publish_preview"),
  v.literal("send_email"),
  v.literal("create_calendar_event"),
  v.literal("post_externally"),
  v.literal("spend_money"),
  v.literal("delete_data"),
  v.literal("change_live_asset"),
  v.literal("generic"),
);

const localRunRouting = v.object({
  capability: localRunnerCapability,
  sensitivity: localRunnerSensitivity,
  outputContract: localRunnerOutputContract,
  approvalNeeds: v.array(sensitiveActionKind),
});

const workRunKind = v.union(
  v.literal("code_preview"),
  v.literal("document"),
  v.literal("design"),
  v.literal("email"),
  v.literal("schedule"),
  v.literal("data_update"),
  v.literal("generic"),
);

const workerKind = v.union(
  v.literal("builder"),
  v.literal("document"),
  v.literal("design"),
  v.literal("communications"),
  v.literal("generic"),
);

const taskCategory = v.union(
  v.literal("build"),
  v.literal("document"),
  v.literal("design"),
  v.literal("communication"),
  v.literal("schedule"),
  v.literal("data"),
  v.literal("generic"),
);

const outputItemKind = v.union(
  v.literal("created_output"),
  v.literal("upload"),
  v.literal("website"),
  v.literal("deck"),
  v.literal("doc"),
  v.literal("email"),
  v.literal("contact"),
  v.literal("company"),
  v.literal("decision"),
  v.literal("research"),
  v.literal("automation"),
  v.literal("tool"),
  v.literal("task_output"),
  v.literal("document"),
  v.literal("file"),
  v.literal("internal_tool"),
  v.literal("presentation"),
  v.literal("conversation"),
  v.literal("record"),
  v.literal("brief"),
  v.literal("plan"),
);

const outputDocumentKind = v.union(
  v.literal("document"),
  v.literal("file"),
  v.literal("website"),
  v.literal("internal_tool"),
  v.literal("tool"),
  v.literal("presentation"),
  v.literal("automation"),
  v.literal("task_output"),
  v.literal("conversation"),
  v.literal("record"),
  v.literal("brief"),
  v.literal("plan"),
);

const taskClassification = v.object({
  category: taskCategory,
  runKind: workRunKind,
  workerKind,
  outputItemKind,
  outputDocumentKind,
  requiresReview: v.boolean(),
  confidence: v.number(),
  signals: v.array(v.string()),
});

type ReadOnlyChatPrompt = {
  agent: Doc<"agents">;
  systemPrompt: string;
  tier: number;
};

type SendHomeMessageResult = {
  jobId: Id<"chatJobs">;
  directiveId?: Id<"directives">;
  taskId?: Id<"tasks">;
  runId?: Id<"workRuns">;
  requiresWork: boolean;
};

async function buildReadOnlyChatPrompt(ctx: ActionCtx, args: {
  sessionId: Id<"chatSessions">;
  agentId: Id<"agents">;
  content: string;
  modelProfile?: string;
  useMemory?: boolean;
}): Promise<ReadOnlyChatPrompt> {
  const authorization = await ctx.runQuery(internal.chat.authorizeSessionForAction, {
    sessionId: args.sessionId,
    agentId: args.agentId,
  }) as { workspaceId: Id<"workspaces"> };

  const agent = await ctx.runQuery(internal.chat.getAgentById, {
    agentId: args.agentId,
  }) as Doc<"agents"> | null;

  if (!agent) throw new Error("Agent not found.");

  const history = await ctx.runQuery(internal.chat.getRecentHistory, {
    sessionId: args.sessionId,
  }) as Array<{ role: "user" | "assistant"; content: string }>;

  const historyContext = history
    .map((message) => `${message.role === "user" ? "Human" : agent.name}: ${message.content}`)
    .join("\n");

  let libraryContext = "No relevant workspace context found.";
  try {
    const context = await ctx.runAction(internal.search.retrieveContext, {
      queryText: args.content,
      limit: 8,
      workspaceId: authorization.workspaceId,
      purpose: "chat",
      useMemory: args.useMemory,
    });
    libraryContext = context.text;
  } catch {
    libraryContext = "Workspace context is unavailable right now.";
  }

  let connectorContext = "";
  try {
    const context = await ctx.runAction(api.connectors.readGoogleWorkspaceContext, {
      workspaceId: authorization.workspaceId,
      queryText: args.content,
      requestedBy: `chat:${agent.name}`,
    });
    connectorContext = context.text && !context.text.startsWith("No matching")
      ? `\n\n${context.text}`
      : "";
  } catch {
    connectorContext = "";
  }

  const capabilityToTier: Record<string, number> = {
    triage: 1, coding: 3, reasoning: 4, "long-context": 3, creative: 2,
  };
  const autoTier = capabilityToTier[agent.routingRequest] ?? 1;
  const tier = tierForModelProfile(args.modelProfile, autoTier);
  const systemPrompt = `${agent.systemPrompt}\n\nYou are in CHAT MODE. This is a read-only conversation with the founder. Help them understand, plan, and think through problems. You may use read-only connected service context when it is provided, but you cannot execute tasks, create outputs, schedule work, publish, send messages, or make changes in this mode. If the founder wants work performed, help them shape a clear task instead.\n\nRelevant workspace context:\n${libraryContext}${connectorContext}\n\nConversation so far:\n${historyContext}`;

  return {
    agent,
    systemPrompt,
    tier,
  };
}

async function enqueueHomeMessageAction(ctx: ActionCtx, args: {
  sessionId: Id<"chatSessions">;
  agentId: Id<"agents">;
  content: string;
  modelProfile?: string;
  useMemory?: boolean;
}): Promise<SendHomeMessageResult> {
  const prepared = await buildReadOnlyChatPrompt(ctx, args);
  const intake = classifyHomeChatIntake(args.content);

  return await ctx.runMutation(internal.chat.enqueueHomeChatJob, {
    sessionId: args.sessionId,
    agentId: args.agentId,
    content: args.content,
    systemPrompt: prepared.systemPrompt,
    userPrompt: args.content,
    agentName: prepared.agent.name,
    modelProfile: args.modelProfile,
    sensitivity: intake.sensitivity,
    localRouting: intake.localRouting,
    routeId: intake.routeId,
    opencodeModel: intake.opencodeModel,
    verifierRequired: intake.verifierRequired,
    allowFreeRoute: intake.allowFreeRoute,
    requiresWork: intake.requiresWork,
    classification: intake.taskClassification,
    useMemory: args.useMemory,
  }) as SendHomeMessageResult;
}

function autonomyForClassification(classification: TaskClassification): 1 | 2 | 3 {
  if (classification.workerKind === "builder") return 3;
  if (classification.requiresReview) return 2;
  return 1;
}

async function chooseAssignedAgent(
  ctx: MutationCtx,
  classification: TaskClassification,
  workspaceId: Doc<"users">["workspaceId"],
): Promise<Doc<"agents"> | null> {
  const departments = await ctx.db
    .query("departments")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const agents = (
    await Promise.all(
      departments.map((department) =>
        ctx.db
          .query("agents")
          .withIndex("by_department", (q) => q.eq("departmentId", department._id))
          .collect(),
      ),
    )
  ).flat();
  if (agents.length === 0) return null;

  const preferredRouting: Record<TaskClassification["workerKind"], Array<Doc<"agents">["routingRequest"]>> = {
    builder: ["coding", "reasoning"],
    document: ["long-context", "reasoning", "triage"],
    design: ["creative", "reasoning"],
    communications: ["triage", "creative", "reasoning"],
    generic: ["triage", "reasoning"],
  };

  return (
    agents.find((agent) =>
      preferredRouting[classification.workerKind].includes(agent.routingRequest),
    ) ??
    agents.find((agent) => agent.isActive) ??
    agents[0]
  );
}

function canLeaseChatJob(job: Doc<"chatJobs">, now: number) {
  if (job.status === "queued") {
    return (job.attemptCount ?? 0) < (job.maxAttempts ?? 3);
  }
  if (job.status !== "working") return false;
  if (typeof job.leaseExpiresAt !== "number") return false;
  return job.leaseExpiresAt <= now && (job.attemptCount ?? 0) < (job.maxAttempts ?? 3);
}

function chatLeaseIsValid(
  job: Doc<"chatJobs">,
  args: {
    leaseId?: string;
    now: number;
  },
) {
  if (!args.leaseId) {
    return typeof job.leaseId !== "string";
  }
  return job.leaseId === args.leaseId && typeof job.leaseExpiresAt === "number" && job.leaseExpiresAt > args.now;
}

function plainChatFailureMessage(message?: string) {
  return normalizePlainWorkerMessage(
    message,
    "FounderOS could not finish that on this computer yet. Check Settings, then try again.",
  );
}

export const createSession = mutation({
  args: {
    agentId: v.id("agents"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found.");
    const department = await ctx.db.get(agent.departmentId);
    ensureDocWorkspace(department, current.workspaceId, "Department");

    const sessionId = await ctx.db.insert("chatSessions", {
      workspaceId: current.workspaceId,
      userId: current.user._id,
      title: args.title,
      agentId: args.agentId,
      lastMessageAt: Date.now(),
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "chat.created",
      resourceType: "chatSession",
      resourceId: String(sessionId),
      summary: `Started chat: ${args.title}.`,
    });
    return sessionId;
  },
});

export const getSessions = query({
  handler: async (ctx) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    return await ctx.db
      .query("chatSessions")
      .withIndex("by_workspace_lastMessage", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(20);
  },
});

export const getMessages = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const session = ensureDocWorkspace(await ctx.db.get(args.sessionId), workspaceId, "Chat");
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
  },
});

export const getSessionActivity = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const session = ensureDocWorkspace(await ctx.db.get(args.sessionId), workspaceId, "Chat");
    const jobs = await ctx.db
      .query("chatJobs")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();

    const active = jobs
      .filter((job) => job.status === "queued" || job.status === "working")
      .sort((left, right) => right.updatedAt - left.updatedAt)[0];
    if (!active) return null;

    return {
      status: active.status,
      safeProgress: active.safeProgress,
      directiveId: active.directiveId,
      runId: active.runId,
      updatedAt: active.updatedAt,
    };
  },
});

export const sendHomeMessage = action({
  args: {
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
    content: v.string(),
    modelProfile: v.optional(v.string()),
    useMemory: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SendHomeMessageResult> => {
    return await enqueueHomeMessageAction(ctx, args);
  },
});

export const sendMessage = action({
  args: {
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
    content: v.string(),
    modelProfile: v.optional(v.string()),
    useMemory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await enqueueHomeMessageAction(ctx, args);
  },
});

export const prepareLocalOpenCodeChat = action({
  args: {
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
    content: v.string(),
    modelProfile: v.optional(v.string()),
    useMemory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const prepared = await buildReadOnlyChatPrompt(ctx, args);
    return {
      systemPrompt: prepared.systemPrompt,
      userPrompt: args.content,
      modelProfile: args.modelProfile ?? "auto",
      agentName: prepared.agent.name,
      tier: prepared.tier,
    };
  },
});

export const completeLocalOpenCodeChat = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
    userContent: v.string(),
    assistantContent: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const session = ensureDocWorkspace(await ctx.db.get(args.sessionId), current.workspaceId, "Chat");
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found.");
    const department = await ctx.db.get(agent.departmentId);
    ensureDocWorkspace(department, current.workspaceId, "Department");

    await ctx.db.insert("chatMessages", {
      sessionId: session._id,
      role: "user",
      content: args.userContent,
    });
    await ctx.db.insert("chatMessages", {
      sessionId: session._id,
      role: "assistant",
      content: args.assistantContent,
      agentName: agent.name,
    });
    await ctx.db.patch(session._id, { lastMessageAt: Date.now() });
  },
});

export const enqueueHomeChatJob = internalMutation({
  args: {
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
    content: v.string(),
    systemPrompt: v.string(),
    userPrompt: v.string(),
    agentName: v.string(),
    modelProfile: v.optional(v.string()),
    sensitivity: localRunnerSensitivity,
    localRouting: localRunRouting,
    routeId: v.string(),
    opencodeModel: v.string(),
    verifierRequired: v.boolean(),
    allowFreeRoute: v.boolean(),
    requiresWork: v.boolean(),
    classification: taskClassification,
    useMemory: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx);
    const session = ensureDocWorkspace(await ctx.db.get(args.sessionId), current.workspaceId, "Chat");
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found.");
    const department = await ctx.db.get(agent.departmentId);
    ensureDocWorkspace(department, current.workspaceId, "Department");

    const now = Date.now();
    const title = titleFromChatContent(args.content);
    const userMessageId = await ctx.db.insert("chatMessages", {
      sessionId: session._id,
      role: "user",
      content: args.content,
    });

    let directiveId: Id<"directives"> | undefined;
    let taskId: Id<"tasks"> | undefined;
    let runId: Id<"workRuns"> | undefined;
    const modelProfile = normalizeModelProfile(args.modelProfile);

    if (args.requiresWork) {
      const classification = args.classification;
      const workRouting = localRoutingForChatWork({
        title,
        objective: args.content,
        classification,
      });
      const assignedAgent = await chooseAssignedAgent(ctx, classification, current.workspaceId);

      directiveId = await ctx.db.insert("directives", {
        workspaceId: current.workspaceId,
        title,
        objective: args.content,
        sessionId: session._id,
        status: "pending_spec",
        useMemory: args.useMemory,
      });

      taskId = await ctx.db.insert("tasks", {
        workspaceId: current.workspaceId,
        directiveId,
        title,
        description: args.content,
        ...(assignedAgent ? { assignedAgentId: assignedAgent._id } : {}),
        status: "queued",
        autonomyLevel: autonomyForClassification(classification),
        dependencies: [],
        classification,
        workerKind: classification.workerKind,
        modelProfile,
        localRouting: workRouting,
        useMemory: args.useMemory,
        retryCount: 0,
        updatedAt: now,
      });

      runId = await ctx.db.insert("workRuns", {
        workspaceId: current.workspaceId,
        directiveId,
        taskId,
        trigger: "chat",
        kind: classification.runKind,
        workerKind: classification.workerKind,
        classification,
        modelProfile,
        localRouting: workRouting,
        useMemory: args.useMemory,
        status: "queued",
        title,
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("workRunUpdates", {
        runId,
        message: normalizePlainWorkerMessage("I've added this to your workspace and I'm preparing the next step."),
        tone: "info",
        createdAt: now,
      });
    }

    const jobId = await ctx.db.insert("chatJobs", {
      workspaceId: current.workspaceId,
      sessionId: session._id,
      agentId: args.agentId,
      userMessageId,
      directiveId,
      taskId,
      runId,
      status: "queued",
      content: args.content,
      systemPrompt: args.systemPrompt,
      userPrompt: args.userPrompt,
      agentName: args.agentName,
      safeProgress: args.requiresWork
        ? "Adding this to your workspace."
        : "Thinking this through.",
      sensitivity: args.sensitivity,
      localRouting: args.localRouting,
      routeId: args.routeId,
      opencodeModel: args.opencodeModel,
      verifierRequired: args.verifierRequired,
      allowFreeRoute: args.allowFreeRoute,
      requiresWork: args.requiresWork,
      classification: args.classification,
      useMemory: args.useMemory,
      attemptCount: 0,
      maxAttempts: 2,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(session._id, { lastMessageAt: now });

    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: args.requiresWork ? "chat.intake_work_queued" : "chat.intake_queued",
      resourceType: "chatJob",
      resourceId: String(jobId),
      summary: args.requiresWork ? `Queued chat intake and work: ${title}.` : `Queued chat intake: ${title}.`,
      metadata: {
        directiveId,
        taskId,
        runId,
        sensitivity: args.sensitivity,
      },
    });

    return {
      jobId,
      directiveId,
      taskId,
      runId,
      requiresWork: args.requiresWork,
    };
  },
});

export const leaseNextLocalRunnerJob = mutation({
  args: {
    runnerId: v.string(),
    leaseMs: v.optional(v.number()),
    heartbeatTtlMs: v.optional(v.number()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const runner = await ctx.db
      .query("localRunners")
      .withIndex("by_runner_id", (q) => q.eq("runnerId", args.runnerId))
      .first();
    const now = Date.now();
    if (!runner) throw new Error("Local runner is not registered.");
    if (!localRunnerIsAlive(runner, now)) return null;
    if (runner.opencodeReady !== true) return null;

    const queued = await ctx.db
      .query("chatJobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(25);
    const working = await ctx.db
      .query("chatJobs")
      .withIndex("by_status", (q) => q.eq("status", "working"))
      .order("asc")
      .take(25);

    for (const job of working) {
      const attempts = job.attemptCount ?? 0;
      const maxAttempts = job.maxAttempts ?? 2;
      const leaseExpired = typeof job.leaseExpiresAt === "number" && job.leaseExpiresAt <= now;
      if (!leaseExpired || attempts < maxAttempts) continue;
      const message = plainChatFailureMessage();
      const assistantMessageId = await ctx.db.insert("chatMessages", {
        sessionId: job.sessionId,
        role: "assistant",
        content: message,
        agentName: job.agentName,
      });
      await ctx.db.patch(job._id, {
        status: "failed",
        assistantMessageId,
        failureReason: message,
        leaseId: undefined,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        failedAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(job.sessionId, { lastMessageAt: now });
    }

    const candidate = [...queued, ...working].find((job) =>
      canLeaseChatJob(job, now) &&
      runnerCanHandleRouting(
        {
          capabilities: runner.capabilities,
          outputContracts: runner.outputContracts,
          maxSensitivity: runner.maxSensitivity,
          approvalCapabilities: runner.approvalCapabilities,
        },
        job.localRouting,
      ),
    );
    if (!candidate) return null;

    const leaseId = `${args.runnerId}:chat:${now}:${Math.random().toString(36).slice(2)}`;
    const patch = {
      status: "working" as const,
      attemptCount: (candidate.attemptCount ?? 0) + 1,
      maxAttempts: candidate.maxAttempts ?? 2,
      leaseId,
      leaseOwner: args.runnerId,
      leaseExpiresAt: now + (args.leaseMs ?? 10 * 60 * 1000),
      localRunnerId: args.runnerId,
      safeProgress: candidate.requiresWork ? "Preparing a reply and starting the work." : "Preparing a reply.",
      updatedAt: now,
    };

    await ctx.db.patch(candidate._id, patch);
    await ctx.db.patch(runner._id, {
      ...localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs }),
      lastSafeMessage: "Preparing a reply.",
    });

    await recordAuditEvent(ctx, {
      ...workerActor(args.runnerId),
      workspaceId: candidate.workspaceId,
      action: "local_runner.chat_leased",
      resourceType: "chatJob",
      resourceId: String(candidate._id),
      summary: "Local runner started a chat reply.",
      metadata: { leaseId, attemptCount: patch.attemptCount },
    });

    return { ...candidate, ...patch };
  },
});

export const progressLocalRunnerJob = mutation({
  args: {
    runnerId: v.string(),
    jobId: v.id("chatJobs"),
    leaseId: v.optional(v.string()),
    message: v.string(),
    heartbeatTtlMs: v.optional(v.number()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Chat job not found.");
    const now = Date.now();
    if (!chatLeaseIsValid(job, { leaseId: args.leaseId, now })) {
      throw new Error("This reply is already being handled.");
    }
    const runner = await ctx.db
      .query("localRunners")
      .withIndex("by_runner_id", (q) => q.eq("runnerId", args.runnerId))
      .first();
    if (!runner) throw new Error("Local runner is not registered.");

    const safeProgress = normalizePlainWorkerMessage(args.message, "Preparing a reply.");
    await ctx.db.patch(job._id, {
      safeProgress,
      updatedAt: now,
    });
    await ctx.db.patch(runner._id, {
      ...localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs }),
      lastSafeMessage: safeProgress,
    });
  },
});

export const completeLocalRunnerJob = mutation({
  args: {
    runnerId: v.string(),
    jobId: v.id("chatJobs"),
    leaseId: v.optional(v.string()),
    assistantContent: v.string(),
    heartbeatTtlMs: v.optional(v.number()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Chat job not found.");
    if (job.status === "completed") return job.assistantMessageId;
    const now = Date.now();
    if (!chatLeaseIsValid(job, { leaseId: args.leaseId, now })) {
      throw new Error("This reply is already being handled.");
    }
    const runner = await ctx.db
      .query("localRunners")
      .withIndex("by_runner_id", (q) => q.eq("runnerId", args.runnerId))
      .first();
    if (!runner) throw new Error("Local runner is not registered.");

    const card = job.requiresWork && job.directiveId
      ? {
          type: "task_result" as const,
          title: "Added to Work",
          summary: "FounderOS will keep preparing this in Work.",
          directiveId: job.directiveId,
          ...(job.runId ? { runId: job.runId } : {}),
        }
      : undefined;
    const assistantMessageId = await ctx.db.insert("chatMessages", {
      sessionId: job.sessionId,
      role: "assistant",
      content: normalizePlainWorkerMessage(args.assistantContent, "I've got this."),
      agentName: job.agentName,
      ...(card ? { card } : {}),
    });

    await ctx.db.patch(job._id, {
      status: "completed",
      assistantMessageId,
      safeProgress: "Done.",
      leaseId: undefined,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(job.sessionId, { lastMessageAt: now });
    await ctx.db.patch(runner._id, {
      ...localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs }),
      currentRunId: undefined,
      completedCount: (runner.completedCount ?? 0) + 1,
      lastSafeMessage: "Done.",
    });

    await recordAuditEvent(ctx, {
      ...workerActor(args.runnerId),
      workspaceId: job.workspaceId,
      action: "local_runner.chat_completed",
      resourceType: "chatJob",
      resourceId: String(job._id),
      summary: "Local runner completed a chat reply.",
      metadata: {
        directiveId: job.directiveId,
        runId: job.runId,
      },
    });

    return assistantMessageId;
  },
});

export const failLocalRunnerJob = mutation({
  args: {
    runnerId: v.string(),
    jobId: v.id("chatJobs"),
    leaseId: v.optional(v.string()),
    message: v.optional(v.string()),
    internalError: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
    heartbeatTtlMs: v.optional(v.number()),
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireWorkerToken(args.workerToken);
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Chat job not found.");
    if (job.status === "completed") return job.assistantMessageId;
    const now = Date.now();
    if (!chatLeaseIsValid(job, { leaseId: args.leaseId, now })) {
      throw new Error("This reply is already being handled.");
    }
    const runner = await ctx.db
      .query("localRunners")
      .withIndex("by_runner_id", (q) => q.eq("runnerId", args.runnerId))
      .first();
    if (!runner) throw new Error("Local runner is not registered.");

    const attempts = job.attemptCount ?? 0;
    const maxAttempts = job.maxAttempts ?? 2;
    const willRetry = args.retryable !== false && attempts < maxAttempts;
    const message = willRetry
      ? "I hit a temporary issue and will try again."
      : plainChatFailureMessage(args.message);

    let assistantMessageId = job.assistantMessageId;
    if (!willRetry) {
      assistantMessageId = await ctx.db.insert("chatMessages", {
        sessionId: job.sessionId,
        role: "assistant",
        content: message,
        agentName: job.agentName,
      });
      await ctx.db.patch(job.sessionId, { lastMessageAt: now });
    }

    await ctx.db.patch(job._id, {
      status: willRetry ? "queued" : "failed",
      assistantMessageId,
      failureReason: message,
      lastError: args.internalError,
      safeProgress: message,
      leaseId: undefined,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      failedAt: willRetry ? undefined : now,
      updatedAt: now,
    });
    await ctx.db.patch(runner._id, {
      ...localRunnerHeartbeatPatch({ now, heartbeatTtlMs: args.heartbeatTtlMs }),
      currentRunId: undefined,
      failedCount: (runner.failedCount ?? 0) + (willRetry ? 0 : 1),
      lastSafeMessage: message,
    });

    await recordAuditEvent(ctx, {
      ...workerActor(args.runnerId),
      workspaceId: job.workspaceId,
      action: "local_runner.chat_failed",
      resourceType: "chatJob",
      resourceId: String(job._id),
      summary: message,
      metadata: { retryScheduled: willRetry },
    });

    return assistantMessageId;
  },
});

export const storeMessage = internalMutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    agentName: v.optional(v.string()),
    card: v.optional(
      v.object({
        type: v.union(v.literal("task_result"), v.literal("item_navigation")),
        title: v.string(),
        summary: v.optional(v.string()),
        href: v.optional(v.string()),
        label: v.optional(v.string()),
        itemId: v.optional(v.id("items")),
        documentId: v.optional(v.id("documents")),
        runId: v.optional(v.id("workRuns")),
        directiveId: v.optional(v.id("directives")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      agentName: args.agentName,
      card: args.card,
    });
  },
});

export const getAgentById = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => await ctx.db.get(args.agentId),
});

export const getRecentHistory = internalQuery({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return messages.slice(-20);
  },
});

export const authorizeSessionForAction = internalQuery({
  args: {
    sessionId: v.id("chatSessions"),
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const { workspaceId } = await requireCurrentUser(ctx);
    const session = ensureDocWorkspace(await ctx.db.get(args.sessionId), workspaceId, "Chat");
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found.");
    const department = await ctx.db.get(agent.departmentId);
    ensureDocWorkspace(department, workspaceId, "Department");
    return { sessionId: session._id, workspaceId };
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found.");
    const current = await requireCurrentUser(ctx);
    ensureDocWorkspace(session, current.workspaceId, "Chat");

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.delete(args.sessionId);
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: current.workspaceId,
      action: "chat.deleted",
      resourceType: "chatSession",
      resourceId: String(args.sessionId),
      summary: `Deleted chat: ${session.title}.`,
    });
  },
});

export const updateSessionTimestamp = internalMutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { lastMessageAt: Date.now() });
  },
});
