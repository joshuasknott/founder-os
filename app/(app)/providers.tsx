"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { LoginCard } from "@/components/auth/LoginCard";
import { OnboardingFlow } from "@/components/auth/OnboardingFlow";
import { installClerkAuthRefreshGuard } from "@/lib/clerk-auth-refresh-guard";
import {
  ACCOUNT_DELETION_PENDING_EVENT,
  clearAccountDeletionPending,
  clearDeletedAccountReadyHints,
  readAccountDeletionPending,
} from "@/lib/account-deletion-pending";
import { Loader2 } from "lucide-react";

const convexUrl = normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_CONVEX_URL);
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

const ANY_READY_WORKSPACE_KEY = "founderos:workspace-ready:any";

installClerkAuthRefreshGuard();

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  installClerkAuthRefreshGuard();

  if (!convex) return <ConfigUnavailable />;

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <AuthGate>{children}</AuthGate>
    </ConvexProviderWithClerk>
  );
}

function normalizeAbsoluteUrl(value?: string) {
  const cleaned = value?.trim().replace(/^["']|["']$/g, "").replace(/\/+$/g, "");
  if (!cleaned) return null;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  const isLocal =
    cleaned.startsWith("localhost") ||
    cleaned.startsWith("127.0.0.1") ||
    cleaned.startsWith("[::1]");
  return `${isLocal ? "http" : "https"}://${cleaned}`;
}

function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const seedWorkspace = useMutation(api.init.seedSwarm);
  const completeOAuthConnection = useAction(api.connectors.completeOAuthConnection);
  const completeGitHubAppConnection = useAction(api.connectors.completeGitHubAppConnection);
  const [seededUserId, setSeededUserId] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<{ userId: string; message: string } | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [hasPassedGate, setHasPassedGate] = useState(false);
  const [hasLoadedAccount, setHasLoadedAccount] = useState(false);
  const [stableCurrentUser, setStableCurrentUser] = useState<Doc<"users"> | null | undefined>(undefined);
  const [stableWorkspaces, setStableWorkspaces] = useState<Doc<"workspaces">[] | undefined>(undefined);
  const [rememberedReadyUserId, setRememberedReadyUserId] = useState<string | null>(null);
  const [hasReadyAccountHint, setHasReadyAccountHint] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [hasSeenSignedInUser, setHasSeenSignedInUser] = useState(false);
  const [confirmedSignedOut, setConfirmedSignedOut] = useState(false);
  const [accountDeletionPending, setAccountDeletionPending] = useState(false);
  const isMountedRef = useRef(false);
  const seedingUserRef = useRef<string | null>(null);
  const lastSignedInUserIdRef = useRef<string | null>(null);
  const connectorCallbackRef = useRef<string | null>(null);
  const shouldLoadWorkspace = Boolean(!accountDeletionPending && isAuthenticated && userId && seededUserId === userId);
  const currentUser = useQuery(api.users.current, shouldLoadWorkspace ? {} : "skip");
  const workspaces = useQuery(api.workspaces.get, shouldLoadWorkspace ? {} : "skip");
  const displayedCurrentUser = currentUser ?? stableCurrentUser;
  const displayedWorkspaces = workspaces ?? stableWorkspaces;
  const workspace = displayedWorkspaces?.[0];
  const error = seedError && seedError.userId === userId ? seedError.message : null;
  const isReady = Boolean(isAuthenticated && userId && seededUserId === userId);
  const workspaceLoaded = Boolean(
    isReady &&
    displayedCurrentUser !== undefined &&
    displayedWorkspaces !== undefined &&
    (!workspace || workspace.onboardingCompletedAt),
  );
  const shouldShowOnboarding = Boolean(
    workspace &&
    !workspace.onboardingCompletedAt &&
    displayedCurrentUser !== undefined,
  );
  const hasRememberedReadyWorkspace = Boolean(userId && rememberedReadyUserId === userId);
  const canUseAuthenticatedShell = Boolean(isLoaded && isSignedIn && isAuthenticated);
  const canKeepAppMounted = !accountDeletionPending && (
    canUseAuthenticatedShell &&
    (hasPassedGate ||
      workspaceLoaded ||
      hasRememberedReadyWorkspace ||
      hasReadyAccountHint)
  );
  const canKeepResolvedAccountMounted = !accountDeletionPending && (canKeepAppMounted || shouldShowOnboarding);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setHasReadyAccountHint(readReadyAccountHint());
      setAccountDeletionPending(readAccountDeletionPending());
      setHasHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function syncAccountDeletionPending() {
      setAccountDeletionPending(readAccountDeletionPending());
    }

    syncAccountDeletionPending();
    window.addEventListener(ACCOUNT_DELETION_PENDING_EVENT, syncAccountDeletionPending);
    window.addEventListener("storage", syncAccountDeletionPending);
    return () => {
      window.removeEventListener(ACCOUNT_DELETION_PENDING_EVENT, syncAccountDeletionPending);
      window.removeEventListener("storage", syncAccountDeletionPending);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hasAnyReadyWorkspace = readReadyAccountHint();
    if (!userId || typeof window === "undefined") {
      queueMicrotask(() => {
        if (cancelled) return;
        setHasReadyAccountHint(hasAnyReadyWorkspace);
        setRememberedReadyUserId(null);
      });
      return () => {
        cancelled = true;
      };
    }
    const hasRememberedWorkspace = readUserReadyWorkspace(userId);
    queueMicrotask(() => {
      if (!cancelled) {
        setHasReadyAccountHint(hasAnyReadyWorkspace);
        setRememberedReadyUserId(hasRememberedWorkspace ? userId : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setConfirmedSignedOut(false);
      });
      return () => {
        cancelled = true;
      };
    }
    const timeout = window.setTimeout(() => setConfirmedSignedOut(true), canKeepResolvedAccountMounted ? 1500 : 0);
    return () => window.clearTimeout(timeout);
  }, [canKeepResolvedAccountMounted, isLoaded, isSignedIn]);

  useEffect(() => {
    if (confirmedSignedOut) {
      let cancelled = false;
      const deletedAccountUserId = accountDeletionPending ? lastSignedInUserIdRef.current : null;
      seedingUserRef.current = null;
      lastSignedInUserIdRef.current = null;
      queueMicrotask(() => {
        if (cancelled) return;
        setHasPassedGate(false);
        setHasLoadedAccount(false);
        setStableCurrentUser(undefined);
        setStableWorkspaces(undefined);
        setSeededUserId(null);
        setSeedError(null);
        setHasReadyAccountHint(false);
        setHasSeenSignedInUser(false);
        setAccountDeletionPending(false);
        clearReadyAccountHint();
        if (accountDeletionPending) {
          clearDeletedAccountReadyHints(deletedAccountUserId);
        }
        clearAccountDeletionPending();
      });
      return () => {
        cancelled = true;
      };
    }
  }, [accountDeletionPending, confirmedSignedOut]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    let cancelled = false;
    const previousUserId = lastSignedInUserIdRef.current;
    if (previousUserId && previousUserId !== userId) {
      seedingUserRef.current = null;
      queueMicrotask(() => {
        if (cancelled) return;
        setHasPassedGate(false);
        setHasLoadedAccount(false);
        setStableCurrentUser(undefined);
        setStableWorkspaces(undefined);
        setSeededUserId(null);
        setSeedError(null);
      });
    }
    lastSignedInUserIdRef.current = userId;
    queueMicrotask(() => {
      if (!cancelled) setHasSeenSignedInUser(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    const isWaitingForAuth = !canKeepResolvedAccountMounted && !hasLoadedAccount && (!isLoaded || (isSignedIn && isConvexAuthLoading));
    if (!isWaitingForAuth) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setAuthTimedOut(false);
      });
      return () => {
        cancelled = true;
      };
    }
    const timeout = window.setTimeout(() => setAuthTimedOut(true), 6000);
    return () => window.clearTimeout(timeout);
  }, [canKeepResolvedAccountMounted, hasLoadedAccount, isConvexAuthLoading, isLoaded, isSignedIn]);

  useEffect(() => {
    if (accountDeletionPending || !isLoaded || !isSignedIn || !isAuthenticated || !userId) {
      return;
    }
    if (
      seededUserId === userId ||
      seedingUserRef.current === userId ||
      seedError?.userId === userId
    ) {
      return;
    }

    seedingUserRef.current = userId;
    seedWorkspace()
      .then(() => {
        if (isMountedRef.current && seedingUserRef.current === userId) {
          setSeededUserId(userId);
          setSeedError(null);
        }
      })
      .catch(() => {
        if (isMountedRef.current && seedingUserRef.current === userId) {
          setSeedError({
            userId,
            message: "FounderOS could not prepare your workspace yet.",
          });
        }
      });
  }, [accountDeletionPending, isAuthenticated, isLoaded, isSignedIn, seedError?.userId, seededUserId, seedWorkspace, userId]);

  useEffect(() => {
    if (!workspaceLoaded) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setHasPassedGate(true);
      if (userId && typeof window !== "undefined") {
        rememberReadyWorkspace(userId);
        setHasReadyAccountHint(true);
        setRememberedReadyUserId(userId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, workspaceLoaded]);

  useEffect(() => {
    if (!isReady || currentUser === undefined || workspaces === undefined) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setStableCurrentUser(currentUser);
      setStableWorkspaces(workspaces);
      setHasLoadedAccount(true);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser, isReady, workspaces]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isAuthenticated || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const provider = params.get("connector_provider");
    const state = params.get("state");
    const code = params.get("code");
    const installationId = params.get("installation_id");
    const callbackKey = `${provider ?? ""}:${state ?? ""}:${code ?? ""}:${installationId ?? ""}`;

    if (!provider || !state || connectorCallbackRef.current === callbackKey) return;
    if (provider === "google_workspace" && !code) return;
    if (provider === "github" && !installationId) return;
    if (provider !== "google_workspace" && provider !== "github") return;

    connectorCallbackRef.current = callbackKey;
    const finish = provider === "github"
      ? completeGitHubAppConnection({ state, installationId: installationId! })
      : completeOAuthConnection({ state, code: code!, redirectOrigin: window.location.origin });

    void finish.finally(() => {
      router.replace("/");
    });
  }, [completeGitHubAppConnection, completeOAuthConnection, isAuthenticated, isLoaded, isSignedIn, router]);

  if (!hasHydrated) {
    return <PreparingWorkspace label="Checking your account" />;
  }

  if (accountDeletionPending) {
    if (isLoaded && !isSignedIn) {
      return (
        <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
          <LoginCard fallbackRedirectUrl={connectorCallbackFallbackPath()} />
        </main>
      );
    }
    return <PreparingWorkspace label="Deleting your account" />;
  }

  if (!canKeepResolvedAccountMounted && (!isLoaded || (isSignedIn && isConvexAuthLoading)) && authTimedOut) {
    return <AuthUnavailable />;
  }

  if (!isLoaded) {
    if (shouldShowOnboarding) {
      return (
        <main className="h-screen w-full overflow-y-auto bg-surface px-4 py-8">
          <OnboardingFlow user={displayedCurrentUser ?? null} workspace={workspace!} />
        </main>
      );
    }
    if (canKeepAppMounted) return children;
    return <PreparingWorkspace label="Checking your account" />;
  }

  if (!isSignedIn) {
    if (hasSeenSignedInUser && canKeepResolvedAccountMounted && !confirmedSignedOut) {
      if (shouldShowOnboarding) {
        return (
          <main className="h-screen w-full overflow-y-auto bg-surface px-4 py-8">
            <OnboardingFlow user={displayedCurrentUser ?? null} workspace={workspace!} />
          </main>
        );
      }
      return children;
    }
    return (
      <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
        <LoginCard fallbackRedirectUrl={connectorCallbackFallbackPath()} />
      </main>
    );
  }

  // Keep the app shell mounted after the first complete workspace load.
  // Clerk and Convex can briefly refresh tokens or query snapshots in the
  // background; those transitions should not replace the whole app tree.
  if (shouldShowOnboarding) {
    return (
      <main className="h-screen w-full overflow-y-auto bg-surface px-4 py-8">
        <OnboardingFlow user={displayedCurrentUser ?? null} workspace={workspace!} />
      </main>
    );
  }

  if (canKeepAppMounted) {
    return children;
  }

  if (error) {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
        <div className="max-w-sm rounded-lg border border-red-500/10 bg-white p-5 text-sm text-text-secondary shadow-sm">
          <p className="font-semibold text-text-primary">Workspace unavailable</p>
          <p className="mt-2 leading-6">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!isReady || displayedCurrentUser === undefined || displayedWorkspaces === undefined) {
    return <PreparingWorkspace label={isConvexAuthLoading ? "Checking your account" : "Preparing your workspace"} />;
  }

  return children;
}

function connectorCallbackFallbackPath() {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  const provider = params.get("connector_provider");
  const state = params.get("state");
  const code = params.get("code");
  const installationId = params.get("installation_id");
  const isConnectorCallback = Boolean(
    provider &&
    state &&
    ((provider === "google_workspace" && code) || (provider === "github" && installationId)),
  );
  return isConnectorCallback ? `${window.location.pathname}${window.location.search}` : "/";
}

function readReadyAccountHint() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ANY_READY_WORKSPACE_KEY) === "1";
  } catch {
    return false;
  }
}

function readUserReadyWorkspace(userId: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`founderos:workspace-ready:${userId}`) === "1";
  } catch {
    return false;
  }
}

function rememberReadyWorkspace(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANY_READY_WORKSPACE_KEY, "1");
    window.localStorage.setItem(`founderos:workspace-ready:${userId}`, "1");
  } catch {
    // The in-memory gate state still keeps the mounted app stable.
  }
}

function clearReadyAccountHint() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ANY_READY_WORKSPACE_KEY);
  } catch {
    // Local storage can be unavailable in private or locked-down browsers.
  }
}

function PreparingWorkspace({ label }: { label: string }) {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
      <div className="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-white px-4 py-3 shadow-sm">
        <Loader2 size={16} className="animate-spin text-text-muted" />
        <span className="text-sm font-medium text-text-secondary">{label}</span>
      </div>
    </main>
  );
}

function AuthUnavailable() {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
      <div className="max-w-sm rounded-lg border border-amber-500/15 bg-white p-5 text-sm text-text-secondary shadow-sm">
        <p className="font-semibold text-text-primary">Account setup needs configuration</p>
        <p className="mt-2 leading-6">
          Authentication is not responding. Check that Clerk environment variables are set for this workspace.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}

function ConfigUnavailable() {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
      <div className="max-w-sm rounded-lg border border-amber-500/15 bg-white p-5 text-sm text-text-secondary shadow-sm">
        <p className="font-semibold text-text-primary">Workspace setup needs configuration</p>
        <p className="mt-2 leading-6">
          FounderOS needs its workspace URL configured before the app can open.
        </p>
      </div>
    </main>
  );
}
