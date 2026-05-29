"use client";

import { useState } from "react";
import { X, LayoutTemplate, Send, CodeIcon, GitPullRequest, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeInterventionModalProps {
  onClose: () => void;
  onApprove: () => Promise<void>;
  onDeny: () => Promise<void>;
  title: string;
  agentName: string;
  agentRole: string;
  justification: string;
  proposedPayload: string;
}

export function CodeInterventionModal({
  onClose,
  onApprove,
  onDeny,
  title,
  agentName,
  agentRole,
  justification,
  proposedPayload,
}: CodeInterventionModalProps) {
  const [showIDE, setShowIDE] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApprove = async () => {
    setIsProcessing(true);
    await onApprove();
    onClose();
  };

  const handleDeny = async () => {
    setIsProcessing(true);
    await onDeny();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/30 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[85vh] min-h-[600px] flex flex-col bg-white border border-zinc-200 rounded-sm shadow-2xl overflow-hidden shrink-0">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-black">Review Needed: {title}</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono tracking-tight text-amber-600 bg-amber-50 border border-amber-200 uppercase rounded-sm">
              Waiting for Review
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 transition-colors rounded-sm hover:text-black hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-black"
          >
            <X size={20} />
          </button>
        </div>

        {/* 60/40 Split View */}
        <div className="flex flex-1 min-h-0">

          {/* Left Column (60%) - Payload Preview / Override */}
          <div className="w-[60%] flex flex-col border-r border-zinc-200 bg-zinc-50 relative shrink-0">

            {/* Header / Toggle */}
            <div className="px-6 py-3 border-b border-zinc-200 bg-white flex justify-between items-center shrink-0">
              <span className="text-sm font-semibold text-black flex items-center gap-2">
                {showIDE ? <CodeIcon size={16} className="text-zinc-400" /> : <LayoutTemplate size={16} className="text-zinc-400" />}
                {showIDE ? "Details" : "Preview"}
              </span>
              <button
                onClick={() => setShowIDE(!showIDE)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold border rounded-sm transition-colors flex items-center gap-2",
                  showIDE
                    ? "bg-zinc-100 text-black border-zinc-200 hover:bg-zinc-200"
                    : "bg-white text-zinc-600 border-zinc-200 hover:text-black hover:bg-zinc-50"
                )}
              >
                {showIDE ? <>Back to Preview</> : <><CodeIcon size={12} /> View Details</>}
              </button>
            </div>

            {/* View Port */}
            <div className="flex-1 min-h-0 flex flex-col relative w-full overflow-hidden">
              {showIDE ? (
                <div className="flex-1 min-h-0 w-full relative bg-zinc-950 overflow-hidden p-6">
                  <pre className="h-full overflow-auto whitespace-pre-wrap break-words font-mono text-sm leading-6 text-zinc-100">
                    {proposedPayload}
                  </pre>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-8 bg-zinc-50/50">
                  <div className="w-full max-w-xl mx-auto border border-zinc-200 rounded-sm bg-white shadow-sm p-6">
                    <pre className="font-mono text-sm text-zinc-600 whitespace-pre-wrap break-all leading-relaxed">
                      {proposedPayload}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (40%) - Agent Justification + Iteration Chat */}
          <div className="w-[40%] flex flex-col bg-white shrink-0">

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 w-full">

              <div className="flex gap-4 group">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-black text-white text-sm font-bold shadow-sm">
                  {agentName[0]}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-semibold text-black">{agentName} ({agentRole})</span>
                  </div>
                  <div className="text-sm text-zinc-600 leading-relaxed border border-zinc-200 bg-zinc-50 rounded-sm p-3">
                    <p>{justification}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-zinc-200 rounded-sm">
                      <GitPullRequest size={12} className="text-zinc-400" />
                      <span className="text-[10px] font-mono tracking-tight text-zinc-500">Waiting for your review</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Context-bound Input Dock */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 shrink-0">
              <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm focus-within:ring-2 focus-within:ring-black focus-within:border-transparent transition-all">
                <textarea
                  value={revisionText}
                  onChange={(e) => setRevisionText(e.target.value)}
                  placeholder={`Ask for a change from ${agentName}...`}
                  className="w-full resize-none bg-transparent text-base text-black placeholder:text-zinc-400 focus:outline-none min-h-[60px]"
                  rows={2}
                />
                <div className="flex items-center justify-between pt-2">
                  <button className="flex h-8 w-8 items-center justify-center rounded-sm text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors">
                    <Mic size={16} />
                  </button>
                  <button
                    className={cn(
                      "flex h-8 px-4 items-center justify-center gap-2 rounded-sm text-xs font-semibold transition-colors",
                      revisionText.trim()
                        ? "bg-black text-white hover:bg-zinc-800"
                        : "bg-zinc-100 text-zinc-400 opacity-80 cursor-not-allowed"
                    )}
                  >
                    Send <Send size={12} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-200 bg-white flex justify-end gap-3 shrink-0">
          <button
            onClick={handleDeny}
            disabled={isProcessing}
            className="px-8 py-2.5 text-sm font-semibold text-zinc-600 bg-white border border-zinc-200 hover:text-black hover:bg-zinc-50 transition-colors rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Decline
          </button>
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="px-8 py-2.5 text-sm font-semibold text-white bg-black hover:bg-zinc-800 transition-colors rounded-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Approve
          </button>
        </div>

      </div>
    </div>
  );
}
