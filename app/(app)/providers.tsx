"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LoginCard } from "@/components/auth/LoginCard";
import { OnboardingFlow } from "@/components/auth/OnboardingFlow";
import { authClient } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <AuthGate>{children}</AuthGate>
    </ConvexBetterAuthProvider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { data: liveSession, isPending } = authClient.useSession();
  const [stableSession, setStableSession] = useState<typeof liveSession | null>(null);
  const seedWorkspace = useMutation(api.init.seedSwarm);
  const [seededSessionId, setSeededSessionId] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<{ sessionId: string; message: string } | null>(null);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const seedingSessionRef = useRef<string | null>(null);
  const session = liveSession?.session ? liveSession : stableSession;
  const sessionId = liveSession?.session?.id ?? stableSession?.session?.id;
  const shouldLoadWorkspace = Boolean(sessionId && seededSessionId === sessionId);
  const currentUser = useQuery(api.users.current, shouldLoadWorkspace ? {} : "skip");
  const workspaces = useQuery(api.workspaces.get, shouldLoadWorkspace ? {} : "skip");
  const workspace = workspaces?.[0];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (liveSession?.session) {
        const liveId = liveSession.session.id;
        const stableId = stableSession?.session?.id;
        if (liveId !== stableId) {
          setStableSession(liveSession);
        }
        return;
      }
      if (!isPending) setStableSession(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [isPending, liveSession, liveSession?.session?.id, stableSession?.session?.id]);

  useEffect(() => {
    if (!isPending) {
      const reset = window.setTimeout(() => setAuthTimedOut(false), 0);
      return () => window.clearTimeout(reset);
    }
    const timeout = window.setTimeout(() => setAuthTimedOut(true), 6000);
    return () => window.clearTimeout(timeout);
  }, [isPending]);

  useEffect(() => {
    if (!sessionId) {
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
  }, [seedError?.sessionId, seededSessionId, seedWorkspace, sessionId]);

  if (isPending && !session?.session && authTimedOut) {
    return <AuthUnavailable />;
  }

  if (isPending && !session?.session) {
    return <PreparingWorkspace label="Checking your account" />;
  }

  if (!session?.session) {
    return (
      <main className="flex h-screen w-full items-center justify-center bg-surface px-4">
        <LoginCard />
      </main>
    );
  }

  const error = seedError && seedError.sessionId === sessionId ? seedError.message : null;
  const isReady = Boolean(sessionId && seededSessionId === sessionId);

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
    return <PreparingWorkspace label="Preparing your workspace" />;
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
          Authentication is not responding. Check that Better Auth environment variables are set for this workspace.
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
