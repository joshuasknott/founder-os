import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { appendItemVersion, createItemWithVersion } from "./itemModel";
import { buildConnectorImport } from "./connectorContent";
import {
  connectorCredentialStorage,
  evaluateConnectorActionRequest,
  getConnectorAction,
  getConnectorActionHandler,
  getConnectorDefinition,
  listConnectorDefinitions,
  publicConnectionCard,
  publicConnectorDefinition,
  safeActionSummary,
  safeConnectorError,
  sanitizeConnectorConnectionSettings,
  testConnectorConnection,
  type ConnectorActionType,
  type ConnectorConnectionStatus,
} from "./connectorRuntime";

function storedStatus(status: ConnectorConnectionStatus): Exclude<ConnectorConnectionStatus, "not_connected"> {
  return status === "not_connected" ? "needs_attention" : status;
}

export const listRegistry = query({
  args: {},
  handler: async () => {
    return listConnectorDefinitions().map(publicConnectorDefinition);
  },
});

export const listForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const connections = await ctx.db
      .query("connectorConnections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const byConnector = new Map(connections.map((connection) => [connection.connectorId, connection]));

    return listConnectorDefinitions().map((definition) =>
      publicConnectionCard(definition, byConnector.get(definition.id)),
    );
  },
});

export const getActionLogs = query({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("connectorActionLogs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(25);

    return logs
      .filter((log) => !args.connectorId || log.connectorId === args.connectorId)
      .map((log) => ({
        _id: log._id,
        connectorId: log.connectorId,
        actionType: log.actionType,
        status: log.status,
        approvalRequired: log.approvalRequired,
        safeSummary: log.safeSummary,
        safeError: log.safeError,
        createdAt: log.createdAt,
        completedAt: log.completedAt,
      }));
  },
});

export const startConnection = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const definition = getConnectorDefinition(args.connectorId);
    if (!definition) throw new Error("That service is not available yet.");

    const now = Date.now();
    const existing = await ctx.db
      .query("connectorConnections")
      .withIndex("by_workspace_connector", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId),
      )
      .first();

    const patch = {
      safeDisplayName: definition.safeDisplayName,
      authType: definition.authType,
      capabilities: definition.capabilities,
      requiredScopes: definition.requiredScopes,
      grantedScopes: existing?.grantedScopes ?? [],
      settings: sanitizeConnectorConnectionSettings(definition.id, args.settings) ?? existing?.settings,
      approvalPolicy: definition.approvalPolicy,
      status: "needs_attention" as const,
      lastSafeMessage: "Finish connecting this service before FounderOS uses it.",
      disabledAt: undefined,
      updatedAt: now,
    };

    const connectionId = existing
      ? (await ctx.db.patch(existing._id, patch), existing._id)
      : await ctx.db.insert("connectorConnections", {
          workspaceId: args.workspaceId,
          connectorId: definition.id,
          ...patch,
          createdAt: now,
        });

    await ctx.db.insert("connectorActionLogs", {
      workspaceId: args.workspaceId,
      connectionId,
      connectorId: definition.id,
      actionType: "connect",
      status: "needs_attention",
      approvalRequired: false,
      safeSummary: "Connection setup started.",
      createdAt: now,
      completedAt: now,
    });

    return connectionId;
  },
});

export const completeManagedConnection = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    credentialHandle: v.string(),
    grantedScopes: v.array(v.string()),
    settings: v.optional(v.any()),
    connectedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const definition = getConnectorDefinition(args.connectorId);
    if (!definition) throw new Error("That service is not available yet.");

    const now = Date.now();
    const envelope = connectorCredentialStorage.seal({
      workspaceId: String(args.workspaceId),
      connectorId: definition.id,
      secret: args.credentialHandle,
      now,
    });

    await ctx.db.insert("connectorCredentials", {
      workspaceId: args.workspaceId,
      connectorId: definition.id,
      storageProvider: envelope.storageProvider,
      vaultKey: envelope.vaultKey,
      sealedReference: envelope.sealedReference,
      fingerprint: envelope.fingerprint,
      keyVersion: envelope.keyVersion,
      secretPreview: envelope.secretPreview,
      createdAt: now,
    });

    const existing = await ctx.db
      .query("connectorConnections")
      .withIndex("by_workspace_connector", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId),
      )
      .first();
    const settings = sanitizeConnectorConnectionSettings(definition.id, args.settings) ?? existing?.settings;
    const result = testConnectorConnection(definition, {
      credentialRef: envelope.vaultKey,
      grantedScopes: args.grantedScopes,
      settings,
    });

    const patch = {
      safeDisplayName: definition.safeDisplayName,
      authType: definition.authType,
      capabilities: definition.capabilities,
      requiredScopes: definition.requiredScopes,
      grantedScopes: args.grantedScopes,
      approvalPolicy: definition.approvalPolicy,
      status: storedStatus(result.status),
      credentialRef: envelope.vaultKey,
      credentialFingerprint: envelope.fingerprint,
      credentialPreview: envelope.secretPreview,
      settings,
      connectedBy: args.connectedBy,
      connectedAt: now,
      lastTestedAt: now,
      lastHealthyAt: result.healthy ? now : undefined,
      lastSafeMessage: result.safeMessage,
      disabledAt: undefined,
      updatedAt: now,
    };

    const connectionId = existing
      ? (await ctx.db.patch(existing._id, patch), existing._id)
      : await ctx.db.insert("connectorConnections", {
          workspaceId: args.workspaceId,
          connectorId: definition.id,
          ...patch,
          createdAt: now,
        });

    await ctx.db.insert("connectorActionLogs", {
      workspaceId: args.workspaceId,
      connectionId,
      connectorId: definition.id,
      actionType: "connect",
      status: result.healthy ? "completed" : "needs_attention",
      approvalRequired: false,
      safeSummary: result.safeMessage,
      createdAt: now,
      completedAt: now,
    });

    return connectionId;
  },
});

export const updateConnectionSettings = mutation({
  args: {
    connectionId: v.id("connectorConnections"),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) throw new Error("Connection not found.");

    const definition = getConnectorDefinition(connection.connectorId);
    if (!definition) throw new Error("That service is not available yet.");

    const now = Date.now();
    const settings = sanitizeConnectorConnectionSettings(definition.id, args.settings);
    const result = testConnectorConnection(definition, {
      ...connection,
      settings,
    });

    await ctx.db.patch(args.connectionId, {
      settings,
      status: storedStatus(result.status),
      lastTestedAt: now,
      lastHealthyAt: result.healthy ? now : connection.lastHealthyAt,
      lastSafeMessage: result.safeMessage,
      updatedAt: now,
    });

    await ctx.db.insert("connectorActionLogs", {
      workspaceId: connection.workspaceId,
      connectionId: args.connectionId,
      connectorId: connection.connectorId,
      actionType: "update_settings",
      status: result.healthy ? "completed" : "needs_attention",
      approvalRequired: false,
      safeSummary: result.safeMessage,
      createdAt: now,
      completedAt: now,
    });

    return result;
  },
});

export const testConnection = mutation({
  args: { connectionId: v.id("connectorConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) throw new Error("Connection not found.");

    const definition = getConnectorDefinition(connection.connectorId);
    if (!definition) throw new Error("That service is not available yet.");

    const now = Date.now();
    const result = testConnectorConnection(definition, connection);
    await ctx.db.patch(args.connectionId, {
      status: storedStatus(result.status),
      lastTestedAt: now,
      lastHealthyAt: result.healthy ? now : connection.lastHealthyAt,
      lastSafeMessage: result.safeMessage,
      updatedAt: now,
    });

    await ctx.db.insert("connectorActionLogs", {
      workspaceId: connection.workspaceId,
      connectionId: args.connectionId,
      connectorId: connection.connectorId,
      actionType: "test_connection",
      status: result.healthy ? "completed" : "needs_attention",
      approvalRequired: false,
      safeSummary: result.safeMessage,
      createdAt: now,
      completedAt: now,
    });

    return result;
  },
});

export const disconnect = mutation({
  args: { connectionId: v.id("connectorConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) throw new Error("Connection not found.");

    const now = Date.now();
    await ctx.db.patch(args.connectionId, {
      status: "disabled",
      credentialRef: undefined,
      credentialFingerprint: undefined,
      credentialPreview: undefined,
      grantedScopes: [],
      disabledAt: now,
      lastSafeMessage: "Turned off.",
      updatedAt: now,
    });

    await ctx.db.insert("connectorActionLogs", {
      workspaceId: connection.workspaceId,
      connectionId: args.connectionId,
      connectorId: connection.connectorId,
      actionType: "disconnect",
      status: "completed",
      approvalRequired: false,
      safeSummary: "Connection turned off.",
      createdAt: now,
      completedAt: now,
    });

    return args.connectionId;
  },
});

export const importContent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    externalId: v.string(),
    externalType: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    summary: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    authorName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    kind: v.optional(v.union(
      v.literal("doc"),
      v.literal("email"),
      v.literal("record"),
      v.literal("conversation"),
      v.literal("brief"),
      v.literal("plan"),
      v.literal("research"),
      v.literal("upload"),
    )),
    format: v.optional(v.union(
      v.literal("markdown"),
      v.literal("plain_text"),
      v.literal("html"),
      v.literal("json"),
      v.literal("external"),
    )),
    tags: v.optional(v.array(v.string())),
    sourceName: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
    traceId: v.optional(v.id("directives")),
    taskId: v.optional(v.id("tasks")),
    runId: v.optional(v.id("workRuns")),
    requestedBy: v.optional(v.string()),
    externalCreatedAt: v.optional(v.number()),
    externalUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const definition = getConnectorDefinition(args.connectorId);
    if (!definition) throw new Error("That service is not available yet.");

    const connection = await ctx.db
      .query("connectorConnections")
      .withIndex("by_workspace_connector", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId),
      )
      .first();
    const evaluation = evaluateConnectorActionRequest({
      connectorId: args.connectorId,
      actionType: "import_content",
      connection,
    });
    const now = Date.now();

    if (!evaluation.allowed) {
      await ctx.db.insert("connectorActionLogs", {
        workspaceId: args.workspaceId,
        connectionId: connection?._id,
        connectorId: args.connectorId,
        actionType: "import_content",
        requestedBy: args.requestedBy,
        directiveId: args.traceId,
        runId: args.runId,
        status: evaluation.approvalRequired ? "approval_required" : "needs_attention",
        approvalRequired: evaluation.approvalRequired,
        safeSummary: evaluation.safeMessage,
        createdAt: now,
        completedAt: now,
      });
      return evaluation;
    }

    const imported = buildConnectorImport({
      connectorId: definition.id,
      connectorName: definition.safeDisplayName,
      externalId: args.externalId,
      externalType: args.externalType,
      title: args.title,
      content: args.content,
      summary: args.summary,
      sourceUrl: args.sourceUrl,
      authorName: args.authorName,
      mimeType: args.mimeType,
      kind: args.kind,
      format: args.format,
      tags: args.tags,
      sourceName: args.sourceName,
      externalCreatedAt: args.externalCreatedAt,
      externalUpdatedAt: args.externalUpdatedAt,
      importedAt: now,
    });

    const existing = (
      await ctx.db
        .query("items")
        .withIndex("by_external", (q) =>
          q.eq("source", "connector").eq("externalId", imported.externalId),
        )
        .collect()
    ).find((item) => item.workspaceId === args.workspaceId);

    let itemId;
    let versionId;
    if (existing) {
      itemId = existing._id;
      versionId = await appendItemVersion(ctx, {
        itemId,
        title: imported.title,
        summary: imported.summary,
        content: imported.content,
        format: imported.format,
        sourceUrl: imported.sourceUrl,
        mimeType: imported.mimeType,
        createdBy: imported.author,
        createdAt: now,
        metadata: imported.metadata,
      });
      await ctx.db.patch(itemId, {
        title: imported.title,
        kind: imported.kind,
        status: "active",
        author: imported.author,
        summary: imported.summary,
        sourceUrl: imported.sourceUrl,
        mimeType: imported.mimeType,
        tags: imported.tags,
        metadata: imported.metadata,
        traceId: args.traceId ?? existing.traceId,
        taskId: args.taskId ?? existing.taskId,
        runId: args.runId ?? existing.runId,
        updatedAt: now,
      });
    } else {
      const created = await createItemWithVersion(ctx, {
        workspaceId: args.workspaceId,
        departmentId: args.departmentId,
        title: imported.title,
        kind: imported.kind,
        status: imported.status,
        source: imported.source,
        author: imported.author,
        summary: imported.summary,
        content: imported.content,
        format: imported.format,
        traceId: args.traceId,
        taskId: args.taskId,
        runId: args.runId,
        sourceUrl: imported.sourceUrl,
        externalId: imported.externalId,
        mimeType: imported.mimeType,
        tags: imported.tags,
        metadata: imported.metadata,
        createdAt: now,
      });
      itemId = created.itemId;
      versionId = created.versionId;
    }

    if (args.runId) {
      await ctx.db.insert("workArtifacts", {
        runId: args.runId,
        directiveId: args.traceId,
        title: imported.title,
        kind: "library_item",
        summary: imported.summary,
        url: imported.sourceUrl,
        libraryItemId: itemId,
        metadata: {
          connectorId: definition.id,
          action: "import_content",
        },
        createdAt: now,
      });
    }

    await ctx.db.insert("connectorActionLogs", {
      workspaceId: args.workspaceId,
      connectionId: connection?._id,
      connectorId: definition.id,
      actionType: "import_content",
      requestedBy: args.requestedBy,
      directiveId: args.traceId,
      runId: args.runId,
      status: "completed",
      approvalRequired: false,
      safeSummary: "Imported content is ready in Library.",
      createdAt: now,
      completedAt: now,
    });

    return {
      ...evaluation,
      itemId,
      versionId,
      safeMessage: "Imported content is ready in Library.",
    };
  },
});

export const requestAction = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    actionType: v.string(),
    approvalGranted: v.optional(v.boolean()),
    requestedBy: v.optional(v.string()),
    directiveId: v.optional(v.id("directives")),
    runId: v.optional(v.id("workRuns")),
    approvalId: v.optional(v.id("approvalQueue")),
  },
  handler: async (ctx, args) => {
    const definition = getConnectorDefinition(args.connectorId);
    const connection = await ctx.db
      .query("connectorConnections")
      .withIndex("by_workspace_connector", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId),
      )
      .first();
    const evaluation = evaluateConnectorActionRequest({
      connectorId: args.connectorId,
      actionType: args.actionType,
      connection,
      approvalGranted: args.approvalGranted,
    });
    const now = Date.now();

    if (!evaluation.allowed || !definition) {
      await ctx.db.insert("connectorActionLogs", {
        workspaceId: args.workspaceId,
        connectionId: connection?._id,
        connectorId: args.connectorId,
        actionType: args.actionType,
        requestedBy: args.requestedBy,
        directiveId: args.directiveId,
        runId: args.runId,
        approvalId: args.approvalId,
        status: evaluation.approvalRequired ? "approval_required" : "needs_attention",
        approvalRequired: evaluation.approvalRequired,
        safeSummary: evaluation.safeMessage,
        createdAt: now,
        completedAt: now,
      });
      return evaluation;
    }

    const action = getConnectorAction(definition, args.actionType);
    const handler = action ? getConnectorActionHandler(action.handlerKey) : undefined;

    try {
      const result = handler
        ? await handler({
            connectorId: definition.id,
            actionType: args.actionType as ConnectorActionType,
            approved: Boolean(args.approvalGranted),
          })
        : { status: "completed" as const, safeSummary: safeActionSummary(args.actionType) };

      await ctx.db.insert("connectorActionLogs", {
        workspaceId: args.workspaceId,
        connectionId: connection?._id,
        connectorId: args.connectorId,
        actionType: args.actionType,
        requestedBy: args.requestedBy,
        directiveId: args.directiveId,
        runId: args.runId,
        approvalId: args.approvalId,
        status: result.status,
        approvalRequired: evaluation.approvalRequired,
        safeSummary: result.safeSummary,
        createdAt: now,
        completedAt: Date.now(),
      });

      return {
        ...evaluation,
        safeMessage: result.safeSummary,
      };
    } catch (error) {
      const safeError = safeConnectorError(error);
      await ctx.db.insert("connectorActionLogs", {
        workspaceId: args.workspaceId,
        connectionId: connection?._id,
        connectorId: args.connectorId,
        actionType: args.actionType,
        requestedBy: args.requestedBy,
        directiveId: args.directiveId,
        runId: args.runId,
        approvalId: args.approvalId,
        status: "failed",
        approvalRequired: evaluation.approvalRequired,
        safeSummary: "The connection could not finish that step.",
        safeError,
        internalErrorCode: "CONNECTOR_ACTION_FAILED",
        createdAt: now,
        completedAt: Date.now(),
      });

      return {
        allowed: false,
        approvalRequired: evaluation.approvalRequired,
        reason: "not_connected" as const,
        safeMessage: safeError,
        sensitiveActionKind: evaluation.sensitiveActionKind,
      };
    }
  },
});
