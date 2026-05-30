"use client";

import { ReactNode, useEffect, useState } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LoginCard } from "@/components/auth/LoginCard";
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
  const { data: session, isPending } = authClient.useSession();
  const seedWorkspace = useMutation(api.init.seedSwarm);
  const [seededSessionId, setSeededSessionId] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<{ sessionId: string; message: string } | null>(null);
  const sessionId = session?.session.id;

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
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
  }, [seedWorkspace, sessionId]);

  if (isPending) {
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

  if (!isReady) {
    return <PreparingWorkspace label="Preparing your workspace" />;
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
