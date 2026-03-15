"use client";

import { useState } from "react";
import { User, Activity, FileEdit, X, Save, Box } from "lucide-react";

type Agent = {
  id: string;
  name: string;
  role: string;
  status: "idle" | "working" | "offline";
  instruction: string;
};

const AGENTS: Agent[] = [
  { id: "orion", name: "Orion", role: "Chief of Staff", status: "idle", instruction: "You are Orion, the Chief of Staff. You route requests to the appropriate department, maintain the CEO's schedule, and ensure all cross-agent tasks are synchronized. Prioritize clarity and executive summaries." },
  { id: "atlas", name: "Atlas", role: "Backend Architecture", status: "working", instruction: "You are Atlas, the Lead Backend Engineer. You design scalable Convex schemas, write robust TRPC/Server Actions, and manage API integrations. You prioritize security and performance." },
  { id: "cipher", name: "Cipher", role: "Frontend Vanguard", status: "idle", instruction: "You are Cipher, the Lead Frontend Engineer. You specialize in Next.js, Tailwind v4, and react components. You strictly adhere to 'Executive Minimalism', preferring raw monochrome aesthetics over bubbly SaaS designs." },
  { id: "nova", name: "Nova", role: "Content & Strategy", status: "offline", instruction: "You are Nova, the Head of Content. You generate marketing copy, review brand voice, and synthesize raw data into compelling narratives." },
  { id: "sentinel", name: "Sentinel", role: "SecOps & Telemetry", status: "idle", instruction: "You are Sentinel, the Security Operations Lead. You monitor error logs, manage access control policies, and audit other agents' actions for compliance." }
];

export default function TeamPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  return (
    <div className="flex h-full flex-col w-full p-8 md:p-12 max-w-6xl mx-auto relative">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-black">The Team</h1>
        <p className="text-sm text-zinc-500">Manage agent directives, view operational status, and audit HR files.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {AGENTS.map(agent => (
          <AgentCard key={agent.id} agent={agent} onClick={() => setSelectedAgent(agent)} />
        ))}
        
        {/* Empty Slot */}
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-zinc-300 bg-zinc-50/50 hover:bg-zinc-50 p-6 text-center transition-colors cursor-pointer min-h-[160px]">
          <User size={24} className="mb-2 text-zinc-400" />
          <span className="text-sm font-medium text-black">Recruit New Agent</span>
        </div>
      </div>

      {selectedAgent && (
        <HRFileModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const statusColors = {
    idle: "bg-zinc-300",
    working: "bg-emerald-500 animate-pulse",
    offline: "bg-red-500"
  };

  return (
    <div 
      onClick={onClick}
      className="flex flex-col gap-4 rounded-sm border border-zinc-200 bg-white p-6 hover:border-black transition-colors cursor-pointer shadow-sm group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-black text-white text-lg font-bold">
            {agent.name[0]}
          </div>
          <div className="flex flex-col">
            <h3 className="text-base font-semibold text-black">{agent.name}</h3>
            <span className="text-xs font-mono text-zinc-500">{agent.role}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-zinc-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wider border border-zinc-100">
          <span className={`h-1.5 w-1.5 rounded-full ${statusColors[agent.status]}`} />
          {agent.status}
        </div>
      </div>
      
      <div className="mt-2 border-t border-zinc-100 pt-4">
        <div className="flex items-center justify-between text-xs text-zinc-500 group-hover:text-black transition-colors">
          <span className="flex items-center gap-1.5"><FileEdit size={14} /> View HR File</span>
          <span className="flex items-center gap-1.5"><Activity size={14} /> Telemetry</span>
        </div>
      </div>
    </div>
  );
}

function HRFileModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [instruction, setInstruction] = useState(agent.instruction);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white shadow-2xl rounded-sm border border-zinc-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-black text-white text-xl font-bold">
              {agent.name[0]}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-black">{agent.name} HR File</h2>
              <p className="text-sm font-mono text-zinc-500">{agent.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-black transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-black flex items-center gap-2">
              <Box size={16} /> Core Directives (System Prompt)
            </label>
            <p className="text-xs text-zinc-500 mb-2">
              These instructions permanently override base model weights and dictate {agent.name}'s behavior company-wide.
            </p>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="w-full h-48 rounded-sm border border-zinc-200 bg-zinc-50 p-4 text-sm text-black font-mono focus:outline-none focus:border-black focus:bg-white resize-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 border border-zinc-200 rounded-sm p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Model Assigned</span>
              <span className="text-sm font-mono text-black">gpt-4-turbo-preview</span>
            </div>
            <div className="flex flex-col gap-1 border border-zinc-200 rounded-sm p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Clearance Level</span>
              <span className="text-sm font-mono text-black">Level {agent.name === 'Orion' ? '4 (Admin)' : '2 (Standard)'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 p-4 bg-zinc-50 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-black transition-colors">
            Cancel
          </button>
          <button className="flex items-center gap-2 rounded-sm bg-black px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors">
            <Save size={16} /> Save Directives
          </button>
        </div>
      </div>
    </div>
  );
}
