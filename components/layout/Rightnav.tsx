"use client";

import { useState } from "react";
import { Check, X, FileJson, XCircle, Send, Plus, ChevronUp, Mic } from "lucide-react";
import { CodeInterventionModal } from "@/components/modals/code-intervention-modal";

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
        <CodeInterventionModal onClose={() => setSelectedApproval(null)} />
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
