"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const seedWorkspace = useMutation(api.init.seedSwarm);
  const [seededSessionId, setSeededSessionId] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<{ sessionId: string; message: string } | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [hasPassedGate, setHasPassedGate] = useState(false);
  const seedingSessionRef = useRef<string | null>(null);
  const shouldLoadWorkspace = Boolean(isAuthenticated && sessionId && seededSessionId === sessionId);
  const currentUser = useQuery(api.users.current, shouldLoadWorkspace ? {} : "skip");
  const workspaces = useQuery(api.workspaces.get, shouldLoadWorkspace ? {} : "skip");
  const workspace = workspaces?.[0];
  const error = seedError && seedError.sessionId === sessionId ? seedError.message : null;
  const isReady = Boolean(isAuthenticated && sessionId && seededSessionId === sessionId);
  const workspaceLoaded = Boolean(
    isReady &&
    currentUser !== undefined &&
    workspaces !== undefined &&
    (!workspace || workspace.onboardingCompletedAt),
  );

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      seedingSessionRef.current = null;
      queueMicrotask(() => {
        setHasPassedGate(false);
        setSeededSessionId(null);
        setSeedError(null);
      });
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    const isWaitingForAuth = !isLoaded || (isSignedIn && isConvexAuthLoading);
    if (!isWaitingForAuth) {
      queueMicrotask(() => setAuthTimedOut(false));
      return;
    }
    const timeout = window.setTimeout(() => setAuthTimedOut(true), 6000);
    return () => window.clearTimeout(timeout);
  }, [isConvexAuthLoading, isLoaded, isSignedIn]);

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
    if (workspaceLoaded) queueMicrotask(() => setHasPassedGate(true));
  }, [workspaceLoaded]);

  if ((!isLoaded || (isSignedIn && isConvexAuthLoading)) && authTimedOut) {
    return <AuthUnavailable />;
  }

  if (!isLoaded) {
    return <PreparingWorkspace label="Checking your account" />;
  }

  if (!isSignedIn) {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
        <LoginCard />
      </main>
    );
  }

  // Keep the app shell mounted after the first complete workspace load.
  // Clerk and Convex can briefly refresh tokens or query snapshots in the
  // background; those transitions should not replace the whole app tree.
  if (hasPassedGate || workspaceLoaded) {
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

  if (!isReady || currentUser === undefined || workspaces === undefined) {
    return <PreparingWorkspace label={isConvexAuthLoading ? "Checking your account" : "Preparing your workspace"} />;
  }

  if (workspace && !workspace.onboardingCompletedAt) {
    return (
      <main className="h-screen w-full overflow-y-auto bg-surface px-4 py-8">
        <OnboardingFlow user={currentUser} workspace={workspace} />
      </main>
    );
  }

  return children;
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
