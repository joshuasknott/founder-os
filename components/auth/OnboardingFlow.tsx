"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  ArrowRight,
  Building,
  CheckCircle2,
  ExternalLink,
  Github,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react";
import { ConnectorBrandIcon } from "@/components/settings/connector-brand-icon";
import { copyForConnector, onboardingConnectorIds } from "@/components/settings/connector-copy";

type OnboardingFlowProps = {
  user: Doc<"users"> | null;
  workspace: Doc<"workspaces">;
};

type ServiceStatus = "not_connected" | "needs_attention" | "connected" | "disabled";

type ServiceCard = {
  id: string;
  safeDisplayName: string;
  description: string;
  authType: "oauth2" | "api_key" | "webhook" | "github_app" | "managed";
  status: ServiceStatus;
  statusMessage: string;
  healthy: boolean;
  safeSettings?: {
    command?: string;
  };
  connectionId?: Id<"connectorConnections">;
};

function isGoogleWorkspaceConnector(connectorId: string) {
  return connectorId === "gmail" ||
    connectorId === "google_calendar" ||
    connectorId === "google_drive" ||
    connectorId === "google_docs" ||
    connectorId === "google_sheets";
}

function statusLabel(status: ServiceStatus, serviceId?: string) {
  if (status === "connected") return serviceId === "opencode" ? "Configured" : "Connected";
  if (status === "needs_attention") return "Needs setup";
  if (status === "disabled") return "Off";
  return "Not connected";
}

function statusStyles(status: ServiceStatus) {
  if (status === "connected") return "border-emerald-500/15 bg-emerald-50 text-emerald-700";
  if (status === "needs_attention") return "border-amber-500/20 bg-amber-50 text-amber-700";
  if (status === "disabled") return "border-zinc-200 bg-zinc-50 text-zinc-500";
  return "border-black/[0.06] bg-black/[0.02] text-text-muted";
}

function isOAuthService(id: string) {
  return isGoogleWorkspaceConnector(id);
}

function isApiKeyService(id: string) {
  return id === "vercel";
}

function primaryActionLabel(service?: ServiceCard) {
  if (!service) return "Connect";
  if (service.status === "connected") return "Connected";
  if (service.id === "github" && service.connectionId) return "Save repository";
  if (service.id === "github") return "Install GitHub App";
  if (service.id === "opencode") return "Check this computer";
  if (service.id === "vercel") return "Save preview setup";
  return service.status === "needs_attention" ? "Reconnect" : "Connect";
}

async function checkOpenCodeLocal(command?: string) {
  const response = await fetch("/api/local/opencode/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: command ?? "opencode" }),
  });
  return await response.json() as { ok?: boolean; safeMessage?: string };
}

export function OnboardingFlow({ user, workspace }: OnboardingFlowProps) {
  const router = useRouter();
  const updateProfile = useMutation(api.users.updateProfile);
  const updateWorkspaceDetails = useMutation(api.workspaces.updateDetails);
  const completeOnboarding = useMutation(api.workspaces.completeOnboarding);
  const startOAuthConnection = useAction(api.connectors.startOAuthConnection);
  const startGitHubAppConnection = useAction(api.connectors.startGitHubAppConnection);
  const setupApiKeyConnection = useMutation(api.connectors.setupApiKeyConnection);
  const setupManagedConnection = useMutation(api.connectors.setupManagedConnection);
  const selectGitHubRepository = useMutation(api.connectors.selectGitHubRepository);
  const services = useQuery(api.connectors.listForWorkspace, { workspaceId: workspace._id }) as ServiceCard[] | undefined;
  const [name, setName] = useState(user?.name ?? "");
  const [businessName, setBusinessName] = useState(workspace.name);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [reviewExternalActions, setReviewExternalActions] = useState(true);
  const [focusedConnectorId, setFocusedConnectorId] = useState(onboardingConnectorIds[0]);
  const [busyServiceId, setBusyServiceId] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState("");

  const onboardingServices = useMemo(() => {
    if (!services) return undefined;
    return onboardingConnectorIds
      .map((id) => services.find((service) => service.id === id))
      .filter((service): service is ServiceCard => Boolean(service));
  }, [services]);
  const focusedService = onboardingServices?.find((service) => service.id === focusedConnectorId) ?? onboardingServices?.[0];
  const focusedCopy = copyForConnector(focusedService?.id ?? focusedConnectorId);
  const connectedIds = useMemo(
    () => onboardingServices?.filter((service) => service.status === "connected").map((service) => service.id) ?? [],
    [onboardingServices],
  );
  const connectedCount = connectedIds.length;

  useEffect(() => {
    setName(user?.name ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");
    setBusinessName(workspace.name);
  }, [user, workspace.name]);

  useEffect(() => {
    if (!onboardingServices || onboardingServices.length === 0) return;
    const githubNeedsRepository = onboardingServices.find(
      (service) => service.id === "github" && service.connectionId && service.status === "needs_attention",
    );
    const firstOpen = onboardingServices.find((service) => service.status !== "connected");
    setFocusedConnectorId((current) =>
      onboardingServices.some((service) => service.id === current)
        ? current
        : (githubNeedsRepository ?? firstOpen ?? onboardingServices[0]).id,
    );
  }, [onboardingServices]);

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

  const saveBasics = async () => {
    const cleanName = name.trim();
    const cleanBusinessName = businessName.trim();
    if (!cleanName || !cleanBusinessName) {
      throw new Error("Add your name and business name to continue.");
    }
    await updateProfile({ name: cleanName, avatarUrl: avatarUrl.trim() || undefined });
    await updateWorkspaceDetails({ workspaceId: workspace._id, name: cleanBusinessName });
  };

  const connectService = async (service: ServiceCard) => {
    if (service.status === "connected") return;
    let redirected = false;
    setBusyServiceId(service.id);
    setError("");
    try {
      await saveBasics();

      if (service.id === "opencode") {
        const check = await checkOpenCodeLocal(service.safeSettings?.command);
        if (!check.ok) throw new Error(check.safeMessage ?? "opencode is not ready on this computer yet.");
        await setupManagedConnection({
          workspaceId: workspace._id,
          connectorId: "opencode",
          settings: { command: service.safeSettings?.command ?? "opencode" },
        });
        return;
      }

      if (service.id === "github") {
        const result = await startGitHubAppConnection({ workspaceId: workspace._id });
        const url = result && typeof result === "object"
          ? (result as { installationUrl?: unknown; safeMessage?: unknown }).installationUrl
          : undefined;
        if (typeof url === "string" && url) {
          redirected = true;
          window.location.assign(url);
          return;
        }
        const message = result && typeof result === "object"
          ? (result as { safeMessage?: unknown }).safeMessage
          : undefined;
        throw new Error(typeof message === "string" ? message : "GitHub setup could not start.");
      }

      if (isOAuthService(service.id)) {
        const result = await startOAuthConnection({
          workspaceId: workspace._id,
          connectorId: service.id,
          redirectOrigin: window.location.origin,
        });
        const url = result && typeof result === "object"
          ? (result as { authorizationUrl?: unknown; safeMessage?: unknown }).authorizationUrl
          : undefined;
        if (typeof url === "string" && url) {
          redirected = true;
          window.location.assign(url);
          return;
        }
        const message = result && typeof result === "object"
          ? (result as { safeMessage?: unknown }).safeMessage
          : undefined;
        throw new Error(typeof message === "string" ? message : "Google sign-in setup could not start.");
      }
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : "That connection could not start.");
    } finally {
      if (!redirected) setBusyServiceId(null);
    }
  };

  const handleGitHubRepositorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!focusedService?.connectionId) return;
    const formData = new FormData(event.currentTarget);
    setBusyServiceId("github");
    setError("");
    try {
      await saveBasics();
      await selectGitHubRepository({
        connectionId: focusedService.connectionId,
        repositoryOwner: String(formData.get("repositoryOwner") ?? ""),
        repositoryName: String(formData.get("repositoryName") ?? ""),
        organizationName: String(formData.get("organizationName") ?? "") || undefined,
      });
      event.currentTarget.reset();
    } catch (repositoryError) {
      setError(repositoryError instanceof Error ? repositoryError.message : "The repository could not be saved.");
    } finally {
      setBusyServiceId(null);
    }
  };

  const handleApiKeySetupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!focusedService || !isApiKeyService(focusedService.id)) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const settings: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key === "apiKey" || typeof value !== "string") continue;
      if (value.trim()) settings[key] = value.trim();
    }

    setBusyServiceId(focusedService.id);
    setError("");
    try {
      await saveBasics();
      await setupApiKeyConnection({
        workspaceId: workspace._id,
        connectorId: focusedService.id,
        apiKey: String(formData.get("apiKey") ?? ""),
        settings,
      });
      form.reset();
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : "That connection could not be saved.");
    } finally {
      setBusyServiceId(null);
    }
  };

  const finish = async () => {
    setIsFinishing(true);
    setError("");
    try {
      await saveBasics();
      await completeOnboarding({
        workspaceId: workspace._id,
        name: businessName.trim(),
        connectorIds: connectedIds,
        reviewExternalActions,
      });
      router.replace("/");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "FounderOS could not finish setup.");
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-6xl items-center">
      <section className="grid w-full overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-sm lg:grid-cols-[340px_1fr]">
        <div className="border-b border-black/[0.06] bg-surface p-6 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">FounderOS setup</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">Set up your workspace.</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Confirm the basics, then connect any services you want FounderOS to use now. Each connection starts from its own card.
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
              <span>Connected services and approval rules</span>
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
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Connections</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  Open a card to see what it can do, then connect it before moving to the next one.
                </p>
              </div>
              <span className="text-xs font-semibold text-text-muted">
                {connectedCount === 0 ? "No services connected" : `${connectedCount} connected`}
              </span>
            </div>

            <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="grid gap-3 sm:grid-cols-2">
                {onboardingServices === undefined ? (
                  onboardingConnectorIds.map((connectorId) => (
                    <div key={connectorId} className="h-32 animate-pulse rounded-lg border border-black/[0.06] bg-black/[0.025]" />
                  ))
                ) : (
                  onboardingServices.map((service) => {
                    const connection = copyForConnector(service.id);
                    const focused = focusedService?.id === service.id;
                    const connected = service.status === "connected";
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setFocusedConnectorId(service.id)}
                        className={`min-h-[138px] rounded-lg border p-3 text-left transition ${
                          focused
                            ? "border-black/20 bg-white shadow-sm"
                            : "border-black/[0.06] bg-white hover:border-black/15 hover:bg-surface"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.06] bg-surface">
                            <ConnectorBrandIcon id={service.id} className="h-6 w-6 text-zinc-900" />
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyles(service.status)}`}>
                            {connected ? <CheckCircle2 size={12} /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />}
                            {statusLabel(service.status, service.id)}
                          </span>
                        </span>
                        <span className="mt-3 block text-sm font-semibold text-text-primary">{connection.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-text-secondary">{connection.useCase}</span>
                      </button>
                    );
                  })
                )}
              </div>

              <aside className="rounded-lg border border-black/[0.06] bg-surface p-4">
                {focusedService ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.06] bg-white">
                        <ConnectorBrandIcon id={focusedService.id} className="h-6 w-6 text-zinc-900" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{focusedCopy.label}</p>
                        <p className="text-xs text-text-muted">{focusedCopy.group}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-text-secondary">{focusedCopy.detail}</p>
                    {isGoogleWorkspaceConnector(focusedService.id) && (
                      <p className="mt-3 rounded-lg border border-black/[0.05] bg-white px-3 py-2 text-xs leading-5 text-text-secondary">
                        Google sign-in connects Gmail, Calendar, Drive, Docs and Sheets together.
                      </p>
                    )}
                    {focusedService.statusMessage && (
                      <p className="mt-3 rounded-lg border border-black/[0.05] bg-white px-3 py-2 text-xs leading-5 text-text-muted">
                        {focusedService.statusMessage}
                      </p>
                    )}

                    {focusedService.id === "github" && focusedService.connectionId && focusedService.status !== "connected" ? (
                      <form onSubmit={handleGitHubRepositorySubmit} className="mt-4 space-y-3">
                        <label className="block text-xs font-semibold text-text-secondary">
                          Owner
                          <input name="repositoryOwner" required placeholder="founderos" className="mt-1 h-9 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-text-primary outline-none focus:border-black/25" />
                        </label>
                        <label className="block text-xs font-semibold text-text-secondary">
                          Repository
                          <input name="repositoryName" required placeholder="founder-os" className="mt-1 h-9 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-text-primary outline-none focus:border-black/25" />
                        </label>
                        <label className="block text-xs font-semibold text-text-secondary">
                          Organization
                          <input name="organizationName" placeholder="Optional" className="mt-1 h-9 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-text-primary outline-none focus:border-black/25" />
                        </label>
                        <button
                          type="submit"
                          disabled={busyServiceId === focusedService.id}
                          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-black px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyServiceId === focusedService.id ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
                          Save repository
                        </button>
                      </form>
                    ) : focusedService.id === "vercel" && focusedService.status !== "connected" ? (
                      <form onSubmit={handleApiKeySetupSubmit} className="mt-4 space-y-3">
                        <label className="block text-xs font-semibold text-text-secondary">
                          Private key
                          <input
                            name="apiKey"
                            type="password"
                            required
                            autoComplete="off"
                            placeholder="Vercel token"
                            className="mt-1 h-9 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-text-primary outline-none focus:border-black/25"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-text-secondary">
                          Project ID
                          <input name="projectId" required placeholder="Required" className="mt-1 h-9 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-text-primary outline-none focus:border-black/25" />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-xs font-semibold text-text-secondary">
                            Project name
                            <input name="projectName" placeholder="Optional" className="mt-1 h-9 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-text-primary outline-none focus:border-black/25" />
                          </label>
                          <label className="block text-xs font-semibold text-text-secondary">
                            Team ID
                            <input name="teamId" placeholder="Optional" className="mt-1 h-9 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-text-primary outline-none focus:border-black/25" />
                          </label>
                        </div>
                        <label className="block text-xs font-semibold text-text-secondary">
                          Production domain
                          <input name="productionDomain" placeholder="Optional" className="mt-1 h-9 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-text-primary outline-none focus:border-black/25" />
                        </label>
                        <button
                          type="submit"
                          disabled={busyServiceId === focusedService.id}
                          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-black px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyServiceId === focusedService.id ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                          Save preview setup
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        disabled={focusedService.status === "connected" || busyServiceId === focusedService.id}
                        onClick={() => void connectService(focusedService)}
                        className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-black px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyServiceId === focusedService.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : focusedService.id === "github" ? (
                          <Github size={14} />
                        ) : focusedService.id === "opencode" ? (
                          <RefreshCw size={14} />
                        ) : (
                          <Plug size={14} />
                        )}
                        {primaryActionLabel(focusedService)}
                        {focusedService.status !== "connected" && focusedService.id !== "opencode" && <ExternalLink size={13} />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const currentIndex = onboardingConnectorIds.indexOf(focusedService.id);
                        const nextId = onboardingConnectorIds[currentIndex + 1] ?? onboardingConnectorIds[0];
                        setFocusedConnectorId(nextId);
                      }}
                      className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 text-xs font-semibold text-text-secondary hover:bg-black/[0.03] hover:text-text-primary"
                    >
                      Next connection
                      <ArrowRight size={13} />
                    </button>
                  </>
                ) : (
                  <div className="h-52 animate-pulse rounded-lg bg-black/[0.035]" />
                )}
              </aside>
            </div>
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
              disabled={isFinishing || Boolean(busyServiceId)}
              className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFinishing && <Loader2 size={15} className="animate-spin" />}
              Open FounderOS
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
