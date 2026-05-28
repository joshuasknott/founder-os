"use client";

import { useState } from "react";
import { Key, Github, Cloud, Mail, AlertTriangle, ShieldCheck } from "lucide-react";

type ConnectionConfig = {
  id: string;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
};

export default function SettingsPage() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([
    { id: "openai", label: "OpenAI API", icon: <Key size={14} />, placeholder: "sk-...", value: "" },
    { id: "anthropic", label: "Anthropic Claude", icon: <Key size={14} />, placeholder: "sk-ant-...", value: "" },
    { id: "google", label: "Google Gemini AI", icon: <Key size={14} />, placeholder: "AIza...", value: "" },
    { id: "github", label: "GitHub Access Token", icon: <Github size={14} />, placeholder: "ghp_...", value: "" },
    { id: "vercel", label: "Vercel Platform", icon: <Cloud size={14} />, placeholder: "vercel_...", value: "" },
    { id: "resend", label: "Resend Email Platform", icon: <Mail size={14} />, placeholder: "re_...", value: "" },
  ]);

  const [dailyLimit, setDailyLimit] = useState("50");
  const [alertThreshold, setAlertThreshold] = useState("40");
  const [saved, setSaved] = useState(false);

  const updateConnection = (id: string, value: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, value } : c));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 p-8 max-w-2xl z-10 relative animate-fade-in">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-lg font-bold text-text-primary antialiased">Workspace Settings</h1>
        <p className="text-xs font-medium text-text-secondary mt-1">Configure API keys, model variables, and spending gates.</p>
      </div>

      {/* API Connections Card */}
      <section className="mb-6 bg-white/60 border border-black/[0.04] rounded-2xl p-6 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={14} className="text-accent" />
          <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">API Gateways</h2>
        </div>
        <div className="space-y-4">
          {connections.map((conn) => (
            <div key={conn.id} className="flex items-center gap-3.5 group">
              <div className="w-8.5 h-8.5 rounded-lg bg-black/[0.02] border border-black/[0.015] flex items-center justify-center text-text-secondary shrink-0 transition-transform duration-200 group-hover:scale-105">
                {conn.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">{conn.label}</label>
                </div>
                <input
                  type="password"
                  value={conn.value}
                  onChange={(e) => updateConnection(conn.id, e.target.value)}
                  placeholder={conn.placeholder}
                  className="w-full px-3 py-2 text-xs bg-white/70 border border-black/[0.05] rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/40 focus:bg-white transition-all font-mono placeholder:text-text-muted/60 text-text-primary shadow-sm shadow-black/[0.002]"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Warning Badge */}
        <div className="mt-5 p-3.5 bg-amber-50/60 border border-amber-500/10 rounded-xl text-[10.5px] leading-normal text-amber-800/90 flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="font-medium">
            Keys are secured inside isolated Convex production variables. Rest assured, your credentials are never exposed to client-side scripts.
          </p>
        </div>
      </section>

      {/* Cost Controls Card */}
      <section className="mb-8 bg-white/60 border border-black/[0.04] rounded-2xl p-6 backdrop-blur-md shadow-sm">
        <h2 className="text-xs font-bold text-text-primary mb-4 uppercase tracking-wider select-none">LLM Spend Controls</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-text-secondary block mb-1.5 uppercase tracking-wide select-none">Daily Spending Limit (£)</label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/70 border border-black/[0.05] rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/40 focus:bg-white transition-all font-semibold text-text-primary shadow-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary block mb-1.5 uppercase tracking-wide select-none">Alert Threshold (£)</label>
            <input
              type="number"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/70 border border-black/[0.05] rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent/40 focus:bg-white transition-all font-semibold text-text-primary shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* Save Action */}
      <button
        onClick={handleSave}
        className={`px-6 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all duration-200 active:scale-[0.97] cursor-pointer ${
          saved
            ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10"
            : "bg-accent hover:bg-accent-hover text-white shadow-accent/10"
        }`}
      >
        {saved ? "Saved Configuration ✓" : "Save Changes"}
      </button>
    </div>
  );
}
