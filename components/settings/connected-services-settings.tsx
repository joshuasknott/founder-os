"use client";

import * as React from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plug,
  Power,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { groupedConnectorServices, visibleConnectorServices } from "@/lib/connector-display";
import { GoogleIcon, NotionIcon, SlackIcon, StripeIcon, VercelIcon } from "./brand-icons";

type ServiceStatus = "not_connected" | "needs_attention" | "connected" | "disabled";

type ServiceCard = {
  id: string;
  safeDisplayName: string;
  description: string;
  requiredAccess: string[];
  status: ServiceStatus;
  statusMessage: string;
  healthy: boolean;
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

function ServiceBrandIcon({ id }: { id: string }) {
  if (id === "gmail" || id === "google_calendar" || id === "google_drive") return <GoogleIcon />;
  if (id === "slack") return <SlackIcon />;
  if (id === "notion") return <NotionIcon />;
  if (id === "stripe") return <StripeIcon />;
  if (id === "vercel") return <VercelIcon />;
  return <Plug size={19} className="text-text-muted" />;
}

function statusCopy(status: ServiceStatus) {
  const labels: Record<ServiceStatus, string> = {
    not_connected: "Not connected",
    needs_attention: "Needs sign-in",
    connected: "Connected",
    disabled: "Off",
  };
  return labels[status];
}

function statusClasses(status: ServiceStatus) {
  if (status === "connected") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "needs_attention") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "disabled") return "border-zinc-200 bg-zinc-100 text-zinc-500";
  return "border-zinc-200 bg-white text-zinc-500";
}

function actionCopy(actionType: string) {
  const labels: Record<string, string> = {
    connect: "Connection setup",
    disconnect: "Turned off",
    test_connection: "Connection check",
    update_settings: "Settings updated",
    sync_stripe_finance_context: "Finance sync",
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
  const workspaces = useQuery(api.workspaces.get);
  const workspaceId = workspaces?.[0]?._id as Id<"workspaces"> | undefined;
  const services = useQuery(
    api.connectors.listForWorkspace,
    workspaceId ? { workspaceId } : "skip",
  ) as ServiceCard[] | undefined;
  const activityLogs = useQuery(
    api.connectors.getActionLogs,
    workspaceId ? { workspaceId } : "skip",
  ) as ActivityLog[] | undefined;
  const syncStripeFinance = useAction(api.connectors.syncStripeFinance);
  const startConnection = useMutation(api.connectors.startConnection);
  const testConnection = useMutation(api.connectors.testConnection);
  const disconnect = useMutation(api.connectors.disconnect);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [serviceMessages, setServiceMessages] = React.useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const visibleServices = React.useMemo(() => {
    if (!services) return undefined;
    return visibleConnectorServices(services);
  }, [services]);

  const groupedServices = React.useMemo(
    () => (visibleServices ? groupedConnectorServices(visibleServices) : undefined),
    [visibleServices],
  );

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
    } finally {
      setBusyKey(null);
    }
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
            Connect the tools FounderOS should read from or prepare work for. External actions still wait for approval.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-xs font-semibold text-text-secondary">
          <ShieldCheck size={15} className="text-emerald-600" />
          Approval protected
        </div>
      </div>

      <div className="mt-6">
        {visibleServices === undefined ? (
          <ServiceSkeleton />
        ) : !workspaceId ? (
          <div className="rounded-lg border border-black/[0.06] bg-white p-6 text-sm text-text-secondary">
            FounderOS is preparing your workspace.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedServices?.map((group) => {
              return (
                <section key={group.id} className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-sm">
                  <div className="border-b border-black/[0.05] px-4 py-3">
                    <h3 className="text-sm font-semibold text-text-primary">{group.title}</h3>
                  </div>
                  <div className="divide-y divide-black/[0.05]">
                    {group.services.map((service) => {
                      const isBusy = busyKey === service.id || Boolean(busyKey?.startsWith(`${service.id}:`));
                      const canCheck = Boolean(service.connectionId);
                      const canTurnOff = Boolean(service.connectionId && service.status !== "disabled");
                      const canSyncStripe = service.id === "stripe" && service.status === "connected" && Boolean(workspaceId);
                      const statusMessage = serviceMessages[service.id] ?? service.statusMessage;
                      const primaryLabel =
                        service.status === "connected"
                          ? "Check"
                          : service.status === "disabled"
                            ? "Connect"
                            : service.status === "needs_attention"
                              ? "Retry"
                              : "Connect";

                      return (
                        <article key={service.id} className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-surface">
                              <ServiceBrandIcon id={service.id} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-text-primary">{service.safeDisplayName}</h4>
                                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(service.status)}`}>
                                  {service.status === "connected" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                                  {statusCopy(service.status)}
                                </span>
                              </div>
                              <p className="mt-1 max-w-2xl text-xs leading-5 text-text-secondary">
                                {service.description}
                              </p>
                              <p className="mt-1 text-[11px] leading-4 text-text-muted">{statusMessage}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 md:justify-end">
                            <button
                              type="button"
                              title={primaryLabel}
                              disabled={isBusy || !workspaceId}
                              onClick={() => {
                                if (!workspaceId) return;
                                if (service.status === "connected" && service.connectionId) {
                                  void runServiceAction(service.id, () =>
                                    testConnection({ connectionId: service.connectionId! }),
                                  );
                                  return;
                                }
                                void runServiceAction(service.id, () =>
                                  startConnection({ workspaceId, connectorId: service.id }),
                                );
                              }}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-black px-3 text-xs font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <Plug size={14} />}
                              {primaryLabel}
                            </button>
                            {service.id === "stripe" && (
                              <button
                                type="button"
                                title="Sync finance context"
                                disabled={isBusy || !canSyncStripe}
                                onClick={() => {
                                  if (!workspaceId) return;
                                  void runServiceAction(
                                    `${service.id}:sync`,
                                    () => syncStripeFinance({ workspaceId, requestedBy: "settings" }),
                                    service.id,
                                  );
                                }}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 text-xs font-semibold text-text-secondary transition hover:bg-black/[0.035] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <RefreshCw size={14} className={busyKey === `${service.id}:sync` ? "animate-spin" : undefined} />
                                Sync
                              </button>
                            )}
                            {canCheck && service.status !== "connected" && (
                              <button
                                type="button"
                                title="Check"
                                disabled={isBusy}
                                onClick={() =>
                                  void runServiceAction(`${service.id}:check`, () =>
                                    testConnection({ connectionId: service.connectionId! }),
                                  )
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-text-secondary transition hover:bg-black/[0.035] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <RefreshCw size={15} />
                              </button>
                            )}
                            {canTurnOff && (
                              <button
                                type="button"
                                title="Turn off"
                                disabled={isBusy}
                                onClick={() =>
                                  void runServiceAction(`${service.id}:off`, () =>
                                    disconnect({ connectionId: service.connectionId! }),
                                  )
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/[0.08] bg-white text-text-secondary transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Power size={15} />
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

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
