"use client";

import * as React from "react";
import { useState } from "react";
import Editor from "@monaco-editor/react";
import { X, FileCode2, RotateCcw, Play, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_FILES = [
  "/app/page.tsx",
  "/components/ui/button.tsx",
  "/lib/utils.ts"
];

const MOCK_CODE = `export default function BoardroomPage() {
  // Agent proposed these changes to optimize rendering
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    // Simulated heavy init
    setTimeout(() => setIsReady(true), 500);
  }, []);

  if (!isReady) return <LoadingScreen />;

  return (
    <div className="flex flex-col h-screen bg-white">
      <TopNav />
      <MainStage />
    </div>
  );
}`;

interface CodeInterventionModalProps {
  onClose: () => void;
}

export function CodeInterventionModal({ onClose }: CodeInterventionModalProps) {
  const [activeFile, setActiveFile] = useState(MOCK_FILES[0]);
  const [code, setCode] = useState(MOCK_CODE);
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

  const handleRunTests = () => {
    setIsTesting(true);
    setTestSuccess(null);
    // Simulate test runner
    setTimeout(() => {
      setIsTesting(false);
      setTestSuccess(true);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-zinc-950/90 backdrop-blur-sm animate-in fade-in duration-200 p-4 md:p-8">
      <div className="relative flex flex-col w-full h-full overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl rounded-sm text-zinc-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Manual Override (Code Intervention)</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono tracking-tight text-amber-500 bg-amber-500/10 border border-amber-500/20 uppercase rounded-sm">
              Agent Spec Draft
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-zinc-500 transition-colors rounded-sm hover:text-white hover:bg-zinc-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Split UI */}
        <div className="flex flex-1 min-h-0 bg-zinc-950">
          
          {/* Left Sidebar: File Tree (20%) */}
          <div className="w-1/5 min-w-[200px] flex flex-col border-r border-zinc-800 bg-[#1e1e1e]">
            <div className="px-4 py-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase border-b border-zinc-800">
              Touched Files
            </div>
            <div className="flex flex-col flex-1 py-2 overflow-y-auto">
              {MOCK_FILES.map((file) => (
                <button
                  key={file}
                  onClick={() => setActiveFile(file)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 text-xs text-left font-mono transition-colors",
                    activeFile === file 
                      ? "bg-zinc-800 text-white border-l-2 border-white" 
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border-l-2 border-transparent"
                  )}
                >
                  <FileCode2 size={14} className="shrink-0" />
                  <span className="truncate">{file.split("/").pop()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Area: Monaco Editor (80%) */}
          <div className="flex flex-col flex-1 relative bg-[#1e1e1e]">
            {/* Editor Tabs / Path */}
            <div className="flex items-center px-4 py-2 border-b border-zinc-800 bg-[#1e1e1e]">
              <span className="text-xs font-mono text-zinc-400">
                {activeFile}
              </span>
            </div>
            
            {/* Editor Container */}
            <div className="flex-1 relative">
              <Editor
                height="100%"
                language={activeFile.endsWith('.ts') ? 'typescript' : 'javascript'}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "JetBrains Mono, monospace",
                  lineHeight: 1.6,
                  padding: { top: 16, bottom: 16 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                }}
              />
            </div>
          </div>
        </div>

        {/* Action Bar (Footer) */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-950 shrink-0">
          <button className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-400 transition-colors bg-transparent border border-zinc-800 rounded-sm hover:text-white hover:bg-zinc-800">
            <RotateCcw size={14} />
            Revert to Agent Version
          </button>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleRunTests}
              disabled={isTesting}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors border rounded-sm",
                testSuccess 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white disabled:opacity-50"
              )}
            >
              {isTesting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : testSuccess ? (
                <Check size={14} />
              ) : (
                <Play size={14} />
              )}
              {isTesting ? "Running Tests..." : testSuccess ? "Tests Passed" : "Run Sandbox Tests"}
            </button>

            <button 
              onClick={onClose}
              className="flex items-center gap-2 px-6 py-2 text-xs font-medium text-black transition-colors bg-white rounded-sm hover:bg-zinc-200"
            >
              <Check size={14} />
              Approve & Merge
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
