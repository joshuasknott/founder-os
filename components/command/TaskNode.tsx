"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { CheckCircle2, Loader2, AlertCircle, Clock, Zap } from "lucide-react";

function TaskNodeComponent({ data }: NodeProps) {
  const { label, status, agentName, agentAvatar, activity, isDirective } = data as {
    label: string;
    status: string;
    agentName?: string;
    agentAvatar?: string;
    activity?: string;
    isDirective?: boolean;
  };

  const statusConfig: Record<
    string,
    { bg: string; border: string; icon: React.ReactNode; label: string; text: string; tagBg: string }
  > = {
    queued: {
      bg: "bg-white/85 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.015)]",
      border: "border-black/[0.04]",
      icon: <Clock size={11} className="text-text-muted" />,
      label: "Queued",
      text: "text-text-secondary",
      tagBg: "bg-black/[0.02] border-black/[0.02]",
    },
    in_progress: {
      bg: "bg-blue-50/75 backdrop-blur-md shadow-[0_8px_24px_rgba(37,99,235,0.025)] animate-pulse-soft",
      border: "border-accent/15",
      icon: <Loader2 size={11} className="text-accent animate-spin" />,
      label: "Working",
      text: "text-accent",
      tagBg: "bg-accent/8 border-accent/5",
    },
    completed: {
      bg: "bg-emerald-50/65 backdrop-blur-md shadow-[0_4px_16px_rgba(16,185,129,0.015)]",
      border: "border-emerald-500/15",
      icon: <CheckCircle2 size={11} className="text-emerald-500" />,
      label: "Completed",
      text: "text-emerald-600 font-semibold",
      tagBg: "bg-emerald-500/8 border-emerald-500/5",
    },
    failed: {
      bg: "bg-rose-50/60 backdrop-blur-md shadow-[0_4px_16px_rgba(239,68,68,0.015)]",
      border: "border-rose-500/15",
      icon: <AlertCircle size={11} className="text-rose-500" />,
      label: "Failed",
      text: "text-rose-600 font-semibold",
      tagBg: "bg-rose-500/8 border-rose-500/5",
    },
    pending_spec: {
      bg: "bg-sky-50/65 backdrop-blur-md shadow-[0_8px_24px_rgba(14,165,233,0.025)] animate-pulse-soft",
      border: "border-sky-500/15",
      icon: <Loader2 size={11} className="text-sky-500 animate-spin" />,
      label: "Preparing",
      text: "text-sky-600",
      tagBg: "bg-sky-500/8 border-sky-500/5",
    },
    blocked: {
      bg: "bg-amber-50/60 backdrop-blur-md shadow-[0_4px_16px_rgba(245,158,11,0.015)]",
      border: "border-amber-500/15",
      icon: <AlertCircle size={11} className="text-amber-500" />,
      label: "Blocked",
      text: "text-amber-600 font-semibold",
      tagBg: "bg-amber-500/8 border-amber-500/5",
    },
  };

  const config = statusConfig[status] ?? statusConfig.queued;

  return (
    <>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-accent !border-2 !border-white !w-2.5 !h-2.5 !shadow-sm transition-all duration-200" 
      />
      <div
        className={`px-4.5 py-4 rounded-2xl border transition-all duration-300 min-w-[210px] max-w-[270px] ${config.bg} ${config.border}`}
      >
        {/* Header Block */}
        <div className="flex items-center gap-3 mb-2.5">
          {isDirective ? (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/15 to-blue-500/5 border border-accent/10 flex items-center justify-center shadow-sm text-accent shrink-0">
              <Zap size={12} className="text-accent animate-pulse-soft" />
            </div>
          ) : agentAvatar ? (
            <div className="w-7 h-7 rounded-lg bg-white border border-black/[0.03] shadow-sm flex items-center justify-center text-sm shrink-0 select-none">
              {agentAvatar}
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-text-primary truncate antialiased">{label}</p>
            {agentName && !isDirective && (
              <p className="text-[10px] text-text-muted mt-0.5 font-medium select-none truncate">{agentName}</p>
            )}
          </div>
        </div>

        {/* Status indicator row */}
        <div className="flex items-center justify-between border-t border-black/[0.015] pt-2.5 mt-1 select-none">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${config.text} ${config.tagBg}`}>
            {config.icon}
            <span>{config.label}</span>
          </div>
        </div>

        {/* Activity text */}
        {activity && status === "in_progress" && (
          <p className="mt-2.5 text-[9.5px] font-medium leading-normal text-text-muted truncate border-t border-black/[0.015] pt-2 select-none">
            {activity}
          </p>
        )}
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-accent !border-2 !border-white !w-2.5 !h-2.5 !shadow-sm transition-all duration-200" 
      />
    </>
  );
}

export const TaskNode = memo(TaskNodeComponent);
