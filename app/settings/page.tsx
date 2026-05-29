"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Cloud,
  Github,
  KeyRound,
  Mail,
  Save,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

type ConnectionConfig = {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  placeholder: string;
  value: string;
};

export default function SettingsPage() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([
    {
      id: "primary_ai",
      label: "Everyday AI",
      description: "Used for planning, drafting, and everyday conversations.",
      icon: <KeyRound size={14} />,
      placeholder: "Everyday AI key",
      value: "",
    },
    {
      id: "backup_ai",
      label: "Backup AI",
      description: "Used when the everyday AI is unavailable and for Library search.",
      icon: <KeyRound size={14} />,
      placeholder: "Backup AI key",
      value: "",
    },
    {
      id: "github",
      label: "GitHub",
      description: "Lets tasks prepare software updates when connected.",
      icon: <Github size={14} />,
      placeholder: "Webhook secret or access token",
      value: "",
    },
    {
      id: "preview_hosting",
      label: "Preview Hosting",
      description: "Lets FounderOS prepare private preview links for review.",
      icon: <Cloud size={14} />,
      placeholder: "Hosting key",
      value: "",
    },
    {
      id: "email",
      label: "Email Sending",
      description: "Used only after you approve external outreach.",
      icon: <Mail size={14} />,
      placeholder: "Email service key",
      value: "",
    },
  ]);

  const [dailyLimit, setDailyLimit] = useState("50");
  const [alertThreshold, setAlertThreshold] = useState("40");
  const [saved, setSaved] = useState(false);

  const updateConnection = (id: string, value: string) => {
    setConnections((previous) =>
      previous.map((connection) => (connection.id === id ? { ...connection, value } : connection)),
    );
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-full px-8 py-7">
      <div className="mx-auto max-w-4xl">
        <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
          Business settings.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Manage connections, spending limits, and review rules for your FounderOS workspace.
        </p>

        <section className="mt-7 rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck size={16} />
            <h2 className="text-sm font-semibold text-text-primary">Connections</h2>
          </div>

          <div className="space-y-4">
            {connections.map((connection) => (
              <div key={connection.id} className="grid gap-3 rounded-lg border border-black/[0.06] p-4 md:grid-cols-[1fr_280px]">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-text-secondary">
                    {connection.icon}
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-text-primary">{connection.label}</label>
                    <p className="mt-1 text-xs leading-5 text-text-muted">{connection.description}</p>
                  </div>
                </div>
                <input
                  type="password"
                  value={connection.value}
                  onChange={(event) => updateConnection(connection.id, event.target.value)}
                  placeholder={connection.placeholder}
                  className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <WalletCards size={16} />
            <h2 className="text-sm font-semibold text-text-primary">Spend Controls</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Daily spending limit
              </span>
              <input
                type="number"
                value={dailyLimit}
                onChange={(event) => setDailyLimit(event.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm font-semibold outline-none focus:border-black/20 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Alert threshold
              </span>
              <input
                type="number"
                value={alertThreshold}
                onChange={(event) => setAlertThreshold(event.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm font-semibold outline-none focus:border-black/20 focus:bg-white"
              />
            </label>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-text-primary">Approval Rules</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            FounderOS can draft, preview, schedule, and organize internal work. It asks before
            publishing publicly, changing live assets, deleting important data, spending money,
            sending email, posting externally, or contacting people outside the business.
          </p>
        </section>

        <button
          onClick={handleSave}
          className="mt-6 flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black/90"
        >
          <Save size={15} />
          {saved ? "Saved" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
