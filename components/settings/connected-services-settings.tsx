"use client";

import * as React from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Code2,
  CreditCard,
  FileText,
  HardDrive,
  Mail,
  Megaphone,
  MessageSquare,
  Plug,
  Power,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

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

const serviceIcons: Record<string, LucideIcon> = {
  email: Mail,
  gmail: Mail,
  calendar: CalendarDays,
  google_calendar: CalendarDays,
  google_drive: HardDrive,
  slack: MessageSquare,
  notion: FileText,
  payments: CreditCard,
  stripe: CreditCard,
  publishing: Megaphone,
  knowledge: BookOpen,
  code_hosting: Code2,
  vercel: Code2,
};

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
    sync_stripe_finance_context: "Finance context sync",
  };
  return labels[actionType] ?? actionType.replace(/_/g, " ");
}

function activityClasses(status: ActivityLog["status"]) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed" || status === "needs_attention") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "approval_required") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-zinc-200 bg-white text-zinc-500";
}

function activityStatusCopy(status: ActivityLog["status"]) {
  const labels: Record<ActivityLog["status"], string> = {
    pending: "Pending",
    completed: "Complete",
    needs_attention: "Needs attention",
    approval_required: "Needs approval",
    failed: "Needs attention",
  };
  return labels[status];
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
    <div className="grid gap-3 md:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="h-48 animate-pulse rounded-lg border border-black/[0.06] bg-white p-5">
          <div className="h-8 w-8 rounded-lg bg-black/[0.04]" />
          <div className="mt-4 h-4 w-36 rounded bg-black/[0.04]" />
          <div className="mt-3 h-3 w-full rounded bg-black/[0.035]" />
          <div className="mt-2 h-3 w-4/5 rounded bg-black/[0.035]" />
        </div>
      ))}
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
            Connected Services
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
            Services FounderOS can use.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Connect the services you want FounderOS to help with. Sensitive actions still ask for
            approval before anything is sent, published, charged, or changed live.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-xs font-semibold text-text-secondary">
          <ShieldCheck size={15} className="text-emerald-600" />
          Approval protected
        </div>
      </div>

      <div className="mt-6">
        {services === undefined ? (
          <ServiceSkeleton />
        ) : !workspaceId ? (
          <div className="rounded-lg border border-black/[0.06] bg-white p-6 text-sm text-text-secondary">
            FounderOS is preparing your workspace.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {services.map((service) => {
              const Icon = serviceIcons[service.id] ?? Plug;
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
                <article
                  key={service.id}
                  className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/[0.035] text-text-primary">
                        <Icon size={19} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-text-primary">
                          {service.safeDisplayName}
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-text-secondary">
                          {service.description}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusClasses(service.status)}`}
                    >
                      {service.status === "connected" ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <AlertCircle size={13} />
                      )}
                      {statusCopy(service.status)}
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                      Access Needed
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {service.requiredAccess.map((access) => (
                        <span
                          key={access}
                          className="rounded-lg border border-black/[0.06] bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary"
                        >
                          {access}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-black/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-text-muted">{statusMessage}</p>
                    <div className="flex shrink-0 items-center gap-2">
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
                          <RefreshCw
                            size={14}
                            className={busyKey === `${service.id}:sync` ? "animate-spin" : undefined}
                          />
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
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {activityLogs !== undefined && activityLogs.length > 0 && (
        <div className="mt-6 rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                Recent Activity
              </p>
              <h3 className="mt-1 text-base font-semibold text-text-primary">
                Safe connection history.
              </h3>
            </div>
            <ShieldCheck size={17} className="text-emerald-600" />
          </div>
          <div className="mt-4 divide-y divide-black/[0.06]">
            {activityLogs.slice(0, 8).map((log) => (
              <div key={log._id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize text-text-primary">
                    {actionCopy(log.actionType)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    {log.safeError ?? log.safeSummary}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${activityClasses(log.status)}`}>
                    {activityStatusCopy(log.status)}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatActivityTime(log.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
