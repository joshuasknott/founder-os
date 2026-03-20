"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DollarSign, Key, Shield, Plus, Copy, Trash2, Save } from "lucide-react";
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
  const workspaces = useQuery(api.workspaces.get);
  const workspaceId = workspaces?.[0]?._id as Id<"workspaces"> | undefined;
  const keys = useQuery(api.integrations.get);
  const addMutation = useMutation(api.integrations.add);
  const removeMutation = useMutation(api.integrations.remove);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newValue.trim() || !workspaceId) return;
    setIsAdding(true);
    try {
      await addMutation({ workspaceId, name: newName.trim(), value: newValue.trim() });
      setNewName("");
      setNewValue("");
      setShowForm(false);
    } finally {
      setIsAdding(false);
    }
  };

  const maskValue = (val: string) => {
    if (val.length <= 8) return "••••••••";
    return val.slice(0, 4) + "•".repeat(Math.min(val.length - 8, 20)) + val.slice(-4);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <Key size={18} className="text-black" />
        <h2 className="text-lg font-semibold text-black">External Connections</h2>
      </div>
      <p className="text-sm text-zinc-500">API keys for agent integrations. Keys are encrypted at rest.</p>

      <div className="flex flex-col gap-3 mt-1">
        {/* Loading skeletons */}
        {keys === undefined && (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-sm border border-zinc-200 bg-zinc-50/50 animate-pulse" />
          ))
        )}

        {/* Live key rows */}
        {keys?.map((key) => (
          <div key={key._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-sm border border-zinc-200 p-4 bg-zinc-50/50">
            <div className="flex flex-col shrink-0 min-w-[160px]">
              <span className="text-sm font-semibold text-black">{key.name}</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <Shield size={14} className="text-zinc-400 shrink-0" />
              <input
                type="text"
                readOnly
                value={maskValue(key.value)}
                className="w-full rounded-sm border border-zinc-200 px-3 py-1.5 font-mono text-sm text-zinc-500 bg-zinc-100 cursor-default focus:outline-none"
              />
              <div className="flex items-center border-l border-zinc-200 pl-2 ml-1">
                <button
                  type="button"
                  title="Copy"
                  onClick={() => navigator.clipboard.writeText(key.value)}
                  className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-200 rounded-sm transition-colors"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  title="Remove"
                  onClick={() => removeMutation({ keyId: key._id as Id<"api_keys"> })}
                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty state */}
        {keys !== undefined && keys.length === 0 && !showForm && (
          <p className="text-sm text-zinc-400 py-2">No connections added yet.</p>
        )}

        {/* Inline Add Form */}
        {showForm && (
          <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-sm border border-zinc-200 bg-zinc-50/50 p-4">
            <h3 className="text-sm font-semibold text-black">New Connection</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Name (e.g. OpenAI)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="flex-1 px-3 py-2 text-sm border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black rounded-none bg-white"
              />
              <input
                type="password"
                placeholder="API Key value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                required
                className="flex-1 px-3 py-2 text-sm font-mono border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black rounded-none bg-white"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowForm(false); setNewName(""); setNewValue(""); }}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-black transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-white bg-black hover:bg-zinc-800 transition-colors disabled:opacity-50 rounded-none"
              >
                <Save size={12} /> {isAdding ? "Saving..." : "Save Key"}
              </button>
            </div>
          </form>
        )}

        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-sm border border-dashed border-zinc-300 bg-zinc-50 py-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-black hover:border-zinc-400 transition-colors mt-1"
        >
          <Plus size={14} /> Add Connection
        </button>
      </div>
    </section>
  );
}
