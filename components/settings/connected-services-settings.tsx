"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ChevronDown,
  ChevronRight,
  Plug,
  Power,
  RefreshCw,
  ShieldCheck,
  Github,
  KeyRound,
  X,
} from "lucide-react";
import { groupedConnectorServices, visibleConnectorServices } from "@/lib/connector-display";
import { ConnectorBrandIcon } from "./connector-brand-icon";
import { copyForConnector } from "./connector-copy";

type ServiceStatus = "not_connected" | "needs_attention" | "connected" | "disabled";

type ServiceCard = {
  id: string;
  safeDisplayName: string;
  description: string;
  authType: "oauth2" | "api_key" | "webhook" | "github_app" | "managed";
  requiredAccess: string[];
  status: ServiceStatus;
  statusMessage: string;
  healthy: boolean;
  safeSettings?: {
    command?: string;
  };
  connectionId?: Id<"connectorConnections">;
  lastTestedAt?: number;
};

type ActivityLog = {
  _id: string;
  connectorId: string;
  actionType: string;
  status: "pending" | "completed" | "needs_attention" | "approval_required" | "failed";
  approvalRequired: boolean;
  safeSummary: string;
  safeError?: string;
  createdAt: number;
  completedAt?: number;
};

function statusCopy(status: ServiceStatus, serviceId?: string) {
  const labels: Record<ServiceStatus, string> = {
    not_connected: "Not connected",
    needs_attention: "Needs sign-in",
    connected: serviceId === "opencode" ? "Configured" : "Connected",
    disabled: "Off",
  };
  return labels[status];
}

function statusDot(status: ServiceStatus) {
  if (status === "connected") return "bg-emerald-500 ring-emerald-500/20";
  if (status === "needs_attention") return "bg-amber-500 ring-amber-500/20 animate-pulse";
  if (status === "disabled") return "bg-zinc-400 ring-zinc-400/20";
  return "bg-zinc-300 ring-zinc-300/10";
}

function statusTextColor(status: ServiceStatus) {
  if (status === "connected") return "text-emerald-700 dark:text-emerald-400";
  if (status === "needs_attention") return "text-amber-700 dark:text-amber-400";
  if (status === "disabled") return "text-zinc-500 dark:text-zinc-400";
  return "text-zinc-500 dark:text-zinc-400";
}

function actionCopy(actionType: string) {
  const labels: Record<string, string> = {
    connect: "Connection setup",
    disconnect: "Turned off",
    test_connection: "Connection check",
    update_settings: "Settings updated",
  };
  return labels[actionType] ?? actionType.replace(/_/g, " ");
}

function safeResultMessage(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return undefined;
  const message = (result as { safeMessage?: unknown; statusMessage?: unknown }).safeMessage
    ?? (result as { statusMessage?: unknown }).statusMessage;
  return typeof message === "string" && message.trim() ? message : undefined;
}

function formatActivityTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

async function checkOpenCodeLocal(command?: string) {
  const response = await fetch("/api/local/opencode/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: command ?? "opencode" }),
  });
  return await response.json() as unknown;
}

function isApiKeyService(id: string) {
  return id === "vercel";
}

function isManagedSetupService(id: string) {
  return id === "opencode";
}

function isOAuthService(id: string) {
  return id === "gmail"
    || id === "google_calendar"
    || id === "google_drive"
    || id === "google_docs"
    || id === "google_sheets";
}

function setupTitle(service?: ServiceCard) {
  if (!service) return "Connect service";
  if (service.id === "github") return "Choose repository";
  if (service.id === "opencode") return "Check opencode";
  return `Connect ${service.safeDisplayName}`;
}

function keyPlaceholder(id: string) {
  if (id === "vercel") return "Vercel token";
  return "Private key";
}

function ServiceSkeleton() {
  return (
    <div className="rounded-lg border border-black/[0.06] bg-white p-5">
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-14 animate-pulse rounded-lg bg-black/[0.035]" />
        ))}
      </div>
    </div>
  );
}

export function ConnectedServicesSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaces = useQuery(api.workspaces.get);
  const workspace = workspaces?.[0];
  const workspaceId = workspace?._id as Id<"workspaces"> | undefined;
  const fromOnboarding = searchParams.get("onboarding_connections") === "1";
  const onboardingConnectorIds = React.useMemo(
    () => new Set(workspace?.onboardingConnectorIds ?? []),
    [workspace?.onboardingConnectorIds],
  );
  const services = useQuery(
    api.connectors.listForWorkspace,
    workspaceId ? { workspaceId } : "skip",
  ) as ServiceCard[] | undefined;
  const activityLogs = useQuery(
    api.connectors.getActionLogs,
    workspaceId ? { workspaceId } : "skip",
  ) as ActivityLog[] | undefined;
  const startOAuthConnection = useAction(api.connectors.startOAuthConnection);
  const completeOAuthConnection = useAction(api.connectors.completeOAuthConnection);
  const refreshOAuthConnection = useAction(api.connectors.refreshOAuthConnection);
  const startGitHubAppConnection = useAction(api.connectors.startGitHubAppConnection);
  const completeGitHubAppConnection = useAction(api.connectors.completeGitHubAppConnection);
  const startConnection = useMutation(api.connectors.startConnection);
  const setupApiKeyConnection = useMutation(api.connectors.setupApiKeyConnection);
  const setupManagedConnection = useMutation(api.connectors.setupManagedConnection);
  const selectGitHubRepository = useMutation(api.connectors.selectGitHubRepository);
  const testConnection = useMutation(api.connectors.testConnection);
  const disconnect = useMutation(api.connectors.disconnect);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [serviceMessages, setServiceMessages] = React.useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [setupServiceId, setSetupServiceId] = React.useState<string | null>(null);
  const callbackHandledRef = React.useRef<string | null>(null);

  const visibleServices = React.useMemo(() => {
    if (!services) return undefined;
    return visibleConnectorServices(services);
  }, [services]);

  const groupedServices = React.useMemo(
    () => (visibleServices ? groupedConnectorServices(visibleServices) : undefined),
    [visibleServices],
  );
  const setupService = React.useMemo(
    () => services?.find((service) => service.id === setupServiceId),
    [services, setupServiceId],
  );
  const setupServiceDetails = setupService ? copyForConnector(setupService.id) : undefined;

  const runServiceAction = async (
    key: string,
    action: () => Promise<unknown>,
    messageServiceId = key.split(":")[0],
  ) => {
    setBusyKey(key);
    try {
      const result = await action();
      const message = safeResultMessage(result);
      if (message) {
        setServiceMessages((messages) => ({
          ...messages,
          [messageServiceId]: message,
        }));
      }
      return result;
    } catch {
      setServiceMessages((messages) => ({
        ...messages,
        [messageServiceId]: "That connection step could not finish. Try again from Settings.",
      }));
    } finally {
      setBusyKey(null);
    }
  };

  React.useEffect(() => {
    const provider = searchParams.get("connector_provider");
    const state = searchParams.get("state");
    const code = searchParams.get("code");
    const installationId = searchParams.get("installation_id");
    const callbackKey = `${provider ?? ""}:${state ?? ""}:${code ?? ""}:${installationId ?? ""}`;

    if (!provider || !state || callbackHandledRef.current === callbackKey) return;
    if (provider === "google_workspace" && !code) return;
    if (provider === "github" && !installationId) return;

    callbackHandledRef.current = callbackKey;
    const serviceId = provider === "google_workspace" ? "gmail" : "github";
    void runServiceAction(`${serviceId}:callback`, async () => {
      const result = provider === "github"
        ? await completeGitHubAppConnection({ state, installationId: installationId! })
        : await completeOAuthConnection({ state, code: code!, redirectOrigin: window.location.origin });
      router.replace("/settings", { scroll: false });
      return result;
    }, serviceId);
  }, [completeGitHubAppConnection, completeOAuthConnection, router, searchParams]);

  const beginConnection = (service: ServiceCard) => {
    if (!workspaceId) return;
    if (isApiKeyService(service.id) || isManagedSetupService(service.id)) {
      setSetupServiceId(service.id);
      return;
    }

    if (service.id === "github") {
      void runServiceAction(service.id, async () => {
        const result = await startGitHubAppConnection({ workspaceId });
        const url = result && typeof result === "object"
          ? (result as { installationUrl?: unknown }).installationUrl
          : undefined;
        if (typeof url === "string" && url) {
          window.location.assign(url);
        }
        return result;
      });
      return;
    }

    if (isOAuthService(service.id)) {
      void runServiceAction(service.id, async () => {
        const result = await startOAuthConnection({
          workspaceId,
          connectorId: service.id,
          redirectOrigin: window.location.origin,
        });
        const url = result && typeof result === "object"
          ? (result as { authorizationUrl?: unknown }).authorizationUrl
          : undefined;
        if (typeof url === "string" && url) {
          window.location.assign(url);
        }
        return result;
      });
      return;
    }

    void runServiceAction(service.id, () =>
      startConnection({ workspaceId, connectorId: service.id }),
    );
  };

  const handlePrivateSetupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspaceId || !setupService || !isApiKeyService(setupService.id)) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const settings: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key === "apiKey" || typeof value !== "string") continue;
      if (value.trim()) settings[key] = value.trim();
    }

    await runServiceAction(setupService.id, () =>
      setupApiKeyConnection({
        workspaceId,
        connectorId: setupService.id,
        apiKey: String(formData.get("apiKey") ?? ""),
        settings,
      }),
    );
    form.reset();
    setSetupServiceId(null);
  };

  const handleGitHubRepositorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!setupService?.connectionId) return;
    const formData = new FormData(event.currentTarget);
    await runServiceAction("github:repository", () =>
      selectGitHubRepository({
        connectionId: setupService.connectionId!,
        repositoryOwner: String(formData.get("repositoryOwner") ?? ""),
        repositoryName: String(formData.get("repositoryName") ?? ""),
        organizationName: String(formData.get("organizationName") ?? "") || undefined,
      }),
      "github",
    );
    setSetupServiceId(null);
  };

  const handleManagedSetupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspaceId || !setupService || !isManagedSetupService(setupService.id)) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const settings: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim()) settings[key] = value.trim();
    }

    const check = await runServiceAction(`${setupService.id}:local-check`, () =>
      checkOpenCodeLocal(settings.command),
    );
    if (!check || typeof check !== "object" || !(check as { ok?: unknown }).ok) return;

    await runServiceAction(setupService.id, () =>
      setupManagedConnection({
        workspaceId,
        connectorId: setupService.id,
        settings,
      }),
    );
    form.reset();
    setSetupServiceId(null);
  };

  return (
    <section className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
            Connections
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
            Services FounderOS can use.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Connect the tools FounderOS should read from or prepare work for. You can add, remove, or reconnect services any time.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-xs font-semibold text-text-secondary">
          <ShieldCheck size={15} className="text-emerald-600" />
          Approval protected
        </div>
      </div>

      {fromOnboarding && (
        <div className="mt-5 rounded-lg border border-emerald-500/15 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          Review the services you connected during setup, or connect another one now.
        </div>
      )}

      <div className="mt-6">
        {visibleServices === undefined ? (
          <ServiceSkeleton />
        ) : !workspaceId ? (
          <div className="rounded-lg border border-black/[0.06] bg-white p-6 text-sm text-text-secondary">
            FounderOS is preparing your workspace.
          </div>
        ) : (
          <div className="space-y-7">
            {groupedServices?.map((group) => (
              <section key={group.id} className="space-y-3">
                <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {group.title}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.services
                    .slice()
                    .sort((left, right) =>
                      Number(onboardingConnectorIds.has(right.id)) - Number(onboardingConnectorIds.has(left.id)),
                    )
                    .map((service) => {
                      const details = copyForConnector(service.id);
                      const statusMessage = serviceMessages[service.id] ?? service.statusMessage;

                      return (
                        <button
                          key={service.id}
                          type="button"
                          disabled={details.comingSoon}
                          onClick={details.comingSoon ? undefined : () => setSetupServiceId(service.id)}
                          className={`group flex min-h-[172px] flex-col justify-between rounded-lg border border-black/[0.06] bg-white p-4 text-left shadow-sm transition ${details.comingSoon ? "cursor-default" : "hover:-translate-y-0.5 hover:border-black/15 hover:shadow-md"}`}
                        >
                          <span>
                            <span className="flex items-start justify-between gap-3">
                              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-black/[0.06] bg-surface">
                                <ConnectorBrandIcon id={service.id} className="h-7 w-7 text-zinc-900" />
                              </span>
                              <span className={`inline-flex items-center gap-1.5 rounded-full border border-black/[0.04] bg-black/[0.01] px-2 py-0.5 text-[11px] font-medium ${statusTextColor(service.status)}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(service.status)} ring-2`} />
                                {statusCopy(service.status, service.id)}
                              </span>
                            </span>
                            <span className="mt-4 block text-sm font-semibold tracking-tight text-text-primary">
                              {details.label}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-text-secondary">
                              {details.useCase}
                            </span>
                          </span>
                          <span className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-black/[0.035] px-2 py-0.5 text-[11px] font-medium text-text-muted">
                              {details.setup}
                            </span>
                            {details.comingSoon && (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                Coming soon
                              </span>
                            )}
                            {onboardingConnectorIds.has(service.id) && (
                              <span className="rounded-full border border-emerald-500/15 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                Connected in setup
                              </span>
                            )}
                          </span>
                          {statusMessage && (
                            <span className="mt-2 block text-[11px] leading-4 text-text-muted">{statusMessage}</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {setupService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-black/[0.08] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-surface">
                  <ConnectorBrandIcon id={setupService.id} className="h-6 w-6 text-zinc-900" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">{setupTitle(setupService)}</h3>
                  <p className="mt-0.5 text-xs text-text-muted">{setupServiceDetails?.setup}</p>
                </div>
              </div>
              <button
                type="button"
                title="Close"
                onClick={() => setSetupServiceId(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-black/[0.04] hover:text-zinc-900"
              >
                <X size={16} />
              </button>
            </div>

            <div className="border-b border-black/[0.05] px-5 py-4">
              <p className="text-sm font-semibold text-text-primary">{setupServiceDetails?.useCase}</p>
              <p className="mt-2 text-xs leading-5 text-text-secondary">{setupServiceDetails?.detail}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border border-black/[0.04] bg-black/[0.01] px-2.5 py-0.5 text-[11px] font-medium ${statusTextColor(setupService.status)}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot(setupService.status)} ring-2`} />
                  {statusCopy(setupService.status, setupService.id)}
                </span>
                {setupService.statusMessage && (
                  <span className="text-[11px] text-text-muted">{serviceMessages[setupService.id] ?? setupService.statusMessage}</span>
                )}
              </div>
              {setupService.connectionId && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() =>
                      void runServiceAction(`${setupService.id}:check`, () =>
                        setupService.id === "opencode"
                          ? checkOpenCodeLocal(setupService.safeSettings?.command)
                          : testConnection({ connectionId: setupService.connectionId! }),
                      )
                    }
                    className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw size={13} />
                    Check
                  </button>
                  {isOAuthService(setupService.id) && setupService.status === "connected" && workspaceId && (
                    <button
                      type="button"
                      disabled={Boolean(busyKey)}
                      onClick={() =>
                        void runServiceAction(`${setupService.id}:refresh`, () =>
                          refreshOAuthConnection({ workspaceId, connectorId: setupService.id }),
                        )
                      }
                      className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw size={13} />
                      Refresh sign-in
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() =>
                      void runServiceAction(`${setupService.id}:off`, () =>
                        disconnect({ connectionId: setupService.connectionId! }),
                      )
                    }
                    className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Power size={13} />
                    Turn off
                  </button>
                </div>
              )}
            </div>

            {setupService.id === "github" ? (
              <div className="space-y-4 px-5 py-5">
                {!setupService.connectionId ? (
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() => beginConnection(setupService)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Github size={14} />
                    Install GitHub App
                  </button>
                ) : (
                  <form onSubmit={handleGitHubRepositorySubmit} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
                        Owner
                        <input name="repositoryOwner" required placeholder="founderos" className="h-10 w-full rounded-lg border border-black/[0.08] bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-black/25 focus:bg-white" />
                      </label>
                      <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
                        Repository
                        <input name="repositoryName" required placeholder="founder-os" className="h-10 w-full rounded-lg border border-black/[0.08] bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-black/25 focus:bg-white" />
                      </label>
                    </div>
                    <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
                      Organization
                      <input name="organizationName" placeholder="Optional" className="h-10 w-full rounded-lg border border-black/[0.08] bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-black/25 focus:bg-white" />
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                      <button type="button" onClick={() => setSetupServiceId(null)} className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50">
                        Cancel
                      </button>
                      <button type="submit" disabled={Boolean(busyKey)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">
                        <Github size={14} />
                        Save repository
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : isOAuthService(setupService.id) ? (
              <div className="flex justify-end gap-2 px-5 py-5">
                <button type="button" onClick={() => setSetupServiceId(null)} className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50">
                  Cancel
                </button>
                <button type="button" disabled={Boolean(busyKey)} onClick={() => beginConnection(setupService)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <Plug size={14} />
                  Continue to sign-in
                </button>
              </div>
            ) : isManagedSetupService(setupService.id) ? (
              <form onSubmit={handleManagedSetupSubmit} className="space-y-4 px-5 py-5">
                <p className="text-xs leading-5 text-text-secondary">
                  FounderOS will check this computer and confirm opencode is ready before saving this setup.
                </p>
                <details className="rounded-lg border border-black/[0.06] bg-surface px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-text-secondary">
                    Advanced setup
                  </summary>
                  <label className="mt-3 block space-y-1.5 text-xs font-semibold text-text-secondary">
                    Local opencode command
                    <input name="command" placeholder="opencode" defaultValue={setupService.safeSettings?.command ?? "opencode"} className="h-10 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm font-medium text-text-primary outline-none focus:border-black/25" />
                  </label>
                </details>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setSetupServiceId(null)} className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={Boolean(busyKey)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <RefreshCw size={14} />
                    Check local setup
                  </button>
                </div>
              </form>
            ) : isApiKeyService(setupService.id) ? (
              <form onSubmit={handlePrivateSetupSubmit} className="space-y-4 px-5 py-5">
                <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
                  Private key
                  <input
                    name="apiKey"
                    type="password"
                    required
                    autoComplete="off"
                    placeholder={keyPlaceholder(setupService.id)}
                    className="h-10 w-full rounded-lg border border-black/[0.08] bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-black/25 focus:bg-white"
                  />
                </label>

                {setupService.id === "vercel" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
                      Project ID
                      <input name="projectId" placeholder="Required" className="h-10 w-full rounded-lg border border-black/[0.08] bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-black/25 focus:bg-white" />
                    </label>
                    <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
                      Project name
                      <input name="projectName" placeholder="Optional" className="h-10 w-full rounded-lg border border-black/[0.08] bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-black/25 focus:bg-white" />
                    </label>
                    <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
                      Team ID
                      <input name="teamId" placeholder="Optional" className="h-10 w-full rounded-lg border border-black/[0.08] bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-black/25 focus:bg-white" />
                    </label>
                    <label className="space-y-1.5 text-xs font-semibold text-text-secondary">
                      Production domain
                      <input name="productionDomain" placeholder="Optional" className="h-10 w-full rounded-lg border border-black/[0.08] bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-black/25 focus:bg-white" />
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSetupServiceId(null)}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(busyKey)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <KeyRound size={14} />
                    Connect
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end gap-2 px-5 py-5">
                <button type="button" onClick={() => setSetupServiceId(null)} className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50">
                  Close
                </button>
                <button type="button" disabled={Boolean(busyKey)} onClick={() => beginConnection(setupService)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <Plug size={14} />
                  Connect
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activityLogs !== undefined && activityLogs.length > 0 && (
        <section className="mt-6 overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                Connection history
              </p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                Recent safe connection activity
              </p>
            </div>
            {historyOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
          </button>
          {historyOpen && (
            <div className="divide-y divide-black/[0.06] border-t border-black/[0.05] px-4">
              {activityLogs.slice(0, 8).map((log) => (
                <div key={log._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize text-text-primary">
                      {actionCopy(log.actionType)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">
                      {log.safeError ?? log.safeSummary}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-text-muted">
                    {formatActivityTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
