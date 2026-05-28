"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Loader2 } from "lucide-react";

function AgentNodeComponent({ data }: NodeProps) {
  const { name, avatar, role, isActive, activity } = data as {
    name: string;
    avatar: string;
    role: string;
    isActive: boolean;
    activity?: string;
  };

  return (
    <>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-accent !border-2 !border-white !w-2.5 !h-2.5 !shadow-sm transition-all duration-200" 
      />
      <div
        className={`px-4.5 py-3.5 rounded-2xl border transition-all duration-300 min-w-[190px] backdrop-blur-md ${
          isActive
            ? "bg-blue-50/75 border-accent/20 shadow-[0_8px_30px_rgba(37,99,235,0.05)] animate-pulse-soft"
            : "bg-white/85 border-black/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.015)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-base border border-black/[0.03] select-none shrink-0">
            {avatar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-text-primary truncate">{name}</p>
            <p className="text-[10px] text-text-muted truncate mt-0.5">{role}</p>
          </div>
          {isActive && (
            <Loader2 size={12} className="text-accent animate-spin shrink-0 ml-1.5" />
          )}
        </div>
        {activity && (
          <p className="mt-2.5 text-[9.5px] font-medium leading-normal text-text-secondary truncate border-t border-black/[0.02] pt-2 select-none">
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

export const AgentNode = memo(AgentNodeComponent);
