"use client";

import * as React from "react";
import { useState } from "react";
import Editor from "@monaco-editor/react";
import { X, LayoutTemplate, Send, CodeIcon, GitPullRequest, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_CODE = `export default function DashboardWidget() {
  return (
    <div className="p-6 bg-white border border-zinc-200 shadow-sm rounded-sm">
      <h3 className="text-lg font-semibold text-black mb-2">Revenue Velocity</h3>
      <div className="text-3xl font-bold tracking-tight text-black flex items-baseline gap-2">
        £42,500 <span className="text-xs font-medium text-emerald-500 tracking-normal">+12.4%</span>
      </div>
      <p className="text-sm text-zinc-500 mt-1">Updated 2 mins ago</p>
    </div>
  );
}`;

interface CodeInterventionModalProps {
  onClose: () => void;
}

export function CodeInterventionModal({ onClose }: CodeInterventionModalProps) {
  const [showIDE, setShowIDE] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [code, setCode] = useState(MOCK_CODE);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/30 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[85vh] min-h-[600px] flex flex-col bg-white border border-zinc-200 rounded-sm shadow-2xl overflow-hidden shrink-0">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-black">Action Review: Dashboard Widget</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono tracking-tight text-amber-600 bg-amber-50 border border-amber-200 uppercase rounded-sm">
              Pending Approval
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
          
          {/* Left Column (60%) - Preview Pane / Override */}
          <div className="w-[60%] flex flex-col border-r border-zinc-200 bg-zinc-50 relative shrink-0">
            
            {/* Header / Toggle */}
            <div className="px-6 py-3 border-b border-zinc-200 bg-white flex justify-between items-center shrink-0">
              <span className="text-sm font-semibold text-black flex items-center gap-2">
                {showIDE ? <CodeIcon size={16} className="text-zinc-400" /> : <LayoutTemplate size={16} className="text-zinc-400" />}
                {showIDE ? "Raw Source Code" : "Visual Preview"}
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
                {showIDE ? (
                  <>Exit Override</>
                ) : (
                  <><CodeIcon size={12} /> View Source</>
                )}
              </button>
            </div>
            
            {/* View Port (Essential: flex-1 min-h-0 on parent, height="100%" on Editor) */}
            <div className="flex-1 min-h-0 flex flex-col relative w-full overflow-hidden">
              {showIDE ? (
                <div className="flex-1 min-h-0 w-full relative bg-[#1e1e1e]">
                  <Editor
                    height="100%"
                    language="typescript"
                    theme="vs-dark"
                    value={code}
                    onChange={(val) => setCode(val || "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "JetBrains Mono, monospace",
                      lineHeight: 1.6,
                      padding: { top: 24, bottom: 24 },
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                    }}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto bg-zinc-50/50">
                  <div className="w-full h-full max-h-[400px] border-2 border-dashed border-zinc-300 rounded-sm flex flex-col items-center justify-center bg-white shadow-sm text-zinc-500 gap-4 transition-all">
                    <LayoutTemplate size={32} className="text-zinc-300" strokeWidth={1.5} />
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-sm font-semibold text-black">Preview of: Dashboard Widget</p>
                      <p className="text-xs text-zinc-500">The component has been drafted successfully.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (40%) - Agent Iteration Chat */}
          <div className="w-[40%] flex flex-col bg-white shrink-0">
            
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 w-full">
              
              <div className="flex gap-4 group">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-black text-white text-sm font-bold shadow-sm">
                  C
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-semibold text-black">Cipher (Frontend)</span>
                    <span className="text-[10px] font-mono text-zinc-400">10:42 AM</span>
                  </div>
                  <div className="text-sm text-zinc-600 leading-relaxed border border-zinc-200 bg-zinc-50 rounded-sm p-3">
                    <p className="mb-2">I have extracted the `Revenue Velocity` metric into its own dedicated widget component as requested.</p>
                    <p>It utilizes the strictly minimalist design required (no heavy rounded corners, pure black/white contrast) and includes the localized percentage delta.</p>
                  </div>
                  
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-zinc-200 rounded-sm">
                      <GitPullRequest size={12} className="text-zinc-400" />
                      <span className="text-[10px] font-mono tracking-tight text-zinc-500">+12 lines, -0 lines</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            {/* Context-bound Input Dock */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 shrink-0">
              <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm focus-within:ring-2 focus-within:ring-black focus-within:border-transparent transition-all">
                <textarea
                  value={revisionText}
                  onChange={(e) => setRevisionText(e.target.value)}
                  placeholder="Request a revision from Cipher..."
                  className="w-full resize-none bg-transparent text-sm text-black placeholder:text-zinc-400 focus:outline-none min-h-[60px]"
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

        {/* Absolute Footer Actions (Bottom Right Lock) */}
        <div className="px-6 py-4 border-t border-zinc-200 bg-white flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-8 py-2.5 text-sm font-semibold text-zinc-600 bg-white border border-zinc-200 hover:text-black hover:bg-zinc-50 transition-colors rounded-sm"
          >
            Deny Specification
          </button>
          <button 
            onClick={onClose}
            className="px-8 py-2.5 text-sm font-semibold text-white bg-black hover:bg-zinc-800 transition-colors rounded-sm shadow-sm"
          >
            Approve & Execute
          </button>
        </div>

      </div>
    </div>
  );
}
