"use client";

import { useState } from "react";
import { Check, X, FileJson, XCircle, Send, Plus, ChevronUp, Mic } from "lucide-react";

export function Rightnav() {
  const [activeTab, setActiveTab] = useState<"inbox" | "logs">("inbox");

  return (
    <aside className="flex h-full w-80 flex-col border-l border-zinc-200 bg-white">
      {/* Tabs / Header */}
      <div className="flex border-b border-zinc-200 p-2">
        <div className="flex w-full rounded-sm bg-zinc-100 p-1">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm py-1.5 text-xs font-semibold ${
              activeTab === "inbox" ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-black"
            }`}
          >
            Inbox
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] text-white">1</span>
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm py-1.5 text-xs font-semibold ${
              activeTab === "logs" ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-black"
            }`}
          >
            Logs
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto w-full">
        {activeTab === "inbox" ? <InboxView /> : <LogsView />}
      </div>
    </aside>
  );
}

function InboxView() {
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);

  // Dock state
  const [directive, setDirective] = useState("");
  const [modeOpen, setModeOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);

  const mockApprovals = [
    {
      id: "app-1",
      title: "Deploy V2 Infrastructure",
      description: "Atlas requires permission to provision 3 new edge regions.",
      agent: "Atlas",
      agentRole: "Backend Architecture",
      tier: "L3 Gate",
      spec: `{\n  "action": "provision_edge_regions",\n  "regions": [\n    "us-west-1",\n    "eu-central-1",\n    "ap-northeast-1"\n  ],\n  "estimatedCost": "$45.00/mo",\n  "riskLevel": "Medium"\n}`
    },
    {
      id: "app-2",
      title: "Update Brand Assets",
      description: "Nova requested a merge to update core brand svgs.",
      agent: "Nova",
      agentRole: "Content & Strategy",
      tier: "L2 Gate",
      spec: `{\n  "action": "merge_assets",\n  "files": [\n    "logo-v2.svg",\n    "favicon.ico"\n  ],\n  "impact": "Global Frontend",\n  "riskLevel": "Low"\n}`
    }
  ];

  const handleInlineAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    // mock action execution
  };

  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        {mockApprovals.map((app) => (
          <ApprovalCard 
            key={app.id} 
            data={app} 
            onClick={() => setSelectedApproval(app)} 
            onAction={handleInlineAction}
          />
        ))}
      </div>

      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-white shadow-2xl rounded-xl flex flex-col md:overflow-hidden h-full max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 md:px-6">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 rounded-sm bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  {selectedApproval.tier}
                </span>
                <h2 className="text-xl font-semibold tracking-tight text-black">{selectedApproval.title}</h2>
              </div>
              <button onClick={() => setSelectedApproval(null)} className="text-zinc-500 hover:text-black transition-colors rounded-sm hover:bg-zinc-100 p-1">
                <X size={24} />
              </button>
            </div>

            {/* Split View Content */}
            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
              
              {/* Left Column: Spec Editor (60%) */}
              <div className="w-full md:w-[60%] border-b md:border-b-0 md:border-r border-zinc-200 bg-zinc-950 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black">
                  <span className="flex items-center gap-2 text-xs font-mono font-medium text-zinc-300">
                    <FileJson size={14} className="text-zinc-500" /> payload.json
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-medium text-emerald-500">Valid JSON</span>
                  </div>
                </div>
                <textarea 
                  className="w-full flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-zinc-300 outline-none selection:bg-zinc-700"
                  defaultValue={selectedApproval.spec}
                  spellCheck={false}
                />
              </div>

              {/* Right Column: Agent Iteration Chat (40%) */}
              <div className="w-full md:w-[40%] flex flex-col bg-white min-h-[400px]">
                
                {/* Agent Identity */}
                <div className="flex items-center gap-3 border-b border-zinc-100 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-black text-white text-lg font-bold">
                    {selectedApproval.agent[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-black">{selectedApproval.agent}</h3>
                    <p className="text-xs font-mono text-zinc-500">{selectedApproval.agentRole}</p>
                  </div>
                </div>

                {/* Mock Chat History */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-xs font-semibold text-black">{selectedApproval.agent}</span>
                    <div className="rounded-sm rounded-tl-none border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 max-w-[90%]">
                      Here is the proposed specification for "{selectedApproval.title}". Please review the parameters.
                    </div>
                  </div>
                </div>

                {/* Iteration Input Dock (Gemini Style) & Footer Actions */}
                <div className="flex flex-col border-t border-zinc-200">
                  <div className="p-4">
                    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-visible flex flex-col focus-within:border-black transition-colors">
                      {/* Top: Auto-expanding Textarea */}
                      <textarea
                        value={directive}
                        onChange={(e) => setDirective(e.target.value)}
                        placeholder="Iterate on this spec..."
                        className="w-full resize-none bg-transparent text-sm text-black placeholder:text-zinc-400 focus:outline-none min-h-[44px] p-3 pb-0"
                        rows={1}
                      />
                      
                      {/* Bottom Toolbar */}
                      <div className="flex items-center justify-between p-2 mt-1">
                        {/* Left Side: Buttons & Dropdowns */}
                        <div className="flex items-center gap-2">
                          {/* Plus Button Selector */}
                          <div className="relative">
                            <button 
                              onClick={() => { setPlusOpen(!plusOpen); setModeOpen(false); }}
                              className="flex h-8 w-8 items-center justify-center rounded-sm text-zinc-500 hover:bg-zinc-100 hover:text-black transition-colors shrink-0"
                            >
                              <Plus size={18} />
                            </button>
                            {plusOpen && (
                              <div className="absolute left-0 bottom-full mb-1 w-48 rounded-sm border border-zinc-200 bg-white p-1 shadow-lg z-20">
                                <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black">Upload File</button>
                                <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black">Import from Knowledge</button>
                              </div>
                            )}
                          </div>
                          
                          <div className="h-4 w-px bg-zinc-200 mx-1" /> {/* Divider */}

                          {/* Mode Selector */}
                          <div className="relative">
                            <button 
                              onClick={() => { setModeOpen(!modeOpen); setPlusOpen(false); }}
                              className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-black transition-colors"
                            >
                              Chat
                              <ChevronUp size={14} className="opacity-50" />
                            </button>
                            {modeOpen && (
                              <div className="absolute left-0 bottom-full mb-1 w-32 rounded-sm border border-zinc-200 bg-white p-1 shadow-lg z-20">
                                <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black">Chat</button>
                                <button className="flex w-full items-center px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm text-zinc-600">Task</button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Side: Mic & Send */}
                        <div className="flex items-center gap-2">
                          <button className="flex h-8 w-8 items-center justify-center rounded-sm text-zinc-500 hover:bg-zinc-100 hover:text-black transition-colors">
                            <Mic size={18} />
                          </button>
                          <button 
                            className={`flex h-8 w-8 items-center justify-center rounded-sm transition-colors ${
                              directive.trim() ? 'bg-black text-white hover:bg-zinc-800' : 'bg-zinc-800 text-white opacity-80'
                            }`}
                          >
                            <Send size={14} strokeWidth={2.5} className="-ml-0.5 mt-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Absolute Bottom Actions */}
                  <div className="flex items-center justify-end gap-3 bg-zinc-50 p-4 border-t border-zinc-200">
                    <button 
                      onClick={() => setSelectedApproval(null)}
                      className="px-6 py-2 rounded-sm text-sm font-semibold text-black border border-zinc-200 hover:bg-zinc-100 transition-colors bg-white shadow-sm"
                    >
                      Deny
                    </button>
                    <button 
                      onClick={() => setSelectedApproval(null)}
                      className="px-6 py-2 rounded-sm text-sm font-semibold text-white bg-black hover:bg-zinc-800 transition-colors shadow-sm"
                    >
                      Approve
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ApprovalCard({ data, onClick, onAction }: { data: any; onClick: () => void; onAction: (e: React.MouseEvent) => void }) {
  return (
    <div 
      onClick={onClick}
      className="flex flex-col gap-3 rounded-sm border border-zinc-200 bg-white p-4 shadow-sm hover:border-black transition-colors cursor-pointer group"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black border border-zinc-200">
            {data.tier}
          </span>
          <span className="text-[10px] font-mono font-medium text-zinc-400">{data.agent}</span>
        </div>
        <h4 className="text-sm font-semibold text-black group-hover:underline underline-offset-2 leading-tight mt-1">{data.title}</h4>
      </div>
      
      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
        {data.description}
      </p>

      {/* Inline Actions */}
      <div className="flex items-center gap-2 mt-1">
        <button 
          onClick={onAction}
          className="flex-1 rounded-sm border border-zinc-200 bg-transparent py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-black transition-all hover:opacity-90 active:scale-95"
        >
          Deny
        </button>
        <button 
          onClick={onAction}
          className="flex-1 rounded-sm bg-black py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-all hover:opacity-90 active:scale-95"
        >
          Approve
        </button>
      </div>
    </div>
  );
}

function LogsView() {
  const mockLogs = [
    { time: "09:00:01", message: "> System: Initialized FounderOS sequence." },
    { time: "09:05:12", message: "> Atlas: Sandbox tests passed." },
    { time: "09:12:44", message: "> Orion: Compiled routing directives." },
    { time: "09:15:00", message: "> Cipher: Updated app shell." },
    { time: "09:20:11", message: "> Sentinel: Audit clear." }
  ];

  return (
    <div className="flex flex-col gap-2 p-4 font-mono text-sm text-zinc-600">
      {mockLogs.map((log, i) => (
        <div key={i} className="flex flex-col gap-0.5 border-b border-zinc-100 pb-2 last:border-0 hover:bg-zinc-50 p-1 rounded-sm">
          <span className="text-[10px] text-zinc-400">{log.time}</span>
          <span className="break-words">{log.message}</span>
        </div>
      ))}
      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-400"></span>
        </span>
        Awaiting events...
      </div>
    </div>
  );
}
