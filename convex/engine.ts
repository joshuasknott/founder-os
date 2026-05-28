import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// =========================================================================
// CONSTANTS (Doc 4 §6)
// =========================================================================

/** L3 External Tools: max retries before escalation */
const L3_MAX_RETRIES = 3;

/** L1 Sandbox: max iterations before escalation */
const L1_MAX_ITERATIONS = 15;

/** Capability class → AI tier mapping */
const CAPABILITY_TO_TIER: Record<string, number> = {
  triage: 1,
  coding: 3,
  reasoning: 4,
  "long-context": 3,
  creative: 2,
};

// =========================================================================
// INTERNAL QUERIES
// =========================================================================

export const getApprovedSpec = internalQuery({
  args: { directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    const approvals = await ctx.db
      .query("approvalQueue")
      .withIndex("by_directive", (q) => q.eq("directiveId", args.directiveId))
      .collect();

    const approved = approvals.find(
      (a) => a.type === "spec_gate" && a.status === "approved"
    );
    return approved?.payloadHash ?? null;
  },
});

export const getTaskById = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => await ctx.db.get(args.taskId),
});

export const getAgentById = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => await ctx.db.get(args.agentId),
});

export const getAgentByName = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const agents = await ctx.db.query("agents").collect();
    return agents.find((a) => a.name === args.name) ?? null;
  },
});

// =========================================================================
// INTERNAL MUTATIONS
// =========================================================================

export const createTaskBatch = internalMutation({
  args: {
    directiveId: v.id("directives"),
    tasks: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        assignedAgentId: v.id("agents"),
        autonomyLevel: v.union(v.literal(1), v.literal(2), v.literal(3)),
        dependsOnIndices: v.array(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.directiveId, { status: "in_progress" });

    const taskIds: Id<"tasks">[] = [];

    for (const task of args.tasks) {
      const id = await ctx.db.insert("tasks", {
        directiveId: args.directiveId,
        title: task.title,
        description: task.description,
        assignedAgentId: task.assignedAgentId,
        status: "queued",
        autonomyLevel: task.autonomyLevel,
        dependencies: [],
        retryCount: 0,
      });
      taskIds.push(id);
    }

    for (let i = 0; i < args.tasks.length; i++) {
      const depIndices = args.tasks[i].dependsOnIndices;
      if (depIndices.length > 0) {
        const resolvedDeps = depIndices
          .filter((idx) => idx >= 0 && idx < taskIds.length)
          .map((idx) => taskIds[idx]);
        await ctx.db.patch(taskIds[i], { dependencies: resolvedDeps });
      }
    }

    await ctx.runMutation(internal.telemetry.logEvent, {
      traceId: args.directiveId,
      actor: "system: Engine",
      eventType: "STATE_TRANSITION",
      rawPayload: {
        transition: "awaiting_approval → in_progress",
        tasksCreated: taskIds.length,
        taskIds,
      },
    });

    return taskIds;
  },
});

export const startTask = internalMutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { status: "in_progress" });
  },
});

export const incrementRetry = internalMutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;
    await ctx.db.patch(args.taskId, { retryCount: (task.retryCount ?? 0) + 1 });
  },
});

export const failTask = internalMutation({
  args: { taskId: v.id("tasks"), reason: v.string() },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;

    await ctx.db.patch(args.taskId, { status: "failed" });

    await ctx.runMutation(internal.telemetry.logEvent, {
      traceId: task.directiveId,
      actor: "system: Engine",
      eventType: "ERROR_ESCALATION",
      rawPayload: { taskId: args.taskId, reason: args.reason, retryCount: task.retryCount ?? 0 },
    });
  },
});

export const blockForApproval = internalMutation({
  args: { taskId: v.id("tasks"), directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { status: "blocked" });

    await ctx.db.insert("approvalQueue", {
      type: "integration_gate",
      directiveId: args.directiveId,
      taskId: args.taskId,
      status: "pending",
      autonomyLevel: 3,
    });

    await ctx.runMutation(internal.telemetry.logEvent, {
      traceId: args.directiveId,
      actor: "system: Engine",
      eventType: "STATE_TRANSITION",
      rawPayload: { taskId: args.taskId, transition: "in_progress → blocked (L3 Hard Gate)" },
    });
  },
});

export const submitShadowApproval = internalMutation({
  args: { taskId: v.id("tasks"), directiveId: v.id("directives") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, { status: "shadow_pending" });

    await ctx.db.insert("approvalQueue", {
      type: "shadow_approval",
      directiveId: args.directiveId,
      taskId: args.taskId,
      status: "shadow_pending", // Sits indefinitely until manual action
      autonomyLevel: 2,
    });

    await ctx.runMutation(internal.telemetry.logEvent, {
      traceId: args.directiveId,
      actor: "system: Engine",
      eventType: "STATE_TRANSITION",
      rawPayload: { taskId: args.taskId, transition: "in_progress → shadow_pending (Manual Action Required)" },
    });
  },
});

export const generateArtifact = internalMutation({
  args: {
    directiveId: v.id("directives"),
    agentName: v.string(),
    title: v.string(),
    content: v.string(),
    departmentId: v.id("departments"),
  },
  handler: async (ctx, args) => {
    const docId = await ctx.db.insert("documents", {
      title: args.title,
      departmentTag: args.departmentId,
      author: `agent: ${args.agentName}`,
      traceId: args.directiveId,
      status: "draft",
      isArchived: false,
    });

    await ctx.db.insert("documentVersions", { documentId: docId, content: args.content });

    await ctx.runMutation(internal.telemetry.logEvent, {
      traceId: args.directiveId,
      actor: `agent: ${args.agentName}`,
      eventType: "STATE_TRANSITION",
      rawPayload: { artifact: docId, title: args.title, status: "draft" },
    });

    return docId;
  },
});

export const completeTask = internalMutation({
  args: { taskId: v.id("tasks"), artifactContent: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.taskId, { status: "completed" });

    await ctx.runMutation(internal.telemetry.logEvent, {
      traceId: task.directiveId,
      actor: "system: Engine",
      eventType: "STATE_TRANSITION",
      rawPayload: { taskId: args.taskId, transition: "in_progress → completed" },
    });

    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_directive", (q) => q.eq("directiveId", task.directiveId))
      .collect();

    const allDone = allTasks.every((t) => t.status === "completed" || t.status === "failed");

    if (allDone) {
      await ctx.db.patch(task.directiveId, { status: "completed" });

      await ctx.runMutation(internal.telemetry.logEvent, {
        traceId: task.directiveId,
        actor: "system: Engine",
        eventType: "STATE_TRANSITION",
        rawPayload: { transition: "in_progress → completed", message: "All tasks resolved." },
      });
    } else {
      // SMART BURST EXECUTION: Instantly wake all fully resolved downstream nodes.
      const queuedTasks = allTasks.filter((t) => t.status === "queued" || t.status === "blocked");

      for (const candidate of queuedTasks) {
        if (candidate.status === "blocked") continue; // Manually blocked tasks
        const depsResolved = candidate.dependencies.every((depId) => {
          const dep = allTasks.find((t) => t._id === depId);
          return dep?.status === "completed";
        });

        if (depsResolved) {
          // Immediately dispatch! No Semaphore bottlenecks.
          await ctx.scheduler.runAfter(0, internal.engine.executeTask, { taskId: candidate._id });
        }
      }
    }
  },
});

export const injectAtlasDebugTask = internalMutation({
  args: { 
    failedTaskId: v.id("tasks"),
    directiveId: v.id("directives"),
    taskTitle: v.string(),
    errorPayload: v.string(),
  },
  handler: async (ctx, args) => {
    const atlas = await ctx.db.query("agents").filter(q => q.eq(q.field("name"), "Atlas")).first();
    if (!atlas) throw new Error("Atlas agent missing from roster");

    // Block the L3 task
    await ctx.db.patch(args.failedTaskId, { status: "blocked" });

    // Inject L1 debug task
    const atlasTaskId = await ctx.db.insert("tasks", {
      directiveId: args.directiveId,
      title: `Atlas Debug: Rectify Payload for ${args.taskTitle}`,
      description: `The task "${args.taskTitle}" failed at Level 3. Analyze logs and rectify payload. Error: ${args.errorPayload}`,
      assignedAgentId: atlas._id,
      status: "queued",
      autonomyLevel: 1,
      dependencies: [],
      retryCount: 0,
    });

    // Splice Atlas into the L3 task's dependencies so it resumes
    const failedTask = await ctx.db.get(args.failedTaskId);
    if (failedTask) {
      await ctx.db.patch(args.failedTaskId, {
        dependencies: [...failedTask.dependencies, atlasTaskId]
      });
    }

    return atlasTaskId;
  }
});

// =========================================================================
// ACTIONS
// =========================================================================

export const dispatchDirective = internalAction({
  args: { 
    directiveId: v.id("directives"),
    taskMatrix: v.string(),
  },
  handler: async (ctx, args) => {
    let parsedTasks: any[];
    try {
      parsedTasks = JSON.parse(args.taskMatrix);
    } catch {
      throw new Error("Failed to parse task matrix from playbook.");
    }

    const resolvedTasks: any[] = [];
    for (const task of parsedTasks) {
      let assignedAgentId = task.assignedAgentId;
      const agent = await ctx.runQuery(internal.engine.getAgentByName, { name: task.assignedAgentId });
      if (agent) assignedAgentId = agent._id;

      resolvedTasks.push({
        title: task.title,
        description: task.descriptionTemplate,
        assignedAgentId,
        autonomyLevel: 1 as 1 | 2 | 3,
        dependsOnIndices: task.dependencies.map((d: string) => parseInt(d)).filter((d: number) => !isNaN(d)),
      });
    }

    const taskIds = await ctx.runMutation(internal.engine.createTaskBatch, {
      directiveId: args.directiveId,
      tasks: resolvedTasks,
    });

    for (let i = 0; i < resolvedTasks.length; i++) {
      if (resolvedTasks[i].dependsOnIndices.length === 0) {
        await ctx.scheduler.runAfter(0, internal.engine.executeTask, { taskId: taskIds[i] });
      }
    }
  },
});

export const executeTask = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.engine.startTask, { taskId: args.taskId });

    const taskData = await ctx.runQuery(internal.engine.getTaskById, { taskId: args.taskId });
    if (!taskData) throw new Error("Task not found");

    const agent = await ctx.runQuery(internal.engine.getAgentById, { agentId: taskData.assignedAgentId });
    if (!agent) throw new Error("Assigned agent not found");

    const maxRetries = taskData.autonomyLevel === 1 ? L1_MAX_ITERATIONS : L3_MAX_RETRIES;



    const results = await ctx.runAction(internal.memory.queryMemory, {
      queryText: `Task: ${taskData.title}\nDescription: ${taskData.description}`,
      departmentTag: agent.departmentId,
      limit: 3,
    });
    
    let ragContext = "No relevant documents found.";
    if (results.length > 0) {
      ragContext = results.map((r: any, i: number) => `[Document ${i + 1}: ${r.title}]\n${r.content}`).join("\n\n");
    }

    await ctx.runMutation(internal.telemetry.logEvent, {
      traceId: taskData.directiveId,
      actor: `agent: ${agent.name}`,
      eventType: "RAG_QUERY",
      rawPayload: { taskId: args.taskId, documentsFound: results.length },
    });

    const { executeAITask } = await import("./ai");
    const tier = CAPABILITY_TO_TIER[agent.routingRequest] ?? 1;

    const planPrompt = `${agent.systemPrompt}\n\n## Context\n${ragContext}\n\nTask: ${taskData.title}`;
    const userPrompt = `Execute this task at Autonomy Level ${taskData.autonomyLevel}.`;

    const startMs = Date.now();
    let result: string;
    let succeeded = false;

    try {
      // Execute with Context passed through for 429 Error Escapes
      result = await executeAITask(tier, planPrompt, userPrompt, ctx, args.taskId);
      if (result.includes("429 Rate Limit hit")) {
         // Gracefully exit and let the scheduler handle it.
         return;
      }
      succeeded = true;
    } catch (error: any) {
      result = `[EXECUTION ERROR] ${error?.message ?? String(error)}`;
    }

    const latencyMs = Date.now() - startMs;

    await ctx.runMutation(internal.telemetry.logEvent, {
      traceId: taskData.directiveId,
      actor: `agent: ${agent.name}`,
      eventType: "TOOL_INVOCATION",
      rawPayload: { taskId: args.taskId, tier, succeeded, resultPreview: result.slice(0, 300) },
      metrics: { latencyMs, tokensUsed: 0 },
    });

    if (!succeeded) {
      const currentRetries = taskData.retryCount ?? 0;

      if (currentRetries < maxRetries - 1) {
        await ctx.runMutation(internal.engine.incrementRetry, { taskId: args.taskId });

        await ctx.runMutation(internal.telemetry.logEvent, {
          traceId: taskData.directiveId,
          actor: `agent: ${agent.name}`,
          eventType: "ERROR_ESCALATION",
          rawPayload: { taskId: args.taskId, retryAttempt: currentRetries + 1 },
        });

        // ATLAS DEBUG PROTOCOL: Target L3 failure injections
        if (taskData.autonomyLevel === (3 as number)) {
          const atlasId = await ctx.runMutation(internal.engine.injectAtlasDebugTask, {
            failedTaskId: args.taskId,
            directiveId: taskData.directiveId,
            taskTitle: taskData.title,
            errorPayload: result
          });

          // Spin up Atlas immediately to debug and rectify the failure payload before we wake again
          await ctx.scheduler.runAfter(0, internal.engine.executeTask, { taskId: atlasId });
          return;
        }

        // Standard Retry Backoff for Level 1 tasks
        await ctx.scheduler.runAfter(1000, internal.engine.executeTask, { taskId: args.taskId });
        return;
      } else {
        await ctx.runMutation(internal.engine.failTask, {
          taskId: args.taskId,
          reason: `Exhausted ${maxRetries} attempts.`,
        });
        return;
      }
    }

    await ctx.runMutation(internal.engine.generateArtifact, {
      directiveId: taskData.directiveId,
      agentName: agent.name,
      title: `[${agent.name}] ${taskData.title}`,
      content: result,
      departmentId: agent.departmentId,
    });



    await ctx.runMutation(internal.engine.completeTask, {
      taskId: args.taskId,
      artifactContent: result,
    });
  },
});
