"use client";

import { useState } from "react";
import { DollarSign, Key, Shield, AlertTriangle, Save, ServerCrash, Plus, Copy, Trash2 } from "lucide-react";
import { HumanTeamSettings } from "@/components/settings/human-team-settings";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"General" | "Team" | "Integrations" | "Billing">("Team");
  const tabs = ["General", "Team", "Integrations", "Billing"] as const;

  return (
    <div className="flex h-full flex-col w-full p-8 md:p-12 max-w-4xl mx-auto">
      <div className="flex items-center gap-6 border-b border-zinc-200 mb-8">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`cursor-pointer pb-3 text-sm font-semibold relative transition-colors ${
              activeTab === tab ? "text-black" : "text-zinc-500 hover:text-black"
            }`}
          >
            {tab}
            {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-black" />}
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        {activeTab === "General" && (
           <div className="text-sm text-zinc-500">General settings coming soon.</div>
        )}
        {activeTab === "Team" && <div className="animate-in fade-in duration-200"><HumanTeamSettings /></div>}
        {activeTab === "Integrations" && <div className="animate-in fade-in duration-200"><ExternalConnectionsSection /></div>}
        {activeTab === "Billing" && <div className="animate-in fade-in duration-200"><CostControlsSection /></div>}
      </div>
    </div>
  );
}

function CostControlsSection() {
  const [dailyLimit, setDailyLimit] = useState("50.00");
  const [alertThreshold, setAlertThreshold] = useState("40.00");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <DollarSign size={18} className="text-black" />
        <h2 className="text-lg font-semibold text-black">Cost & Circuit Breakers</h2>
      </div>
      <p className="text-sm text-zinc-500">Set hard daily limits. The system will halt autonomous execution if thresholds are breached.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-black">Daily Spending Limit (GBP)</label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-zinc-500 font-mono">£</span>
            <input 
              type="number" 
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full rounded-sm border border-zinc-200 px-8 py-2 font-mono text-sm text-black focus:border-black focus:outline-none transition-colors"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-black">Alert Threshold (GBP)</label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-zinc-500 font-mono">£</span>
            <input 
              type="number" 
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              className="w-full rounded-sm border border-zinc-200 px-8 py-2 font-mono text-sm text-black focus:border-black focus:outline-none transition-colors"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-2">
        <button className="flex items-center gap-2 rounded-sm bg-black px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors">
          <Save size={14} /> Update Allocations
        </button>
      </div>
    </section>
  );
}

function ExternalConnectionsSection() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <Key size={18} className="text-black" />
        <h2 className="text-lg font-semibold text-black">External Connections</h2>
      </div>
      <p className="text-sm text-zinc-500">Provide API keys for agent integrations. Keys are encrypted at rest.</p>
      
      <div className="flex flex-col gap-4 mt-2">
        <ApiKeyInput provider="OpenAI" description="Core intelligence model access." placeholder="sk-..." />
        <ApiKeyInput provider="Anthropic" description="Secondary reasoning models (Claude 3.5 Sonnet)." placeholder="sk-ant-..." />
        <ApiKeyInput provider="GitHub" description="Codebase read/write capabilities." placeholder="ghp_..." />
        <ApiKeyInput provider="Vercel" description="Deployment infrastructure." placeholder="..." />
        <ApiKeyInput provider="Resend" description="Transactional email operations." placeholder="re_..." />
        
        <button className="flex items-center justify-center gap-2 rounded-sm border border-dashed border-zinc-300 bg-zinc-50 py-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-black hover:border-zinc-400 transition-colors mt-2">
          <Plus size={14} /> Add Connection
        </button>
      </div>
      <div className="flex justify-end mt-4">
        <button className="flex items-center gap-2 rounded-sm bg-black px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors">
          <Save size={14} /> Save Keys
        </button>
      </div>
    </section>
  );
}

function ApiKeyInput({ provider, description, placeholder }: { provider: string; description: string; placeholder: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-sm border border-zinc-200 p-4 bg-zinc-50/50">
      <div className="flex flex-col w-1/3 min-w-[200px]">
        <span className="text-sm font-semibold text-black">{provider}</span>
        <span className="text-xs text-zinc-500">{description}</span>
      </div>
      <div className="flex-1 right-0 flex items-center gap-2">
        <Shield size={14} className="text-zinc-400 shrink-0" />
        <input 
          type="password" 
          placeholder={placeholder}
          defaultValue=""
          className="w-full rounded-sm border border-zinc-200 px-3 py-1.5 font-mono text-sm text-black focus:border-black focus:outline-none transition-colors"
        />
        <div className="flex items-center border-l border-zinc-200 pl-2 ml-1">
          <button className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-200 rounded-sm transition-colors">
            <Copy size={14} />
          </button>
          <button className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

