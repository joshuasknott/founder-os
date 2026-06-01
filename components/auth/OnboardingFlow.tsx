"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Building, Check, ExternalLink, Loader2, ShieldCheck, User } from "lucide-react";
import { ConnectorBrandIcon } from "@/components/settings/connector-brand-icon";
import { copyForConnector, onboardingConnectorIds } from "@/components/settings/connector-copy";

type OnboardingFlowProps = {
  user: Doc<"users"> | null;
  workspace: Doc<"workspaces">;
};

export function OnboardingFlow({ user, workspace }: OnboardingFlowProps) {
  const updateProfile = useMutation(api.users.updateProfile);
  const completeOnboarding = useMutation(api.workspaces.completeOnboarding);
  const startOAuthConnection = useAction(api.connectors.startOAuthConnection);
  const startGitHubAppConnection = useAction(api.connectors.startGitHubAppConnection);
  const setupManagedConnection = useMutation(api.connectors.setupManagedConnection);
  const [name, setName] = useState(user?.name ?? "");
  const [businessName, setBusinessName] = useState(workspace.name);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [connectorIds, setConnectorIds] = useState<string[]>([]);
  const [reviewExternalActions, setReviewExternalActions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [focusedConnectorId, setFocusedConnectorId] = useState(onboardingConnectorIds[0]);
  const selectedConnectorCount = connectorIds.length;
  const focusedConnector = copyForConnector(focusedConnectorId);

  const googleConnectorIds = connectorIds.filter(isGoogleWorkspaceConnector);
  const willConnectGoogle = googleConnectorIds.length > 0;
  const willConnectGitHub = connectorIds.includes("github");
  const willConnectOpenCode = connectorIds.includes("opencode");

  useEffect(() => {
    setName(user?.name ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
    setBusinessName(workspace.name);
  }, [user, workspace.name]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setError("Choose an image smaller than 512KB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") setAvatarUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleConnector = (connectorId: string) => {
    setConnectorIds((current) =>
      current.includes(connectorId)
        ? current.filter((id) => id !== connectorId)
        : [...current, connectorId],
    );
  };

  const runOpenCodeSetup = async () => {
    const response = await fetch("/api/local/opencode/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "opencode" }),
    });
    const result = await response.json() as { ok?: boolean; safeMessage?: string };
    if (!result.ok) {
      throw new Error(result.safeMessage ?? "OpenCode is not ready on this computer yet.");
    }
    await setupManagedConnection({
      workspaceId: workspace._id,
      connectorId: "opencode",
      settings: { command: "opencode" },
    });
  };

  const startSelectedConnections = async () => {
    if (willConnectOpenCode) {
      await runOpenCodeSetup();
    }

    if (willConnectGoogle) {
      const result = await startOAuthConnection({
        workspaceId: workspace._id,
        connectorId: googleConnectorIds[0],
      });
      const url = result && typeof result === "object"
        ? (result as { authorizationUrl?: unknown; safeMessage?: unknown }).authorizationUrl
        : undefined;
      if (typeof url === "string" && url) {
        window.location.assign(url);
        return true;
      }
      const message = result && typeof result === "object"
        ? (result as { safeMessage?: unknown }).safeMessage
        : undefined;
      throw new Error(typeof message === "string" ? message : "Google sign-in setup could not start.");
    }

    if (willConnectGitHub) {
      const result = await startGitHubAppConnection({ workspaceId: workspace._id });
      const url = result && typeof result === "object"
        ? (result as { installationUrl?: unknown; safeMessage?: unknown }).installationUrl
        : undefined;
      if (typeof url === "string" && url) {
        window.location.assign(url);
        return true;
      }
      const message = result && typeof result === "object"
        ? (result as { safeMessage?: unknown }).safeMessage
        : undefined;
      throw new Error(typeof message === "string" ? message : "GitHub setup could not start.");
    }

    return false;
  };

  const finish = async () => {
    const cleanName = name.trim();
    const cleanBusinessName = businessName.trim();
    if (!cleanName || !cleanBusinessName) {
      setError("Add your name and business name to continue.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await updateProfile({ name: cleanName, avatarUrl: avatarUrl.trim() || undefined });
      await completeOnboarding({
        workspaceId: workspace._id,
        name: cleanBusinessName,
        connectorIds,
        reviewExternalActions,
      });
      if (connectorIds.length > 0) {
        const redirected = await startSelectedConnections();
        if (redirected) return;
      }
      window.location.assign("/");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "FounderOS could not finish setup.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-5xl items-center">
      <section className="grid w-full overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-sm lg:grid-cols-[360px_1fr]">
        <div className="border-b border-black/[0.06] bg-surface p-6 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">FounderOS setup</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">Set up your workspace.</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Confirm the basics, then choose any services you want to connect now. You can skip this and adjust everything later in Settings.
          </p>
          <div className="mt-6 space-y-3 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <User size={16} className="text-text-muted" />
              <span>Founder profile</span>
            </div>
            <div className="flex items-center gap-2">
              <Building size={16} className="text-text-muted" />
              <span>Business workspace</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-text-muted" />
              <span>Optional connections and review rules</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-5 md:grid-cols-[96px_1fr]">
            <div>
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-black/[0.08] bg-surface">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-semibold text-text-muted">{(name || "F").slice(0, 1)}</span>
                )}
              </div>
              <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-black/[0.08] px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface hover:text-text-primary">
                Photo
                <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              </label>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Your name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Email</span>
                <input
                  value={user?.email ?? ""}
                  readOnly
                  className="mt-1 h-10 w-full rounded-lg border border-black/[0.07] bg-black/[0.025] px-3 text-sm text-text-muted outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Business name</span>
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                />
              </label>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Optional starting connections</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  Choose the tools you want to connect now. FounderOS will start the real setup flow when you continue.
                </p>
              </div>
              <span className="text-xs font-semibold text-text-muted">
                {selectedConnectorCount === 0 ? "None selected" : `${selectedConnectorCount} selected`}
              </span>
            </div>
            <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_260px]">
              <div className="grid gap-3 sm:grid-cols-2">
                {onboardingConnectorIds.map((connectorId) => {
                const connection = copyForConnector(connectorId);
                const active = connectorIds.includes(connectorId);
                const focused = focusedConnectorId === connectorId;
                return (
                  <button
                    key={connectorId}
                    type="button"
                    onClick={() => setFocusedConnectorId(connectorId)}
                    className={`min-h-[132px] rounded-lg border p-3 text-left transition ${
                      focused
                        ? "border-black/20 bg-white shadow-sm"
                        : "border-black/[0.06] bg-white hover:border-black/15 hover:bg-surface"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.06] bg-surface">
                        <ConnectorBrandIcon id={connectorId} className="h-6 w-6 text-zinc-900" />
                      </span>
                      <span
                        role="checkbox"
                        aria-checked={active}
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleConnector(connectorId);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          event.stopPropagation();
                          toggleConnector(connectorId);
                        }}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${
                          active ? "border-black bg-black text-white" : "border-black/[0.12] text-transparent"
                        }`}
                      >
                        <Check size={14} />
                      </span>
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-text-primary">{connection.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-text-secondary">{connection.useCase}</span>
                    <span className="mt-3 inline-flex rounded-full bg-black/[0.035] px-2 py-0.5 text-[11px] font-medium text-text-muted">
                      {connection.setup}
                    </span>
                  </button>
                );
              })}
              </div>
              <aside className="rounded-lg border border-black/[0.06] bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.06] bg-white">
                    <ConnectorBrandIcon id={focusedConnectorId} className="h-6 w-6 text-zinc-900" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{focusedConnector.label}</p>
                    <p className="text-xs text-text-muted">{focusedConnector.group}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-text-secondary">{focusedConnector.detail}</p>
                <button
                  type="button"
                  onClick={() => toggleConnector(focusedConnectorId)}
                  className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg bg-black px-3 text-xs font-semibold text-white"
                >
                  {connectorIds.includes(focusedConnectorId) ? "Remove from setup" : "Add to setup"}
                </button>
              </aside>
            </div>
            {selectedConnectorCount > 0 && (
              <div className="mt-3 rounded-lg border border-emerald-500/15 bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-900">
                {connectionPlanText({
                  google: willConnectGoogle,
                  github: willConnectGitHub,
                  opencode: willConnectOpenCode,
                })}
              </div>
            )}
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-lg border border-black/[0.06] bg-surface px-3 py-3">
            <input
              type="checkbox"
              checked={reviewExternalActions}
              onChange={(event) => setReviewExternalActions(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-text-primary">Ask before external actions</span>
              <span className="text-xs leading-5 text-text-secondary">
                FounderOS will pause before sending, publishing, spending, deleting, or changing live assets.
              </span>
            </span>
          </label>

          {error && <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => void finish()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving && <Loader2 size={15} className="animate-spin" />}
              {selectedConnectorCount > 0 && <ExternalLink size={15} />}
              {selectedConnectorCount > 0 ? "Start selected connections" : "Open FounderOS"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function isGoogleWorkspaceConnector(connectorId: string) {
  return connectorId === "gmail" ||
    connectorId === "google_calendar" ||
    connectorId === "google_drive" ||
    connectorId === "google_docs" ||
    connectorId === "google_sheets";
}

function connectionPlanText(args: { google: boolean; github: boolean; opencode: boolean }) {
  const steps = [
    args.opencode ? "check OpenCode on this computer" : undefined,
    args.google ? "open Google sign-in" : undefined,
    args.github && !args.google ? "open GitHub App install" : undefined,
    args.github && args.google ? "then finish GitHub from Connections after Google returns" : undefined,
  ].filter(Boolean);

  return steps.length > 0
    ? `When you continue, FounderOS will ${steps.join(", ")}.`
    : "When you continue, FounderOS will save your setup.";
}
