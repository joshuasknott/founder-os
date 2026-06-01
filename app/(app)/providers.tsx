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
import { Loader2 } from "lucide-react";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <AuthGate>{children}</AuthGate>
    </ConvexProviderWithClerk>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, sessionId, userId } = useAuth();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const seedWorkspace = useMutation(api.init.seedSwarm);
  const completeOAuthConnection = useAction(api.connectors.completeOAuthConnection);
  const completeGitHubAppConnection = useAction(api.connectors.completeGitHubAppConnection);
  const [seededSessionId, setSeededSessionId] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<{ sessionId: string; message: string } | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [hasPassedGate, setHasPassedGate] = useState(false);
  const [hasLoadedAccount, setHasLoadedAccount] = useState(false);
  const [stableCurrentUser, setStableCurrentUser] = useState<Doc<"users"> | null | undefined>(undefined);
  const [stableWorkspaces, setStableWorkspaces] = useState<Doc<"workspaces">[] | undefined>(undefined);
  const [rememberedReadyUserId, setRememberedReadyUserId] = useState<string | null>(null);
  const [confirmedSignedOut, setConfirmedSignedOut] = useState(false);
  const seedingSessionRef = useRef<string | null>(null);
  const connectorCallbackRef = useRef<string | null>(null);
  const shouldLoadWorkspace = Boolean(isAuthenticated && sessionId && seededSessionId === sessionId);
  const currentUser = useQuery(api.users.current, shouldLoadWorkspace ? {} : "skip");
  const workspaces = useQuery(api.workspaces.get, shouldLoadWorkspace ? {} : "skip");
  const displayedCurrentUser = currentUser ?? stableCurrentUser;
  const displayedWorkspaces = workspaces ?? stableWorkspaces;
  const workspace = displayedWorkspaces?.[0];
  const error = seedError && seedError.sessionId === sessionId ? seedError.message : null;
  const isReady = Boolean(isAuthenticated && sessionId && seededSessionId === sessionId);
  const workspaceLoaded = Boolean(
    isReady &&
    displayedCurrentUser !== undefined &&
    displayedWorkspaces !== undefined &&
    (!workspace || workspace.onboardingCompletedAt),
  );
  const hasRememberedReadyWorkspace = Boolean(userId && rememberedReadyUserId === userId);
  const canKeepAppMounted = hasPassedGate || workspaceLoaded || hasRememberedReadyWorkspace;

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      queueMicrotask(() => setRememberedReadyUserId(null));
      return;
    }
    const storageKey = `founderos:workspace-ready:${userId}`;
    queueMicrotask(() => {
      setRememberedReadyUserId(window.localStorage.getItem(storageKey) === "1" ? userId : null);
    });
  }, [userId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      queueMicrotask(() => setConfirmedSignedOut(false));
      return;
    }
    const timeout = window.setTimeout(() => setConfirmedSignedOut(true), canKeepAppMounted ? 1500 : 0);
    return () => window.clearTimeout(timeout);
  }, [canKeepAppMounted, isLoaded, isSignedIn]);

  useEffect(() => {
    if (confirmedSignedOut) {
      seedingSessionRef.current = null;
      queueMicrotask(() => {
        setHasPassedGate(false);
        setHasLoadedAccount(false);
        setStableCurrentUser(undefined);
        setStableWorkspaces(undefined);
        setSeededSessionId(null);
        setSeedError(null);
      });
    }
  }, [confirmedSignedOut]);

  useEffect(() => {
    const isWaitingForAuth = !canKeepAppMounted && !hasLoadedAccount && (!isLoaded || (isSignedIn && isConvexAuthLoading));
    if (!isWaitingForAuth) {
      queueMicrotask(() => setAuthTimedOut(false));
      return;
    }
    const timeout = window.setTimeout(() => setAuthTimedOut(true), 6000);
    return () => window.clearTimeout(timeout);
  }, [canKeepAppMounted, hasLoadedAccount, isConvexAuthLoading, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isAuthenticated || !sessionId) {
      seedingSessionRef.current = null;
      return;
    }
    if (
      seededSessionId === sessionId ||
      seedingSessionRef.current === sessionId ||
      seedError?.sessionId === sessionId
    ) {
      return;
    }

    let cancelled = false;
    seedingSessionRef.current = sessionId;
    seedWorkspace()
      .then(() => {
        if (!cancelled) setSeededSessionId(sessionId);
      })
      .catch(() => {
        if (!cancelled) {
          setSeedError({
            sessionId,
            message: "FounderOS could not prepare your workspace yet.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoaded, isSignedIn, seedError?.sessionId, seededSessionId, seedWorkspace, sessionId]);

  useEffect(() => {
    if (!workspaceLoaded) return;
    queueMicrotask(() => {
      setHasPassedGate(true);
      if (userId && typeof window !== "undefined") {
        window.localStorage.setItem(`founderos:workspace-ready:${userId}`, "1");
        setRememberedReadyUserId(userId);
      }
    });
  }, [userId, workspaceLoaded]);

  useEffect(() => {
    if (!isReady || currentUser === undefined || workspaces === undefined) return;
    queueMicrotask(() => {
      setStableCurrentUser(currentUser);
      setStableWorkspaces(workspaces);
      setHasLoadedAccount(true);
    });
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

  if (!canKeepAppMounted && (!isLoaded || (isSignedIn && isConvexAuthLoading)) && authTimedOut) {
    return <AuthUnavailable />;
  }

  if (!isLoaded) {
    if (canKeepAppMounted) return children;
    return <PreparingWorkspace label="Checking your account" />;
  }

  if (!isSignedIn) {
    if (canKeepAppMounted && !confirmedSignedOut) return children;
    return (
      <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
        <LoginCard fallbackRedirectUrl={connectorCallbackFallbackPath()} />
      </main>
    );
  }

  // Keep the app shell mounted after the first complete workspace load.
  // Clerk and Convex can briefly refresh tokens or query snapshots in the
  // background; those transitions should not replace the whole app tree.
  if (workspace && !workspace.onboardingCompletedAt && displayedCurrentUser !== undefined) {
    return (
      <main className="h-screen w-full overflow-y-auto bg-surface px-4 py-8">
        <OnboardingFlow user={displayedCurrentUser} workspace={workspace} />
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

  if (workspace && !workspace.onboardingCompletedAt) {
    return (
      <main className="h-screen w-full overflow-y-auto bg-surface px-4 py-8">
        <OnboardingFlow user={displayedCurrentUser} workspace={workspace} />
      </main>
    );
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
