"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Plus, Send, ChevronUp, Mic, FileIcon, X, Search, FileText } from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

type Agent = {
  _id: Id<"agents">;
  name: string;
  role: string;
  status: "idle" | "working" | "offline";
  clearanceLevel: number;
  model: string;
  systemPrompt: string;
  workspaceId: Id<"workspaces">;
};

export default function BoardroomPage() {
  const agents = useQuery(api.agents.get);
  const [directive, setDirective] = useState("");
  const [selectedMode, setSelectedMode] = useState<"Chat" | "Task">("Chat");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  const [blueprintModalOpen, setBlueprintModalOpen] = useState(false);
  const [blueprintSearch, setBlueprintSearch] = useState("");

  // Default to the first agent once data loads
  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0] as Agent);
    }
  }, [agents, selectedAgent]);

  // Mock attachments state
  const [attachments, setAttachments] = useState<{ id: string; name: string }[]>([
    { id: "1", name: "Document.pdf" }
  ]);

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  return (
    <div className="flex h-full flex-col relative w-full bg-white">
      {/* Empty State Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
        <h2 className="text-3xl font-light tracking-tight text-zinc-800">Good morning. Let's build.</h2>
        {selectedMode === "Chat" ? (
          <p className="text-base font-mono text-zinc-500 max-w-md">
            <span className="font-semibold text-black">Chat Mode:</span> Brainstorming with agents. No system changes will be executed.
          </p>
        ) : (
          <p className="text-base font-mono text-zinc-500 max-w-md">
            <span className="font-semibold text-black">Task Mode:</span> Issuing directives. Agents will generate actionable specifications for approval.
          </p>
        )}
      </div>

      {/* Input Dock (Floating) */}
      <div className="mx-auto w-full max-w-4xl mb-6 px-4 md:px-6">
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm flex flex-col p-6 md:p-8 gap-3">
          
          {/* Attachments Area */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {attachments.map((file) => (
                <div key={file.id} className="flex items-center gap-1.5 rounded-sm bg-zinc-100 px-2 py-1 text-xs font-medium text-black border border-zinc-200">
                  <FileIcon size={12} className="text-zinc-500" />
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <button 
                    onClick={() => removeAttachment(file.id)}
                    className="ml-1 text-zinc-400 hover:text-black transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area */}
          <textarea
            value={directive}
            onChange={(e) => setDirective(e.target.value)}
            placeholder="Give a directive..."
            className="w-full resize-none bg-transparent text-base text-black placeholder:text-zinc-400 focus:outline-none min-h-[44px]"
            rows={1}
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between mt-2 pt-2">
            
            {/* Left Side: Buttons & Dropdowns */}
            <div className="flex items-center gap-2">
              {/* Plus Button Selector */}
              <div className="relative">
                <button 
                  onClick={() => { setPlusOpen(!plusOpen); setModeOpen(false); setAgentOpen(false); setBlueprintOpen(false); }}
                  className="flex h-8 w-8 items-center justify-center rounded-sm text-zinc-500 hover:bg-zinc-100 hover:text-black transition-colors shrink-0"
                >
                  <Plus size={18} />
                </button>
                {plusOpen && (
                  <div className="absolute left-0 bottom-full mb-1 w-48 max-h-96 overflow-y-auto rounded-sm border border-zinc-200 bg-white p-1 shadow-lg z-50">
                    <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black">Upload File</button>
                    <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black">Import from Knowledge</button>
                  </div>
                )}
              </div>
              
              <div className="h-4 w-px bg-zinc-200 mx-1" /> {/* Divider */}

              {/* Mode Selector */}
              <div className="relative">
                <button 
                  onClick={() => { setModeOpen(!modeOpen); setAgentOpen(false); setBlueprintOpen(false); setPlusOpen(false); }}
                  className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-black transition-colors"
                >
                  {selectedMode}
                  <ChevronUp size={14} className="opacity-50" />
                </button>
                {modeOpen && (
                  <div className="absolute left-0 bottom-full mb-1 w-32 max-h-96 overflow-y-auto rounded-sm border border-zinc-200 bg-white p-1 shadow-lg z-50">
                    <button onClick={() => { setSelectedMode("Chat"); setModeOpen(false); }} className={`flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm ${selectedMode === "Chat" ? "bg-zinc-100 text-black font-semibold" : "font-medium text-black"}`}>Chat</button>
                    <button onClick={() => { setSelectedMode("Task"); setModeOpen(false); }} className={`flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm ${selectedMode === "Task" ? "bg-zinc-100 text-black font-semibold" : "text-zinc-600"}`}>Task</button>
                  </div>
                )}
              </div>

              {/* Agent Selector */}
              <div className="relative hidden sm:block">
                <button 
                  onClick={() => { setAgentOpen(!agentOpen); setModeOpen(false); setBlueprintOpen(false); setPlusOpen(false); }}
                  className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-black transition-colors"
                >
                  {agents === undefined ? (
                    <span className="h-3 w-24 rounded-sm bg-zinc-200 animate-pulse inline-block" />
                  ) : selectedAgent ? (
                    <>{selectedAgent.name} ({selectedAgent.role})</>
                  ) : (
                    "No Agent"
                  )}
                  <ChevronUp size={14} className="opacity-50" />
                </button>
                {agentOpen && (
                  <div className="absolute left-0 bottom-full mb-1 w-56 max-h-96 overflow-y-auto rounded-sm border border-zinc-200 bg-white p-1 shadow-lg z-50">
                    {agents === undefined ? (
                      <div className="flex flex-col gap-1 p-2">
                        <div className="h-3 w-full rounded-sm bg-zinc-100 animate-pulse" />
                        <div className="h-3 w-3/4 rounded-sm bg-zinc-100 animate-pulse" />
                      </div>
                    ) : (
                      agents.map((agent) => (
                        <button
                          key={agent._id}
                          onClick={() => { setSelectedAgent(agent as Agent); setAgentOpen(false); }}
                          className={`flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm ${selectedAgent?._id === agent._id ? "font-semibold text-black" : "font-medium text-zinc-600"}`}
                        >
                          {agent.name} ({agent.role})
                        </button>
                      ))
                    )}
                    <div className="my-1 border-t border-zinc-100" />
                    <button 
                      onClick={() => { setAgentModalOpen(true); setAgentOpen(false); }}
                      className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black"
                    >
                      Browse Agents
                    </button>
                  </div>
                )}
              </div>

              {/* Blueprint Selector */}
              <div className="relative hidden md:block">
                <button 
                  onClick={() => { setBlueprintOpen(!blueprintOpen); setModeOpen(false); setAgentOpen(false); setPlusOpen(false); }}
                  className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-black transition-colors"
                >
                  No Blueprint
                  <ChevronUp size={14} className="opacity-50" />
                </button>
                {blueprintOpen && (
                  <div className="absolute left-0 bottom-full mb-1 w-48 max-h-96 overflow-y-auto rounded-sm border border-zinc-200 bg-white p-1 shadow-lg z-50">
                    <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black">No Blueprint</button>
                    <div className="my-1 border-t border-zinc-100" />
                    <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm text-zinc-600">Frontend Architecture Rewrite</button>
                    <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm text-zinc-600">Database Migration SOP</button>
                    <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm text-zinc-600">Weekly Investor Update</button>
                    <div className="my-1 border-t border-zinc-100" />
                    <button 
                      onClick={() => { setBlueprintModalOpen(true); setBlueprintOpen(false); }}
                      className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black"
                    >
                      Browse Blueprints
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Mic & Send */}
            <div className="flex items-center gap-2">
              <button className="flex h-8 w-8 items-center justify-center rounded-sm text-zinc-500 hover:bg-zinc-100 hover:text-black transition-colors">
                <Mic size={18} />
              </button>
              <button className={`flex h-8 w-8 items-center justify-center rounded-sm transition-colors ${directive.trim() ? 'bg-black text-white hover:bg-zinc-800' : 'bg-zinc-800 text-white opacity-80'}`}>
                <Send size={14} strokeWidth={2.5} className="-ml-0.5 mt-0.5" />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Agent Selection Modal */}
      {agentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white shadow-2xl rounded-sm border border-zinc-200 flex flex-col max-h-[90vh]">
            
            <div className="flex flex-col border-b border-zinc-200">
              <div className="flex items-center justify-between p-4">
                <h2 className="text-lg font-semibold text-black">Select Agent</h2>
                <button onClick={() => setAgentModalOpen(false)} className="text-zinc-400 hover:text-black transition-colors rounded-sm p-1 hover:bg-zinc-100">
                  <X size={20} />
                </button>
              </div>
              <div className="relative px-4 pb-4">
                <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 -mt-2 text-zinc-400" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search agents by name or role..." 
                  value={agentSearch}
                  onChange={(e) => setAgentSearch(e.target.value)}
                  className="w-full rounded-sm border border-zinc-200 py-2.5 pl-10 pr-4 text-sm font-medium text-black focus:border-black focus:outline-none transition-colors bg-zinc-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agents === undefined ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-sm border border-zinc-100 p-3 animate-pulse">
                    <div className="h-10 w-10 rounded-sm bg-zinc-200 shrink-0" />
                    <div className="flex flex-col gap-1.5 flex-1">
                      <div className="h-3 w-20 rounded-sm bg-zinc-200" />
                      <div className="h-2.5 w-28 rounded-sm bg-zinc-100" />
                    </div>
                  </div>
                ))
              ) : (
                agents
                  .filter(a => 
                    agentSearch.trim() === "" ||
                    a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
                    a.role.toLowerCase().includes(agentSearch.toLowerCase())
                  )
                  .map((agent) => (
                    <AgentModalCard 
                      key={agent._id}
                      name={agent.name}
                      role={agent.role}
                      status={agent.status as "idle" | "working" | "offline"}
                      onClick={() => { setSelectedAgent(agent as Agent); setAgentModalOpen(false); }}
                    />
                  ))
              )}
            </div>

            <div className="border-t border-zinc-200 p-3 bg-zinc-50 flex items-center justify-center">
              <Link href="/team" className="text-xs font-semibold text-zinc-500 hover:text-black hover:underline underline-offset-2 transition-all">
                Manage Team Settings
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Blueprint Selection Modal */}
      {blueprintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white shadow-2xl rounded-sm border border-zinc-200 flex flex-col max-h-[90vh]">
            
            <div className="flex flex-col border-b border-zinc-200">
              <div className="flex items-center justify-between p-4">
                <h2 className="text-lg font-semibold text-black">Select Blueprint</h2>
                <button onClick={() => setBlueprintModalOpen(false)} className="text-zinc-400 hover:text-black transition-colors rounded-sm p-1 hover:bg-zinc-100">
                  <X size={20} />
                </button>
              </div>
              <div className="relative px-4 pb-4">
                <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 -mt-2 text-zinc-400" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search blueprints by title or keyword..." 
                  value={blueprintSearch}
                  onChange={(e) => setBlueprintSearch(e.target.value)}
                  className="w-full rounded-sm border border-zinc-200 py-2.5 pl-10 pr-4 text-sm font-medium text-black focus:border-black focus:outline-none transition-colors bg-zinc-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-2">
              <BlueprintModalCard title="Frontend Architecture Rewrite" description="Strict instructions on enforcing Executive Minimalism across React components." onClick={() => setBlueprintModalOpen(false)} />
              <BlueprintModalCard title="Database Migration SOP" description="Standard procedure for safely running schema changes via Convex." onClick={() => setBlueprintModalOpen(false)} />
              <BlueprintModalCard title="Weekly Investor Update" description="Format specifications and data sources required to compile the weekly metric report." onClick={() => setBlueprintModalOpen(false)} />
            </div>

            <div className="border-t border-zinc-200 p-3 bg-zinc-50 flex items-center justify-center">
              <Link href="/intelligence?tab=blueprints" className="text-xs font-semibold text-zinc-500 hover:text-black hover:underline underline-offset-2 transition-all">
                Manage Blueprints in Intelligence Hub
              </Link>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

function AgentModalCard({ name, role, status, onClick }: { name: string; role: string; status: "idle" | "working" | "offline"; onClick: () => void }) {
  const statusColors = {
    idle: "border-zinc-300",
    working: "bg-emerald-500 animate-pulse border-emerald-500",
    offline: "border-red-500 bg-red-500"
  };

  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-3 rounded-sm border border-zinc-200 bg-white p-3 hover:border-black transition-colors shadow-sm text-left group"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-black text-white text-lg font-bold">
        {name[0]}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-black truncate">{name}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{status}</span>
            <span className={`h-2 w-2 rounded-full border ${status === 'idle' ? 'bg-transparent' : ''} ${statusColors[status]}`} />
          </div>
        </div>
        <span className="text-xs text-zinc-500 font-mono truncate">{role}</span>
      </div>
    </button>
  );
}

function BlueprintModalCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-sm border border-zinc-200 bg-white p-3 hover:border-black transition-colors shadow-sm text-left group"
    >
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-zinc-400 group-hover:text-black transition-colors shrink-0" />
        <span className="text-sm font-semibold text-black truncate">{title}</span>
      </div>
      <p className="text-xs text-zinc-500 line-clamp-1 truncate w-full">{description}</p>
    </button>
  );
}
