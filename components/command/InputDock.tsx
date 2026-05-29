"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Send,
  MessageSquare,
  Zap,
  ChevronDown,
  Loader2,
  Mic,
} from "lucide-react";

type Mode = "chat" | "task";

type BrowserSpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognitionErrorEvent = {
  error: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

export function InputDock({
  onChatSend,
  onTaskSend,
  isProcessing,
  mode,
  setMode,
  selectedAgentId,
  setSelectedAgentId,
}: {
  onChatSend: (message: string, agentId: Id<"agents">) => void;
  onTaskSend: (title: string, objective: string) => void;
  isProcessing: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
  selectedAgentId: Id<"agents"> | null;
  setSelectedAgentId: (id: Id<"agents"> | null) => void;
}) {
  const [input, setInput] = useState("");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (typeof window === "undefined") return;

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput((prev) => prev + (prev ? " " : "") + transcript);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  }, [isListening, setInput]);

  const agents = useQuery(api.swarm.getAllAgents);

  // Auto-select first agent if not already selected
  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0]._id);
    }
  }, [agents, selectedAgentId, setSelectedAgentId]);

  // Close picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAgentPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const selectedAgent = agents?.find((a) => a._id === selectedAgentId);

  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;

    if (mode === "chat" && selectedAgentId) {
      onChatSend(input.trim(), selectedAgentId);
    } else if (mode === "task") {
      onTaskSend(input.trim(), input.trim());
    }
    setInput("");
  }, [input, mode, selectedAgentId, isProcessing, onChatSend, onTaskSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-slide-up">
      <div className="bg-white/70 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.025)] hover:border-black/[0.08] focus-within:border-accent/20 focus-within:shadow-[0_12px_40px_rgba(37,99,235,0.035)] backdrop-blur-xl rounded-2xl transition-all duration-300">
        {/* Mode Toggle & Agent Picker */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 border-b border-black/[0.015]">
          <div className="flex items-center gap-1 bg-black/[0.02] p-0.5 rounded-lg border border-black/[0.01]">
            <button
              onClick={() => setMode("chat")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                mode === "chat"
                  ? "bg-white text-text-primary shadow-sm border border-black/[0.02]"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <MessageSquare size={12} className={mode === "chat" ? "text-accent" : ""} />
              Chat
            </button>
            <button
              onClick={() => setMode("task")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                mode === "task"
                  ? "bg-white text-text-primary shadow-sm border border-black/[0.02]"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Zap size={12} className={mode === "task" ? "text-amber-500 animate-pulse-soft" : ""} />
              Task
            </button>
          </div>

          {/* Agent Picker (Chat mode) */}
          {mode === "chat" && (
            <div className="relative ml-auto" ref={pickerRef}>
              <button
                onClick={() => setShowAgentPicker(!showAgentPicker)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-black/[0.02] hover:bg-black/[0.04] border border-black/[0.02] rounded-lg transition-all duration-200 active:scale-[0.98]"
              >
                {selectedAgent && (
                  <span className="text-sm leading-none">{selectedAgent.avatar}</span>
                )}
                <span>{selectedAgent?.name ?? "Choose worker"}</span>
                <ChevronDown size={12} className={`opacity-65 transition-transform duration-200 ${showAgentPicker ? "rotate-180" : ""}`} />
              </button>

              {showAgentPicker && agents && (
                <div className="absolute bottom-full right-0 mb-2 w-60 bg-white/90 backdrop-blur-2xl border border-black/[0.05] rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.06)] p-1 z-50 animate-slide-up">
                  <div className="px-2 py-1.5 text-[9px] font-bold text-text-muted uppercase tracking-widest border-b border-black/[0.02] mb-1">
                    Choose AI Worker
                  </div>
                  <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
                    {agents.map((agent) => (
                      <button
                        key={agent._id}
                        onClick={() => {
                          setSelectedAgentId(agent._id);
                          setShowAgentPicker(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-150 ${
                          selectedAgentId === agent._id
                            ? "bg-accent/8 text-accent font-medium"
                            : "text-text-secondary hover:bg-black/[0.02] hover:text-text-primary"
                        }`}
                      >
                        <span className="text-base">{agent.avatar}</span>
                        <div className="text-left min-w-0">
                          <div className="text-xs font-semibold truncate">{agent.name}</div>
                          <div className="text-[10px] text-text-muted truncate">{agent.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex items-end gap-2.5 px-4 pb-3 pt-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "chat"
                ? `Ask ${selectedAgent?.name ?? "FounderOS"}...`
                : "Describe the work to create..."
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted/65 focus:outline-none py-2 px-1 max-h-[120px] leading-relaxed selection:bg-accent/15"
            disabled={isProcessing}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleListening}
              disabled={isProcessing}
              aria-label={isListening ? "Stop listening" : "Start listening"}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 active:scale-[0.96] disabled:opacity-20 ${
                isListening
                  ? "bg-red-500 border-red-500 text-white animate-pulse"
                  : "border-black/[0.04] bg-white text-text-muted hover:text-text-primary hover:bg-black/[0.02]"
              }`}
            >
              <Mic size={13} />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-accent text-white disabled:opacity-20 disabled:scale-100 disabled:cursor-not-allowed hover:bg-accent-hover hover:scale-[1.04] transition-all duration-200 active:scale-[0.96]"
            >
              {isProcessing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
            </button>
          </div>
        </div>

        {/* Mode hint */}
        <div className="px-4 py-2 border-t border-black/[0.015] bg-black/[0.005] rounded-b-2xl">
          <p className="text-[10px] tracking-wide text-text-muted/80">
            {mode === "chat"
              ? "Chat helps you think and plan. It does not create business outputs."
              : "Task creates a visible work item and saves finished outputs in Library."}
          </p>
        </div>
      </div>
    </div>
  );
}
