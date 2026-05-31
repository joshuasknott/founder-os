import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { anyApi, type FunctionReference } from "convex/server";
import { actorFromIdentity, isAuthorizedWorkerToken, requireCurrentUser, requireWorkspaceAccess, workerActor } from "./authz";
import { recordAuditEvent } from "./audit";
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
  validateApiKeyConnectorSetup,
  type ConnectorActionType,
  type ConnectorConnectionStatus,
} from "./connectorRuntime";
import {
  buildGitHubAppInstallUrl,
  buildOAuthAuthorizationUrl,
  connectorIdsForOAuthSetup,
  createConnectorSetupState,
  createPkcePair,
  exchangeOAuthCode,
  oauthProviderForConnector,
  parseOAuthTokenResult,
  randomConnectorSecret,
  refreshOAuthToken,
  verifyConnectorSetupState,
  type OAuthConnectorId,
} from "./connectorAuthRuntime";
import {
  fetchStripeReadOnlyDataset,
  prepareStripeSync,
  type PreparedStripeFact,
  type PreparedStripeItem,
} from "./stripeConnector";

function storedStatus(status: ConnectorConnectionStatus): Exclude<ConnectorConnectionStatus, "not_connected"> {
  return status === "not_connected" ? "needs_attention" : status;
}

const STRIPE_CONNECTOR_ID = "stripe";
const STRIPE_SYNC_ACTION = "sync_stripe_finance_context";
const STRIPE_CONNECTION_SETUP_MESSAGE =
  "Finish the private read-only Stripe connection setup before syncing finance context.";
const CONNECTOR_SETUP_SESSION_MS = 15 * 60 * 1000;
const CONNECTION_SYNC_ENTITY = "connection";

function connectorStateSecret() {
  return process.env.CONNECTOR_OAUTH_STATE_SECRET
    ?? process.env.BETTER_AUTH_SECRET
    ?? process.env.CONNECTOR_SECRET_ENCRYPTION_KEY
    ?? "founderos-local-dev-connector-state";
}

function connectorSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.BETTER_AUTH_BASE_URL
    ?? "http://localhost:3000"
  ).replace(/\/+$/g, "");
}

function oauthRedirectUri(providerId: OAuthConnectorId) {
  const url = new URL("/settings", connectorSiteUrl());
  url.searchParams.set("connector_provider", providerId);
  return url.toString();
}

function oauthClientCredentials(providerId: OAuthConnectorId) {
  if (providerId === "google_workspace") {
    return {
      clientId: process.env.GOOGLE_CONNECTOR_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CONNECTOR_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  return {
    clientId: process.env.CANVA_CLIENT_ID,
    clientSecret: process.env.CANVA_CLIENT_SECRET,
  };
}

function githubAppName() {
  return process.env.GITHUB_APP_NAME ?? "founderos";
}

function connectorRequest(input: string, init?: Parameters<typeof fetch>[1]) {
  return fetch(input, init).then((response) => ({
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    json: () => response.json() as Promise<unknown>,
  }));
}

function setupStatusFromConnection(status: ConnectorConnectionStatus) {
  return status === "connected" ? "idle" as const : "needs_attention" as const;
}

type ConnectorSetupSessionForAction = {
  _id: Id<"connectorSetupSessions">;
  workspaceId: Id<"workspaces">;
  providerId: string;
  connectorIds: string[];
  status: string;
  expiresAt: number;
  codeVerifierCredentialRef?: string;
};
const internalConnectors = anyApi.connectors as unknown as {
  startConnection: FunctionReference<"mutation", "public", {
    workspaceId: string;
    connectorId: string;
    settings?: unknown;
  }, string>;
  completeManagedConnection: FunctionReference<"mutation", "public", {
    workspaceId: string;
    connectorId: string;
    credentialHandle: string;
    grantedScopes: string[];
    settings?: unknown;
    connectedBy?: string;
    tokenExpiresAt?: number;
    refreshCredentialHandle?: string;
    metadata?: unknown;
  }, string>;
  getConnectorConnectionForSync: FunctionReference<"query", "internal", {
    workspaceId: string;
    connectorId: string;
  }>;
  getConnectorCredentialBundle: FunctionReference<"query", "internal", {
    workspaceId: string;
    connectorId: string;
  }, unknown>;
  getConnectorSetupSessionByState: FunctionReference<"query", "internal", {
    state: string;
  }, unknown>;
  getConnectorCredentialByVaultKey: FunctionReference<"query", "internal", {
    vaultKey: string;
  }, unknown>;
  createConnectorSetupSession: FunctionReference<"mutation", "internal", {
    workspaceId: string;
    providerId: string;
    connectorIds: string[];
    state: string;
    codeVerifier?: string;
    expiresAt: number;
  }, string>;
  markConnectorSetupSession: FunctionReference<"mutation", "internal", {
    sessionId: string;
    status: "completed" | "failed" | "expired";
    safeMessage: string;
  }, string>;
  logConnectorAction: FunctionReference<"mutation", "internal", {
    workspaceId: string;
    connectionId?: string;
    connectorId: string;
    actionType: string;
    requestedBy?: string;
    status: "pending" | "completed" | "needs_attention" | "approval_required" | "failed";
    approvalRequired: boolean;
    safeSummary: string;
    safeError?: string;
    internalErrorCode?: string;
  }>;
  persistStripeSync: FunctionReference<"mutation", "internal", {
    workspaceId: string;
    connectionId?: string;
    requestedBy?: string;
    dataset: unknown;
  }, unknown>;
  authorizeWorkspaceForAction: FunctionReference<"query", "internal", {
    workspaceId: string;
  }, unknown>;
  upsertConnectorSyncState: FunctionReference<"mutation", "internal", {
    workspaceId: string;
    connectorId: string;
    entityType: string;
    cursor?: string;
    status: "idle" | "syncing" | "needs_attention" | "failed";
    lastSuccessfulSyncAt?: number;
    lastAttemptedSyncAt?: number;
    lastSafeMessage?: string;
    lastSafeError?: string;
    metadata?: unknown;
  }, unknown>;
};

function isStripeFactMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const source = metadata as Record<string, unknown>;
  if (source.connectorId === STRIPE_CONNECTOR_ID) return true;
  const connector = source.connector;
  if (connector && typeof connector === "object" && !Array.isArray(connector)) {
    return (connector as Record<string, unknown>).connectorId === STRIPE_CONNECTOR_ID;
  }
  return false;
}

async function upsertConnectionSyncStateDirect(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    connectorId: string;
    status: "idle" | "syncing" | "needs_attention" | "failed";
    safeMessage?: string;
    safeError?: string;
    cursor?: string;
    successful?: boolean;
    metadata?: unknown;
    now: number;
    entityType?: string;
  },
) {
  const entityType = args.entityType ?? CONNECTION_SYNC_ENTITY;
  const existing = await ctx.db
    .query("connectorSyncStates")
    .withIndex("by_workspace_connector_entity", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId).eq("entityType", entityType),
    )
    .first();

  const patch = {
    cursor: args.cursor,
    status: args.status,
    lastSuccessfulSyncAt: args.successful ? args.now : existing?.lastSuccessfulSyncAt,
    lastAttemptedSyncAt: args.now,
    lastSafeMessage: args.safeMessage,
    lastSafeError: args.safeError,
    metadata: args.metadata,
    updatedAt: args.now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }

  return await ctx.db.insert("connectorSyncStates", {
    workspaceId: args.workspaceId,
    connectorId: args.connectorId,
    entityType,
    createdAt: args.now,
    ...patch,
  });
}

async function upsertStripePreparedItem(
  ctx: MutationCtx,
  args: {
    workspaceId: Parameters<typeof createItemWithVersion>[1]["workspaceId"];
    item: PreparedStripeItem;
    now: number;
  },
) {
  const imported = buildConnectorImport({
    connectorId: STRIPE_CONNECTOR_ID,
    connectorName: "Stripe",
    externalId: args.item.externalId,
    externalType: args.item.externalType,
    title: args.item.title,
    content: args.item.content,
    summary: args.item.summary,
    kind: args.item.kind,
    format: args.item.format,
    tags: args.item.tags,
    sourceName: args.item.sourceName,
    externalCreatedAt: args.item.externalCreatedAt,
    externalUpdatedAt: args.item.externalUpdatedAt,
    importedAt: args.now,
  });

  const existing = (
    await ctx.db
      .query("items")
      .withIndex("by_external", (q) =>
        q.eq("source", "connector").eq("externalId", imported.externalId),
      )
      .collect()
  ).find((item) => item.workspaceId === args.workspaceId);

  if (existing) {
    const versionId = await appendItemVersion(ctx, {
      itemId: existing._id,
      title: imported.title,
      summary: imported.summary,
      content: imported.content,
      format: imported.format,
      sourceUrl: imported.sourceUrl,
      mimeType: imported.mimeType,
      createdBy: imported.author,
      createdAt: args.now,
      metadata: imported.metadata,
    });

    await ctx.db.patch(existing._id, {
      title: imported.title,
      kind: imported.kind,
      status: "active",
      author: imported.author,
      summary: imported.summary,
      sourceUrl: imported.sourceUrl,
      mimeType: imported.mimeType,
      tags: imported.tags,
      metadata: imported.metadata,
      updatedAt: args.now,
    });

    return { itemId: existing._id, versionId, storedExternalId: imported.externalId };
  }

  const created = await createItemWithVersion(ctx, {
    workspaceId: args.workspaceId,
    title: imported.title,
    kind: imported.kind,
    status: imported.status,
    source: imported.source,
    author: imported.author,
    summary: imported.summary,
    content: imported.content,
    format: imported.format,
    sourceUrl: imported.sourceUrl,
    externalId: imported.externalId,
    mimeType: imported.mimeType,
    tags: imported.tags,
    metadata: imported.metadata,
    createdAt: args.now,
  });

  return { itemId: created.itemId, versionId: created.versionId, storedExternalId: imported.externalId };
}

async function replaceStripeFactsForItem(
  ctx: MutationCtx,
  args: {
    workspaceId: Parameters<typeof createItemWithVersion>[1]["workspaceId"];
    itemId: Parameters<typeof appendItemVersion>[1]["itemId"];
    facts: PreparedStripeFact[];
    now: number;
  },
) {
  const existingFacts = await ctx.db
    .query("facts")
    .withIndex("by_source_item", (q) => q.eq("sourceItemId", args.itemId))
    .collect();

  await Promise.all(
    existingFacts
      .filter((fact) => isStripeFactMetadata(fact.metadata))
      .map((fact) => ctx.db.delete(fact._id)),
  );

  for (const fact of args.facts) {
    await ctx.db.insert("facts", {
      workspaceId: args.workspaceId,
      itemId: args.itemId,
      sourceItemId: args.itemId,
      subject: fact.subject,
      predicate: fact.predicate,
      object: fact.object,
      value: fact.value,
      confidence: fact.confidence,
      status: fact.status,
      validFrom: fact.validFrom,
      metadata: fact.metadata,
      createdAt: args.now,
      updatedAt: args.now,
    });
  }
}

export const listRegistry = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    return listConnectorDefinitions().map(publicConnectorDefinition);
  },
});

export const listForWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
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
    await requireWorkspaceAccess(ctx, args.workspaceId);
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

export const getConnectorConnectionForSync = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("connectorConnections")
      .withIndex("by_workspace_connector", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId),
      )
      .first();
  },
});

export const authorizeWorkspaceForAction = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return { ok: true };
  },
});

export const getConnectorConnectionForWorker = query({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    workerToken: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isAuthorizedWorkerToken(args.workerToken)) throw new Error("Worker authorization required.");
    const connection = await ctx.db
      .query("connectorConnections")
      .withIndex("by_workspace_connector", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId),
      )
      .first();
    if (!connection) return null;
    return {
      connectorId: connection.connectorId,
      status: connection.status,
      grantedScopes: connection.grantedScopes,
      settings: connection.settings,
      lastSafeMessage: connection.lastSafeMessage,
    };
  },
});

export const getConnectorCredentialBundle = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("connectorConnections")
      .withIndex("by_workspace_connector", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId),
      )
      .first();
    const credential = connection?.credentialRef
      ? await ctx.db
          .query("connectorCredentials")
          .withIndex("by_vault_key", (q) => q.eq("vaultKey", connection.credentialRef!))
          .first()
      : null;
    const refreshCredential = credential?.refreshCredentialRef
      ? await ctx.db
          .query("connectorCredentials")
          .withIndex("by_vault_key", (q) => q.eq("vaultKey", credential.refreshCredentialRef!))
          .first()
      : null;

    return { connection, credential, refreshCredential };
  },
});

export const getConnectorSetupSessionByState = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("connectorSetupSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();
  },
});

export const getConnectorCredentialByVaultKey = internalQuery({
  args: { vaultKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("connectorCredentials")
      .withIndex("by_vault_key", (q) => q.eq("vaultKey", args.vaultKey))
      .first();
  },
});

export const createConnectorSetupSession = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    providerId: v.string(),
    connectorIds: v.array(v.string()),
    state: v.string(),
    codeVerifier: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const verifierEnvelope = args.codeVerifier
      ? await connectorCredentialStorage.seal({
          workspaceId: String(args.workspaceId),
          connectorId: `${args.providerId}:oauth_pkce`,
          secret: args.codeVerifier,
          now,
          metadata: { credentialKind: "oauth_pkce_verifier", providerId: args.providerId },
        })
      : undefined;

    if (verifierEnvelope) {
      await ctx.db.insert("connectorCredentials", {
        workspaceId: args.workspaceId,
        connectorId: `${args.providerId}:oauth_pkce`,
        storageProvider: verifierEnvelope.storageProvider,
        vaultKey: verifierEnvelope.vaultKey,
        sealedReference: verifierEnvelope.sealedReference,
        encryptedSecret: verifierEnvelope.encryptedSecret,
        encryptionAlgorithm: verifierEnvelope.encryptionAlgorithm,
        encryptionNonce: verifierEnvelope.encryptionNonce,
        fingerprint: verifierEnvelope.fingerprint,
        keyVersion: verifierEnvelope.keyVersion,
        secretPreview: verifierEnvelope.secretPreview,
        metadata: verifierEnvelope.metadata,
        createdAt: now,
      });
    }

    return await ctx.db.insert("connectorSetupSessions", {
      workspaceId: args.workspaceId,
      providerId: args.providerId,
      connectorIds: args.connectorIds,
      state: args.state,
      status: "pending",
      codeVerifierCredentialRef: verifierEnvelope?.vaultKey,
      createdAt: now,
      expiresAt: args.expiresAt,
      lastSafeMessage: "Connection setup started.",
    });
  },
});

export const markConnectorSetupSession = internalMutation({
  args: {
    sessionId: v.id("connectorSetupSessions"),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("expired")),
    safeMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: args.status,
      completedAt: Date.now(),
      lastSafeMessage: args.safeMessage,
    });
    return args.sessionId;
  },
});

export const logConnectorAction = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectionId: v.optional(v.id("connectorConnections")),
    connectorId: v.string(),
    actionType: v.string(),
    requestedBy: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("needs_attention"),
      v.literal("approval_required"),
      v.literal("failed"),
    ),
    approvalRequired: v.boolean(),
    safeSummary: v.string(),
    safeError: v.optional(v.string()),
    internalErrorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("connectorActionLogs", {
      workspaceId: args.workspaceId,
      connectionId: args.connectionId,
      connectorId: args.connectorId,
      actionType: args.actionType,
      requestedBy: args.requestedBy,
      status: args.status,
      approvalRequired: args.approvalRequired,
      safeSummary: args.safeSummary,
      safeError: args.safeError,
      internalErrorCode: args.internalErrorCode,
      createdAt: now,
      completedAt: now,
    });
    await recordAuditEvent(ctx, {
      actorId: args.requestedBy ?? "system",
      actorName: args.requestedBy ?? "FounderOS",
      actorType: "system",
      workspaceId: args.workspaceId,
      action: "connector.action_logged",
      resourceType: "connectorAction",
      summary: args.safeSummary,
      metadata: {
        connectorId: args.connectorId,
        actionType: args.actionType,
        status: args.status,
        approvalRequired: args.approvalRequired,
      },
    });
  },
});

export const getConnectorSyncState = query({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    entityType: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    const state = await ctx.db
      .query("connectorSyncStates")
      .withIndex("by_workspace_connector_entity", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId).eq("entityType", args.entityType),
      )
      .first();
    if (!state) return null;
    return {
      connectorId: state.connectorId,
      entityType: state.entityType,
      status: state.status,
      cursor: state.cursor,
      lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
      lastAttemptedSyncAt: state.lastAttemptedSyncAt,
      lastSafeMessage: state.lastSafeMessage,
      lastSafeError: state.lastSafeError,
      updatedAt: state.updatedAt,
    };
  },
});

export const upsertConnectorSyncState = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    entityType: v.string(),
    cursor: v.optional(v.string()),
    status: v.union(
      v.literal("idle"),
      v.literal("syncing"),
      v.literal("needs_attention"),
      v.literal("failed"),
    ),
    lastSuccessfulSyncAt: v.optional(v.number()),
    lastAttemptedSyncAt: v.optional(v.number()),
    lastSafeMessage: v.optional(v.string()),
    lastSafeError: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("connectorSyncStates")
      .withIndex("by_workspace_connector_entity", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId).eq("entityType", args.entityType),
      )
      .first();

    const patch = {
      cursor: args.cursor,
      status: args.status,
      lastSuccessfulSyncAt: args.lastSuccessfulSyncAt,
      lastAttemptedSyncAt: args.lastAttemptedSyncAt ?? now,
      lastSafeMessage: args.lastSafeMessage,
      lastSafeError: args.lastSafeError,
      metadata: args.metadata,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("connectorSyncStates", {
      workspaceId: args.workspaceId,
      connectorId: args.connectorId,
      entityType: args.entityType,
      createdAt: now,
      ...patch,
    });
  },
});

export const persistStripeSync = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectionId: v.optional(v.id("connectorConnections")),
    requestedBy: v.optional(v.string()),
    dataset: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const prepared = prepareStripeSync({
      dataset: args.dataset,
      syncedAt: args.dataset?.syncedAt ?? now,
    });
    const factsByExternalId = new Map<string, PreparedStripeFact[]>();

    for (const fact of prepared.facts) {
      const facts = factsByExternalId.get(fact.itemExternalId) ?? [];
      facts.push(fact);
      factsByExternalId.set(fact.itemExternalId, facts);
    }

    for (const item of prepared.items) {
      const stored = await upsertStripePreparedItem(ctx, {
        workspaceId: args.workspaceId,
        item,
        now,
      });
      await replaceStripeFactsForItem(ctx, {
        workspaceId: args.workspaceId,
        itemId: stored.itemId,
        facts: factsByExternalId.get(item.externalId) ?? [],
        now,
      });
    }

    if (args.connectionId) {
      await ctx.db.patch(args.connectionId, {
        status: "connected",
        lastTestedAt: now,
        lastHealthyAt: now,
        lastSafeMessage: prepared.summary.safeSummary,
        updatedAt: now,
      });
    }

    await upsertConnectionSyncStateDirect(ctx, {
      workspaceId: args.workspaceId,
      connectorId: STRIPE_CONNECTOR_ID,
      entityType: "finance_context",
      status: "idle",
      safeMessage: prepared.summary.safeSummary,
      successful: true,
      metadata: prepared.summary.counts,
      now,
    });

    await ctx.db.insert("connectorActionLogs", {
      workspaceId: args.workspaceId,
      connectionId: args.connectionId,
      connectorId: STRIPE_CONNECTOR_ID,
      actionType: STRIPE_SYNC_ACTION,
      requestedBy: args.requestedBy,
      status: "completed",
      approvalRequired: false,
      safeSummary: prepared.summary.safeSummary,
      createdAt: now,
      completedAt: now,
    });
    await recordAuditEvent(ctx, {
      actorId: args.requestedBy ?? "system",
      actorName: args.requestedBy ?? "FounderOS",
      actorType: "system",
      workspaceId: args.workspaceId,
      action: "connector.stripe_synced",
      resourceType: "connectorAction",
      summary: prepared.summary.safeSummary,
      metadata: prepared.summary.counts,
    });

    return {
      allowed: true,
      approvalRequired: false,
      reason: "ready" as const,
      safeMessage: prepared.summary.safeSummary,
      itemCount: prepared.summary.counts.items,
      factCount: prepared.summary.counts.facts,
      counts: prepared.summary.counts,
    };
  },
});

export const syncStripeFinance = action({
  args: {
    workspaceId: v.id("workspaces"),
    requestedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internalConnectors.authorizeWorkspaceForAction, {
      workspaceId: args.workspaceId,
    });
    const connection = await ctx.runQuery(internalConnectors.getConnectorConnectionForSync, {
      workspaceId: args.workspaceId,
      connectorId: STRIPE_CONNECTOR_ID,
    });
    const evaluation = evaluateConnectorActionRequest({
      connectorId: STRIPE_CONNECTOR_ID,
      actionType: STRIPE_SYNC_ACTION,
      connection,
    });

    if (!evaluation.allowed) {
      await ctx.runMutation(internalConnectors.logConnectorAction, {
        workspaceId: args.workspaceId,
        connectionId: connection?._id,
        connectorId: STRIPE_CONNECTOR_ID,
        actionType: STRIPE_SYNC_ACTION,
        requestedBy: args.requestedBy,
        status: evaluation.approvalRequired ? "approval_required" : "needs_attention",
        approvalRequired: evaluation.approvalRequired,
        safeSummary: evaluation.safeMessage,
      });
      return evaluation;
    }

    const bundle = await ctx.runQuery(internalConnectors.getConnectorCredentialBundle, {
      workspaceId: args.workspaceId,
      connectorId: STRIPE_CONNECTOR_ID,
    }) as {
      credential?: {
        encryptedSecret?: string;
        encryptionNonce?: string;
      } | null;
    };
    const credentialDoc = bundle.credential;
    if (!credentialDoc?.encryptedSecret || !credentialDoc.encryptionNonce) {
      await ctx.runMutation(internalConnectors.logConnectorAction, {
        workspaceId: args.workspaceId,
        connectionId: connection?._id,
        connectorId: STRIPE_CONNECTOR_ID,
        actionType: STRIPE_SYNC_ACTION,
        requestedBy: args.requestedBy,
        status: "needs_attention",
        approvalRequired: false,
        safeSummary: STRIPE_CONNECTION_SETUP_MESSAGE,
      });
      await ctx.runMutation(internalConnectors.upsertConnectorSyncState, {
        workspaceId: args.workspaceId,
        connectorId: STRIPE_CONNECTOR_ID,
        entityType: "finance_context",
        status: "needs_attention",
        lastSafeMessage: STRIPE_CONNECTION_SETUP_MESSAGE,
      });
      return {
        allowed: false,
        approvalRequired: false,
        reason: "not_connected" as const,
        safeMessage: STRIPE_CONNECTION_SETUP_MESSAGE,
      };
    }

    try {
      await ctx.runMutation(internalConnectors.upsertConnectorSyncState, {
        workspaceId: args.workspaceId,
        connectorId: STRIPE_CONNECTOR_ID,
        entityType: "finance_context",
        status: "syncing",
        lastSafeMessage: "Stripe finance context is syncing.",
      });
      const credential = await connectorCredentialStorage.unseal({
        encryptedSecret: credentialDoc.encryptedSecret,
        encryptionNonce: credentialDoc.encryptionNonce,
      });
      const dataset = await fetchStripeReadOnlyDataset({
        apiKey: credential,
        fetchFn: async (input, init) => {
          const response = await fetch(input, init);
          return {
            ok: response.ok,
            status: response.status,
            json: () => response.json() as Promise<unknown>,
          };
        },
      });

      return await ctx.runMutation(internalConnectors.persistStripeSync, {
        workspaceId: args.workspaceId,
        connectionId: connection?._id,
        requestedBy: args.requestedBy,
        dataset,
      });
    } catch (error) {
      const safeError = safeConnectorError(error);
      await ctx.runMutation(internalConnectors.logConnectorAction, {
        workspaceId: args.workspaceId,
        connectionId: connection?._id,
        connectorId: STRIPE_CONNECTOR_ID,
        actionType: STRIPE_SYNC_ACTION,
        requestedBy: args.requestedBy,
        status: "failed",
        approvalRequired: false,
        safeSummary: "Stripe finance context could not sync.",
        safeError,
        internalErrorCode: "STRIPE_SYNC_FAILED",
      });
      await ctx.runMutation(internalConnectors.upsertConnectorSyncState, {
        workspaceId: args.workspaceId,
        connectorId: STRIPE_CONNECTOR_ID,
        entityType: "finance_context",
        status: "failed",
        lastSafeMessage: "Stripe finance context could not sync.",
        lastSafeError: safeError,
      });
      return {
        allowed: false,
        approvalRequired: false,
        reason: "not_connected" as const,
        safeMessage: safeError,
      };
    }
  },
});

export const startOAuthConnection = action({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    const providerId = oauthProviderForConnector(args.connectorId);
    const connectorIds = connectorIdsForOAuthSetup(args.connectorId);
    if (!providerId || connectorIds.length === 0) {
      return { ok: false, safeMessage: "That service is not available for sign-in setup." };
    }

    const client = oauthClientCredentials(providerId);
    if (!client.clientId || !client.clientSecret) {
      return { ok: false, safeMessage: "Sign-in setup is not configured yet." };
    }

    for (const connectorId of connectorIds) {
      await ctx.runMutation(internalConnectors.startConnection, {
        workspaceId: args.workspaceId,
        connectorId,
      });
    }

    const now = Date.now();
    const state = await createConnectorSetupState(
      {
        workspaceId: String(args.workspaceId),
        providerId,
        connectorIds,
        nonce: randomConnectorSecret(18),
        issuedAt: now,
      },
      connectorStateSecret(),
    );
    const pkce = providerId === "canva" ? await createPkcePair() : undefined;

    await ctx.runMutation(internalConnectors.createConnectorSetupSession, {
      workspaceId: args.workspaceId,
      providerId,
      connectorIds,
      state,
      codeVerifier: pkce?.verifier,
      expiresAt: now + CONNECTOR_SETUP_SESSION_MS,
    });

    return {
      ok: true,
      authorizationUrl: buildOAuthAuthorizationUrl({
        connectorId: providerId,
        clientId: client.clientId,
        redirectUri: oauthRedirectUri(providerId),
        state,
        prompt: providerId === "google_workspace" ? "consent" : undefined,
        codeChallenge: pkce?.challenge,
        codeChallengeMethod: pkce?.method,
      }),
      safeMessage: "Continue in the service window to finish connecting.",
    };
  },
});

export const completeOAuthConnection = action({
  args: {
    state: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    let session: ConnectorSetupSessionForAction | null = null;

    try {
      const payload = await verifyConnectorSetupState({
        state: args.state,
        secret: connectorStateSecret(),
        now: Date.now(),
        maxAgeMs: CONNECTOR_SETUP_SESSION_MS,
      });
      session = await ctx.runQuery(internalConnectors.getConnectorSetupSessionByState, {
        state: args.state,
      }) as ConnectorSetupSessionForAction | null;

      if (!session || session.workspaceId !== payload.workspaceId || session.providerId !== payload.providerId) {
        throw new Error("Connection setup expired. Start again from Settings.");
      }
      if (session.status !== "pending" || Date.now() > session.expiresAt) {
        throw new Error("Connection setup expired. Start again from Settings.");
      }

      await ctx.runQuery(internalConnectors.authorizeWorkspaceForAction, {
        workspaceId: session.workspaceId,
      });

      if (payload.providerId !== "google_workspace" && payload.providerId !== "canva") {
        throw new Error("Connection setup expired. Start again from Settings.");
      }
      const providerId = payload.providerId;
      const client = oauthClientCredentials(providerId);
      if (!client.clientId || !client.clientSecret) {
        throw new Error("Sign-in setup is not configured yet.");
      }

      let codeVerifier: string | undefined;
      if (session.codeVerifierCredentialRef) {
        const verifierCredential = await ctx.runQuery(internalConnectors.getConnectorCredentialByVaultKey, {
          vaultKey: session.codeVerifierCredentialRef,
        }) as { encryptedSecret?: string; encryptionNonce?: string } | null;
        if (!verifierCredential?.encryptedSecret || !verifierCredential.encryptionNonce) {
          throw new Error("Connection setup expired. Start again from Settings.");
        }
        codeVerifier = await connectorCredentialStorage.unseal({
          encryptedSecret: verifierCredential.encryptedSecret,
          encryptionNonce: verifierCredential.encryptionNonce,
        });
      }

      const tokenPayload = await exchangeOAuthCode({
        connectorId: providerId,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        code: args.code,
        redirectUri: oauthRedirectUri(providerId),
        codeVerifier,
        request: connectorRequest,
      });
      const token = parseOAuthTokenResult({
        connectorId: providerId,
        payload: tokenPayload,
        now: Date.now(),
      });

      for (const connectorId of session.connectorIds) {
        await ctx.runMutation(internalConnectors.completeManagedConnection, {
          workspaceId: session.workspaceId,
          connectorId,
          credentialHandle: token.accessToken,
          refreshCredentialHandle: token.refreshToken,
          tokenExpiresAt: token.expiresAt,
          grantedScopes: token.grantedScopes,
          connectedBy: "settings",
          metadata: { credentialKind: "oauth_access_token", providerId },
        });
      }

      await ctx.runMutation(internalConnectors.markConnectorSetupSession, {
        sessionId: session._id,
        status: "completed",
        safeMessage: "Connected and ready.",
      });

      return { ok: true, safeMessage: "Connected and ready." };
    } catch (error) {
      const safeMessage = safeConnectorError(error);
      if (session) {
        await ctx.runMutation(internalConnectors.markConnectorSetupSession, {
          sessionId: session._id,
          status: "failed",
          safeMessage,
        });
      }
      return { ok: false, safeMessage };
    }
  },
});

export const refreshOAuthConnection = action({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
  },
  handler: async (ctx, args) => {
    const providerId = oauthProviderForConnector(args.connectorId);
    if (!providerId) {
      return { ok: false, safeMessage: "That service is not available for refresh." };
    }

    try {
      await ctx.runQuery(internalConnectors.authorizeWorkspaceForAction, {
        workspaceId: args.workspaceId,
      });
      const bundle = await ctx.runQuery(internalConnectors.getConnectorCredentialBundle, {
        workspaceId: args.workspaceId,
        connectorId: args.connectorId,
      }) as {
        connection?: { settings?: unknown } | null;
        refreshCredential?: { encryptedSecret?: string; encryptionNonce?: string } | null;
      };
      if (!bundle.refreshCredential?.encryptedSecret || !bundle.refreshCredential.encryptionNonce) {
        return { ok: false, safeMessage: "Reconnect this service from Settings." };
      }

      const client = oauthClientCredentials(providerId);
      if (!client.clientId || !client.clientSecret) {
        return { ok: false, safeMessage: "Sign-in setup is not configured yet." };
      }

      const refreshSecret = await connectorCredentialStorage.unseal({
        encryptedSecret: bundle.refreshCredential.encryptedSecret,
        encryptionNonce: bundle.refreshCredential.encryptionNonce,
      });
      const tokenPayload = await refreshOAuthToken({
        connectorId: providerId,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        refreshToken: refreshSecret,
        request: connectorRequest,
      });
      const token = parseOAuthTokenResult({
        connectorId: providerId,
        payload: tokenPayload,
        now: Date.now(),
      });

      await ctx.runMutation(internalConnectors.completeManagedConnection, {
        workspaceId: args.workspaceId,
        connectorId: args.connectorId,
        credentialHandle: token.accessToken,
        refreshCredentialHandle: token.refreshToken ?? refreshSecret,
        tokenExpiresAt: token.expiresAt,
        grantedScopes: token.grantedScopes,
        settings: bundle.connection?.settings,
        connectedBy: "settings",
        metadata: { credentialKind: "oauth_access_token", providerId },
      });

      return { ok: true, safeMessage: "Connected and ready." };
    } catch (error) {
      return { ok: false, safeMessage: safeConnectorError(error) };
    }
  },
});

export const startGitHubAppConnection = action({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internalConnectors.startConnection, {
      workspaceId: args.workspaceId,
      connectorId: "github",
    });

    const now = Date.now();
    const state = await createConnectorSetupState(
      {
        workspaceId: String(args.workspaceId),
        providerId: "github_app",
        connectorIds: ["github"],
        nonce: randomConnectorSecret(18),
        issuedAt: now,
      },
      connectorStateSecret(),
    );
    await ctx.runMutation(internalConnectors.createConnectorSetupSession, {
      workspaceId: args.workspaceId,
      providerId: "github_app",
      connectorIds: ["github"],
      state,
      expiresAt: now + CONNECTOR_SETUP_SESSION_MS,
    });

    return {
      ok: true,
      installationUrl: buildGitHubAppInstallUrl({
        appName: githubAppName(),
        state,
      }),
      safeMessage: "Continue in GitHub to install the app.",
    };
  },
});

export const completeGitHubAppConnection = action({
  args: {
    state: v.string(),
    installationId: v.string(),
  },
  handler: async (ctx, args) => {
    let session: ConnectorSetupSessionForAction | null = null;

    try {
      const payload = await verifyConnectorSetupState({
        state: args.state,
        secret: connectorStateSecret(),
        now: Date.now(),
        maxAgeMs: CONNECTOR_SETUP_SESSION_MS,
      });
      if (payload.providerId !== "github_app") {
        throw new Error("Connection setup expired. Start again from Settings.");
      }
      session = await ctx.runQuery(internalConnectors.getConnectorSetupSessionByState, {
        state: args.state,
      }) as ConnectorSetupSessionForAction | null;
      if (!session || session.workspaceId !== payload.workspaceId || session.status !== "pending" || Date.now() > session.expiresAt) {
        throw new Error("Connection setup expired. Start again from Settings.");
      }

      await ctx.runQuery(internalConnectors.authorizeWorkspaceForAction, {
        workspaceId: session.workspaceId,
      });
      const installationId = args.installationId.trim().replace(/[^A-Za-z0-9]/g, "");
      if (!installationId) {
        throw new Error("GitHub did not finish installing. Start again from Settings.");
      }
      const definition = getConnectorDefinition("github");
      if (!definition) throw new Error("That service is not available yet.");

      await ctx.runMutation(internalConnectors.completeManagedConnection, {
        workspaceId: session.workspaceId,
        connectorId: "github",
        credentialHandle: installationId,
        grantedScopes: definition.requiredScopes,
        settings: { installationId },
        connectedBy: "settings",
        metadata: { credentialKind: "github_app_installation" },
      });
      await ctx.runMutation(internalConnectors.markConnectorSetupSession, {
        sessionId: session._id,
        status: "completed",
        safeMessage: "Choose the repository before FounderOS uses this connection.",
      });

      return {
        ok: true,
        safeMessage: "GitHub is installed. Choose the repository before FounderOS uses it.",
      };
    } catch (error) {
      const safeMessage = safeConnectorError(error);
      if (session) {
        await ctx.runMutation(internalConnectors.markConnectorSetupSession, {
          sessionId: session._id,
          status: "failed",
          safeMessage,
        });
      }
      return { ok: false, safeMessage };
    }
  },
});

export const startConnection = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireWorkspaceAccess(ctx, args.workspaceId, ["Owner"]);
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

    await upsertConnectionSyncStateDirect(ctx, {
      workspaceId: args.workspaceId,
      connectorId: definition.id,
      status: "needs_attention",
      safeMessage: "Connection setup started.",
      now,
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
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: args.workspaceId,
      action: "connector.connection_started",
      resourceType: "connectorConnection",
      resourceId: String(connectionId),
      summary: `Connection setup started for ${definition.safeDisplayName}.`,
      metadata: { connectorId: definition.id },
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
    tokenExpiresAt: v.optional(v.number()),
    refreshCredentialHandle: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireWorkspaceAccess(ctx, args.workspaceId, ["Owner"]);
    const definition = getConnectorDefinition(args.connectorId);
    if (!definition) throw new Error("That service is not available yet.");

    const now = Date.now();
    const refreshEnvelope = args.refreshCredentialHandle
      ? await connectorCredentialStorage.seal({
          workspaceId: String(args.workspaceId),
          connectorId: `${definition.id}:refresh`,
          secret: args.refreshCredentialHandle,
          now,
          metadata: { credentialKind: "refresh_token", connectorId: definition.id },
        })
      : undefined;

    if (refreshEnvelope) {
      await ctx.db.insert("connectorCredentials", {
        workspaceId: args.workspaceId,
        connectorId: definition.id,
        storageProvider: refreshEnvelope.storageProvider,
        vaultKey: refreshEnvelope.vaultKey,
        sealedReference: refreshEnvelope.sealedReference,
        encryptedSecret: refreshEnvelope.encryptedSecret,
        encryptionAlgorithm: refreshEnvelope.encryptionAlgorithm,
        encryptionNonce: refreshEnvelope.encryptionNonce,
        fingerprint: refreshEnvelope.fingerprint,
        keyVersion: refreshEnvelope.keyVersion,
        secretPreview: refreshEnvelope.secretPreview,
        metadata: refreshEnvelope.metadata,
        createdAt: now,
      });
    }

    const envelope = await connectorCredentialStorage.seal({
      workspaceId: String(args.workspaceId),
      connectorId: definition.id,
      secret: args.credentialHandle,
      now,
      tokenExpiresAt: args.tokenExpiresAt,
      refreshCredentialRef: refreshEnvelope?.vaultKey,
      metadata: args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
        ? args.metadata as Record<string, unknown>
        : undefined,
    });

    await ctx.db.insert("connectorCredentials", {
      workspaceId: args.workspaceId,
      connectorId: definition.id,
      storageProvider: envelope.storageProvider,
      vaultKey: envelope.vaultKey,
      sealedReference: envelope.sealedReference,
      encryptedSecret: envelope.encryptedSecret,
      encryptionAlgorithm: envelope.encryptionAlgorithm,
      encryptionNonce: envelope.encryptionNonce,
      fingerprint: envelope.fingerprint,
      keyVersion: envelope.keyVersion,
      secretPreview: envelope.secretPreview,
      tokenExpiresAt: envelope.tokenExpiresAt,
      refreshCredentialRef: envelope.refreshCredentialRef,
      metadata: envelope.metadata,
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

    await upsertConnectionSyncStateDirect(ctx, {
      workspaceId: args.workspaceId,
      connectorId: definition.id,
      status: setupStatusFromConnection(result.status),
      safeMessage: result.safeMessage,
      successful: result.healthy,
      now,
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
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: args.workspaceId,
      action: "connector.connection_completed",
      resourceType: "connectorConnection",
      resourceId: String(connectionId),
      summary: result.safeMessage,
      metadata: { connectorId: definition.id, status: result.status },
    });

    return connectionId;
  },
});

export const setupApiKeyConnection = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    apiKey: v.string(),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireWorkspaceAccess(ctx, args.workspaceId, ["Owner"]);
    const definition = getConnectorDefinition(args.connectorId);
    if (!definition) throw new Error("That service is not available yet.");

    const validation = validateApiKeyConnectorSetup({
      connectorId: args.connectorId,
      credential: args.apiKey,
      settings: args.settings,
    });
    if (!validation.ok) {
      return validation;
    }

    const now = Date.now();
    const envelope = await connectorCredentialStorage.seal({
      workspaceId: String(args.workspaceId),
      connectorId: definition.id,
      secret: args.apiKey,
      now,
      metadata: { credentialKind: "api_key", connectorId: definition.id },
    });

    await ctx.db.insert("connectorCredentials", {
      workspaceId: args.workspaceId,
      connectorId: definition.id,
      storageProvider: envelope.storageProvider,
      vaultKey: envelope.vaultKey,
      sealedReference: envelope.sealedReference,
      encryptedSecret: envelope.encryptedSecret,
      encryptionAlgorithm: envelope.encryptionAlgorithm,
      encryptionNonce: envelope.encryptionNonce,
      fingerprint: envelope.fingerprint,
      keyVersion: envelope.keyVersion,
      secretPreview: envelope.secretPreview,
      tokenExpiresAt: envelope.tokenExpiresAt,
      refreshCredentialRef: envelope.refreshCredentialRef,
      metadata: envelope.metadata,
      createdAt: now,
    });

    const existing = await ctx.db
      .query("connectorConnections")
      .withIndex("by_workspace_connector", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("connectorId", args.connectorId),
      )
      .first();
    const settings = validation.settings ?? existing?.settings;
    const result = testConnectorConnection(definition, {
      credentialRef: envelope.vaultKey,
      grantedScopes: validation.grantedScopes,
      settings,
    });

    const patch = {
      safeDisplayName: definition.safeDisplayName,
      authType: definition.authType,
      capabilities: definition.capabilities,
      requiredScopes: definition.requiredScopes,
      grantedScopes: validation.grantedScopes,
      approvalPolicy: definition.approvalPolicy,
      status: storedStatus(result.status),
      credentialRef: envelope.vaultKey,
      credentialFingerprint: envelope.fingerprint,
      credentialPreview: envelope.secretPreview,
      settings,
      connectedBy: String(current.user._id),
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

    await upsertConnectionSyncStateDirect(ctx, {
      workspaceId: args.workspaceId,
      connectorId: definition.id,
      status: setupStatusFromConnection(result.status),
      safeMessage: result.safeMessage,
      successful: result.healthy,
      now,
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
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: args.workspaceId,
      action: "connector.api_key_connected",
      resourceType: "connectorConnection",
      resourceId: String(connectionId),
      summary: result.safeMessage,
      metadata: { connectorId: definition.id, status: result.status },
    });

    return {
      ...validation,
      status: result.status,
      safeMessage: result.safeMessage,
      connectionId,
    };
  },
});

export const setupManagedConnection = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    connectorId: v.string(),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const current = await requireWorkspaceAccess(ctx, args.workspaceId, ["Owner"]);
    const definition = getConnectorDefinition(args.connectorId);
    if (!definition || definition.authType !== "managed") {
      throw new Error("That managed connection is not available yet.");
    }

    const now = Date.now();
    const settings = sanitizeConnectorConnectionSettings(definition.id, {
      ...(definition.id === "opencode" ? { command: "opencode" } : {}),
      ...(args.settings && typeof args.settings === "object" && !Array.isArray(args.settings)
        ? args.settings as Record<string, unknown>
        : {}),
    });
    const result = testConnectorConnection(definition, {
      status: "connected",
      grantedScopes: definition.requiredScopes,
      settings,
    });

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
      grantedScopes: definition.requiredScopes,
      approvalPolicy: definition.approvalPolicy,
      status: storedStatus(result.status),
      settings,
      connectedBy: String(current.user._id),
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

    await upsertConnectionSyncStateDirect(ctx, {
      workspaceId: args.workspaceId,
      connectorId: definition.id,
      status: setupStatusFromConnection(result.status),
      safeMessage: result.safeMessage,
      successful: result.healthy,
      now,
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
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: args.workspaceId,
      action: "connector.managed_connected",
      resourceType: "connectorConnection",
      resourceId: String(connectionId),
      summary: result.safeMessage,
      metadata: { connectorId: definition.id, status: result.status },
    });

    return {
      ok: result.healthy,
      connectorId: definition.id,
      grantedScopes: definition.requiredScopes,
      settings,
      status: result.status,
      safeMessage: result.safeMessage,
      connectionId,
    };
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
    const current = await requireWorkspaceAccess(ctx, connection.workspaceId, ["Owner"]);

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

    await upsertConnectionSyncStateDirect(ctx, {
      workspaceId: connection.workspaceId,
      connectorId: connection.connectorId,
      status: setupStatusFromConnection(result.status),
      safeMessage: result.safeMessage,
      successful: result.healthy,
      now,
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
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: connection.workspaceId,
      action: "connector.settings_updated",
      resourceType: "connectorConnection",
      resourceId: String(args.connectionId),
      summary: result.safeMessage,
      metadata: { connectorId: connection.connectorId, status: result.status },
    });

    return result;
  },
});

export const selectGitHubRepository = mutation({
  args: {
    connectionId: v.id("connectorConnections"),
    repositoryOwner: v.string(),
    repositoryName: v.string(),
    organizationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) throw new Error("Connection not found.");
    if (connection.connectorId !== "github") throw new Error("That repository setup is not available.");
    const current = await requireWorkspaceAccess(ctx, connection.workspaceId, ["Owner"]);
    const definition = getConnectorDefinition("github");
    if (!definition) throw new Error("That service is not available yet.");

    const now = Date.now();
    const settings = sanitizeConnectorConnectionSettings("github", {
      ...(connection.settings && typeof connection.settings === "object" && !Array.isArray(connection.settings)
        ? connection.settings as Record<string, unknown>
        : {}),
      repositoryOwner: args.repositoryOwner,
      repositoryName: args.repositoryName,
      organizationName: args.organizationName,
    });
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
    await upsertConnectionSyncStateDirect(ctx, {
      workspaceId: connection.workspaceId,
      connectorId: connection.connectorId,
      status: setupStatusFromConnection(result.status),
      safeMessage: result.safeMessage,
      successful: result.healthy,
      now,
    });
    await ctx.db.insert("connectorActionLogs", {
      workspaceId: connection.workspaceId,
      connectionId: args.connectionId,
      connectorId: "github",
      actionType: "select_repository",
      status: result.healthy ? "completed" : "needs_attention",
      approvalRequired: false,
      safeSummary: result.safeMessage,
      createdAt: now,
      completedAt: now,
    });
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: connection.workspaceId,
      action: "connector.github_repository_selected",
      resourceType: "connectorConnection",
      resourceId: String(args.connectionId),
      summary: result.safeMessage,
      metadata: { connectorId: "github", status: result.status },
    });

    return result;
  },
});

export const testConnection = mutation({
  args: { connectionId: v.id("connectorConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) throw new Error("Connection not found.");
    const current = await requireWorkspaceAccess(ctx, connection.workspaceId, ["Owner", "Contributor"]);

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

    await upsertConnectionSyncStateDirect(ctx, {
      workspaceId: connection.workspaceId,
      connectorId: connection.connectorId,
      status: setupStatusFromConnection(result.status),
      safeMessage: result.safeMessage,
      successful: result.healthy,
      now,
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
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: connection.workspaceId,
      action: "connector.connection_tested",
      resourceType: "connectorConnection",
      resourceId: String(args.connectionId),
      summary: result.safeMessage,
      metadata: { connectorId: connection.connectorId, status: result.status },
    });

    return result;
  },
});

export const disconnect = mutation({
  args: { connectionId: v.id("connectorConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) throw new Error("Connection not found.");
    const current = await requireWorkspaceAccess(ctx, connection.workspaceId, ["Owner"]);

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

    await upsertConnectionSyncStateDirect(ctx, {
      workspaceId: connection.workspaceId,
      connectorId: connection.connectorId,
      status: "needs_attention",
      safeMessage: "Turned off.",
      now,
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
    await recordAuditEvent(ctx, {
      ...actorFromIdentity(current.identity, current.user),
      workspaceId: connection.workspaceId,
      action: "connector.disconnected",
      resourceType: "connectorConnection",
      resourceId: String(args.connectionId),
      summary: "Connection turned off.",
      metadata: { connectorId: connection.connectorId },
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
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workerAuthorized = isAuthorizedWorkerToken(args.workerToken);
    const current = workerAuthorized ? null : await requireWorkspaceAccess(ctx, args.workspaceId, ["Owner", "Contributor"]);
    const actor = current ? actorFromIdentity(current.identity, current.user) : workerActor(args.requestedBy ?? "worker");
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
      await recordAuditEvent(ctx, {
        ...actor,
        workspaceId: args.workspaceId,
        action: "connector.import_blocked",
        resourceType: "connectorAction",
        summary: evaluation.safeMessage,
        metadata: { connectorId: args.connectorId, reason: evaluation.reason },
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
    await recordAuditEvent(ctx, {
      ...actor,
      workspaceId: args.workspaceId,
      action: "connector.content_imported",
      resourceType: "item",
      resourceId: String(itemId),
      summary: "Imported content is ready in Library.",
      metadata: { connectorId: definition.id, actionType: "import_content", versionId },
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
    workerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const workerAuthorized = isAuthorizedWorkerToken(args.workerToken);
    const current = workerAuthorized ? null : await requireWorkspaceAccess(ctx, args.workspaceId, ["Owner", "Contributor"]);
    const actor = current ? actorFromIdentity(current.identity, current.user) : workerActor(args.requestedBy ?? "worker");
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
      await recordAuditEvent(ctx, {
        ...actor,
        workspaceId: args.workspaceId,
        action: "connector.action_blocked",
        resourceType: "connectorAction",
        summary: evaluation.safeMessage,
        metadata: {
          connectorId: args.connectorId,
          actionType: args.actionType,
          reason: evaluation.reason,
          approvalRequired: evaluation.approvalRequired,
        },
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
      await recordAuditEvent(ctx, {
        ...actor,
        workspaceId: args.workspaceId,
        action: "connector.action_completed",
        resourceType: "connectorAction",
        summary: result.safeSummary,
        metadata: { connectorId: args.connectorId, actionType: args.actionType },
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
      await recordAuditEvent(ctx, {
        ...actor,
        workspaceId: args.workspaceId,
        action: "connector.action_failed",
        resourceType: "connectorAction",
        summary: safeError,
        metadata: { connectorId: args.connectorId, actionType: args.actionType },
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
