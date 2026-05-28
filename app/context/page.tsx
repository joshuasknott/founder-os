"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FileText, BookOpen, Activity, Plus, ChevronRight, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Tab = "documents" | "blueprints" | "activity";

export default function ContextPage() {
  const [activeTab, setActiveTab] = useState<Tab>("documents");
  const playbooks = useQuery(api.swarm.getAllPlaybooks);
  const recentLogs = useQuery(api.telemetry.getRecentLogs);
  const departments = useQuery(api.swarm.getDepartments);
  const recentDirectives = useQuery(api.directives.getRecentDirectives);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "documents", label: "Documents", icon: <FileText size={13} /> },
    { id: "blueprints", label: "Blueprints", icon: <BookOpen size={13} /> },
    { id: "activity", label: "Activity Logs", icon: <Activity size={13} /> },
  ];

  return (
    <div className="flex-1 flex flex-col z-10 relative animate-fade-in">
      {/* Header & Segments Bar */}
      <div className="border-b border-black/[0.03] bg-white/45 backdrop-blur-md px-8 pt-6 pb-0 shadow-sm shadow-black/[0.002]">
        <h1 className="text-lg font-bold text-text-primary antialiased">Context Center</h1>
        <p className="text-xs font-medium text-text-secondary mt-1 mb-5">Manage the blueprints, resources, and ledger tracks operating in your Swarm.</p>
        
        {/* iOS style Segmented Tab Control */}
        <div className="inline-flex gap-0.5 bg-black/[0.02] border border-black/[0.01] p-0.5 rounded-lg mb-4 select-none">
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4.5 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                  isTabActive
                    ? "bg-white text-text-primary shadow-sm border border-black/[0.02] font-bold"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <span className={isTabActive ? "text-accent" : "opacity-80"}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-transparent">
        {activeTab === "documents" && <DocumentsTab />}
        {activeTab === "blueprints" && <BlueprintsTab playbooks={playbooks} departments={departments} />}
        {activeTab === "activity" && <ActivityTab logs={recentLogs} directives={recentDirectives} />}
      </div>
    </div>
  );
}

function DocumentsTab() {
  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4 select-none">
        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Knowledge Base</h2>
        <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer">
          <Plus size={12} />
          Add Document
        </button>
      </div>
      <div className="border border-black/[0.04] rounded-2xl bg-white/60 p-10 text-center backdrop-blur-md shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-black/[0.02] border border-black/[0.015] flex items-center justify-center text-text-muted/70 mx-auto mb-4 select-none">
          <FileText size={20} />
        </div>
        <p className="text-sm font-bold text-text-primary mb-1 select-none">No custom documents active</p>
        <p className="text-xs text-text-secondary/85 leading-relaxed max-w-sm mx-auto">
          Documents added here become context assets for your agents using Vector RAG pipelines.
        </p>
      </div>
    </div>
  );
}

function BlueprintsTab({ playbooks, departments }: { playbooks: any; departments: any }) {
  if (!playbooks || !departments) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-text-muted/60" />
      </div>
    );
  }

  const getDeptName = (deptId: string) => {
    const dept = departments?.find((d: any) => d._id === deptId);
    return dept?.name ?? "Unknown";
  };

  return (
    <div className="max-w-4xl select-none">
      <h2 className="text-xs font-bold text-text-primary mb-4 uppercase tracking-wider">Swarm Playbooks</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {playbooks.map((pb: any) => (
          <div key={pb._id} className="border border-black/[0.04] rounded-2xl bg-white/60 hover:bg-white p-5 hover:border-accent/15 hover:shadow-[0_8px_30px_rgba(37,99,235,0.025)] transition-all duration-300 group backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors truncate pr-2">{pb.name}</h3>
                <span className="text-[9.5px] font-semibold px-2 py-0.5 bg-black/[0.02] border border-black/[0.01] rounded-md text-text-muted shrink-0">
                  {pb.taskMatrix?.length ?? 0} Steps
                </span>
              </div>
              <p className="text-xs leading-relaxed text-text-secondary mb-4 line-clamp-2">{pb.description}</p>
              
              {pb.taskMatrix && (
                <div className="mt-2.5 pt-3 border-t border-black/[0.015] space-y-2">
                  {pb.taskMatrix.map((task: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-medium text-text-secondary">
                      <ChevronRight size={11} className="text-accent/60 shrink-0" />
                      <span className="truncate flex-1">{task.title}</span>
                      <span className="text-[10px] text-text-muted italic bg-black/[0.01] px-1.5 py-0.5 rounded shrink-0">
                        {task.assignedAgentId.charAt(0).toUpperCase() + task.assignedAgentId.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-3.5 border-t border-black/[0.015] flex items-center">
              <span className="text-[9px] font-bold px-2 py-0.5 bg-accent/6 border border-accent/10 text-accent rounded-md uppercase tracking-wider">
                {getDeptName(pb.departmentId)} Swarm
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTab({ logs, directives }: { logs: any; directives: any }) {
  if (!directives) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-text-muted/60" />
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": 
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 shadow-sm shadow-emerald-500/5">
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
        );
      case "failed":
      case "blocked":
      case "aborted_by_principal": 
        return (
          <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 shadow-sm shadow-rose-500/5">
            <XCircle size={14} className="text-rose-500" />
          </div>
        );
      case "in_progress":
      case "pending_spec": 
        return (
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-500/10 flex items-center justify-center text-blue-500 shrink-0 shadow-sm shadow-blue-500/5 animate-pulse-soft">
            <Loader2 size={14} className="animate-spin text-accent" />
          </div>
        );
      default: 
        return (
          <div className="w-8 h-8 rounded-xl bg-black/[0.02] border border-black/[0.015] flex items-center justify-center text-text-muted shrink-0">
            <Clock size={14} className="text-text-muted" />
          </div>
        );
    }
  };

  return (
    <div className="max-w-2xl select-none">
      <h2 className="text-xs font-bold text-text-primary mb-4 uppercase tracking-wider">Ledger Ledger logs</h2>
      {directives.length === 0 ? (
        <div className="border border-black/[0.04] rounded-2xl bg-white/60 p-10 text-center backdrop-blur-md shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-black/[0.02] border border-black/[0.015] flex items-center justify-center text-text-muted/70 mx-auto mb-4 select-none">
            <Activity size={18} />
          </div>
          <p className="text-sm font-bold text-text-primary select-none">No active records found</p>
          <p className="text-xs text-text-secondary/85 leading-relaxed max-w-xs mx-auto mt-0.5">
            Create directives inside the Command control center to launch dynamic logs.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {directives.map((d: any) => (
            <div key={d._id} className="flex items-center gap-3.5 px-4.5 py-4 border border-black/[0.04] rounded-2xl bg-white/60 hover:bg-white hover:border-accent/15 hover:shadow-[0_8px_30px_rgba(37,99,235,0.025)] transition-all duration-300 backdrop-blur-md">
              {statusIcon(d.status)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-text-primary truncate">{d.title}</p>
                <p className="text-[10px] text-text-muted mt-0.5 truncate leading-relaxed">{d.objective}</p>
              </div>
              <span className={`text-[9.5px] font-bold px-2.5 py-0.5 rounded-md border shrink-0 ${
                d.status === "completed" 
                  ? "bg-emerald-500/8 border-emerald-500/10 text-emerald-600 font-semibold" 
                  : d.status === "in_progress" 
                  ? "bg-accent/8 border-accent/10 text-accent font-semibold" 
                  : d.status === "failed" 
                  ? "bg-rose-500/8 border-rose-500/10 text-rose-600 font-semibold" 
                  : "bg-black/[0.02] border-black/[0.015] text-text-secondary"
              }`}>
                {d.status.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
