import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type DbCtx = Pick<QueryCtx, "auth" | "db"> | Pick<MutationCtx, "auth" | "db">;
type Identity = NonNullable<Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>>;
type Role = Doc<"users">["role"];

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "icloud.com",
  "me.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "proton.me",
  "protonmail.com",
]);

export function publicError(message: string) {
  return new ConvexError(message);
}

export function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}

function titleCase(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function inferWorkspaceName(args: { email?: string | null; name?: string | null }) {
  const email = normalizeEmail(args.email);
  const domain = email.split("@")[1];
  if (domain && !PERSONAL_EMAIL_DOMAINS.has(domain)) {
    return titleCase(domain.replace(/\.[^.]+$/, "")) || "FounderOS";
  }

  const firstName = (args.name ?? email.split("@")[0] ?? "")
    .trim()
    .split(/\s+/)[0];
  return firstName ? `${titleCase(firstName)}'s Workspace` : "FounderOS";
}

export async function requireIdentity(ctx: Pick<QueryCtx, "auth"> | Pick<MutationCtx, "auth"> | Pick<ActionCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw publicError("Sign in to continue.");
  return identity;
}

export function actorFromIdentity(identity: Identity, user?: Pick<Doc<"users">, "_id" | "name" | "email">) {
  return {
    actorId: user ? String(user._id) : identity.tokenIdentifier,
    actorName: user?.name ?? identity.name ?? identity.email ?? "Founder",
    actorType: "user" as const,
  };
}

export function externalIdFromIdentity(identity: Identity) {
  return identity.tokenIdentifier;
}

export async function findUserForIdentity(ctx: DbCtx, identity: Identity) {
  const externalId = externalIdFromIdentity(identity);
  const email = normalizeEmail(identity.email);
  const byExternal = await ctx.db
    .query("users")
    .withIndex("by_external", (q) => q.eq("externalId", externalId))
    .first();
  if (byExternal) return byExternal;
  const legacySubject = identity.subject;
  if (legacySubject && legacySubject !== externalId) {
    const byLegacySubject = await ctx.db
      .query("users")
      .withIndex("by_external", (q) => q.eq("externalId", legacySubject))
      .first();
    if (byLegacySubject) return byLegacySubject;
  }
  if (!email) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

export async function ensureUserWorkspace(ctx: MutationCtx) {
  const identity = await requireIdentity(ctx);
  const now = Date.now();
  const externalId = externalIdFromIdentity(identity);
  const email = normalizeEmail(identity.email);
  const name = identity.name?.trim() || email.split("@")[0] || "Founder";
  const avatarUrl = typeof identity.pictureUrl === "string" ? identity.pictureUrl : undefined;

  const existingUser = await findUserForIdentity(ctx, identity);
  if (existingUser) {
    const patch: Partial<Doc<"users">> = {
      externalId,
      name,
      email,
      status: "online",
      avatarUrl,
    };
    await ctx.db.patch(existingUser._id, patch);
    return { identity, user: { ...existingUser, ...patch }, workspaceId: existingUser.workspaceId };
  }

  const firstWorkspace = await ctx.db.query("workspaces").first();
  const hasAnyUsers = (await ctx.db.query("users").take(1)).length > 0;
  const workspaceId =
    !hasAnyUsers && firstWorkspace
      ? firstWorkspace._id
      : await ctx.db.insert("workspaces", {
          name: inferWorkspaceName({ email, name }),
          iconSlug: "building-2",
          createdAt: now,
          dailySpendLimit: 50,
          alertThreshold: 40,
        });

  const userId = await ctx.db.insert("users", {
    externalId,
    workspaceId,
    name,
    email,
    role: "Owner",
    status: "online",
    avatarUrl,
    joinedAt: now,
  });
  const user = await ctx.db.get(userId);
  if (!user) throw publicError("Workspace could not be prepared.");

  return { identity, user, workspaceId };
}

export async function requireCurrentUser(ctx: DbCtx) {
  const identity = await requireIdentity(ctx);
  const user = await findUserForIdentity(ctx, identity);
  if (!user) {
    throw publicError("Your workspace is still being prepared. Refresh and try again.");
  }
  return { identity, user, workspaceId: user.workspaceId };
}

export function roleIsAllowed(role: Role, allowedRoles?: Role[]) {
  return !allowedRoles || allowedRoles.includes(role);
}

export async function requireWorkspaceAccess(
  ctx: DbCtx,
  workspaceId?: Id<"workspaces">,
  allowedRoles?: Role[],
) {
  const { identity, user } = await requireCurrentUser(ctx);
  const resolvedWorkspaceId = workspaceId ?? user.workspaceId;
  if (user.workspaceId !== resolvedWorkspaceId || !roleIsAllowed(user.role, allowedRoles)) {
    throw publicError("You do not have access to that workspace.");
  }
  return { identity, user, workspaceId: resolvedWorkspaceId };
}

export async function requireOwnedWorkspace(ctx: DbCtx, workspaceId: Id<"workspaces">) {
  return await requireWorkspaceAccess(ctx, workspaceId, ["Owner"]);
}

export async function requireDocumentWorkspace(
  ctx: DbCtx,
  workspaceId?: Id<"workspaces">,
  allowedRoles?: Role[],
) {
  const current = await requireWorkspaceAccess(ctx, workspaceId, allowedRoles);
  if (!workspaceId) return current;
  return current;
}

export function ensureDocWorkspace<T extends { workspaceId?: Id<"workspaces"> }>(
  doc: T | null,
  workspaceId: Id<"workspaces">,
  label = "Resource",
) {
  if (!doc) throw publicError(`${label} not found.`);
  if (!doc.workspaceId || doc.workspaceId !== workspaceId) {
    throw publicError("You do not have access to that workspace item.");
  }
  return doc;
}

export function isAuthorizedWorkerToken(workerToken?: string) {
  const expected = process.env.FOUNDEROS_WORKER_TOKEN;
  return Boolean(expected && workerToken && workerToken === expected);
}

export function requireWorkerToken(workerToken?: string) {
  if (!isAuthorizedWorkerToken(workerToken)) {
    throw publicError("Worker authorization required.");
  }
}

export function workerActor(workerId?: string) {
  return {
    actorId: workerId ?? "worker",
    actorName: workerId ?? "FounderOS worker",
    actorType: "worker" as const,
  };
}
