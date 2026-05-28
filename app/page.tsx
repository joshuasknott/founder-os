"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import { InputDock } from "@/components/command/InputDock";
import { ChatView } from "@/components/command/ChatView";
import { AgentMap } from "@/components/command/AgentMap";
import { Zap, MessageSquare, Loader2 } from "lucide-react";

type View = "idle" | "chat" | "task";
type Mode = "chat" | "task";

export default function CommandPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-transparent z-10">
          <div className="w-10 h-10 rounded-xl bg-white/70 border border-black/[0.04] shadow-sm flex items-center justify-center animate-spin">
            <Loader2 size={18} className="text-accent" />
          </div>
        </div>
      }
    >
      <CommandPageInner />
    </Suspense>
  );
}

function CommandPageInner() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");

  const [view, setView] = useState<View>("idle");
  const [mode, setMode] = useState<Mode>("chat");
  const [selectedAgentId, setSelectedAgentId] = useState<Id<"agents"> | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<Id<"chatSessions"> | null>(
    sessionParam ? (sessionParam as Id<"chatSessions">) : null
  );
  const [activeDirectiveId, setActiveDirectiveId] = useState<Id<"directives"> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Convex queries
  const agents = useQuery(api.swarm.getAllAgents);
  const isSeeded = useQuery(api.init.isSeeded);
  const chatMessages = useQuery(
    api.chat.getMessages,
    activeSessionId ? { sessionId: activeSessionId } : "skip"
  );
  const activeDirective = useQuery(
    api.directives.getDirectiveById,
    activeDirectiveId ? { directiveId: activeDirectiveId } : "skip"
  );
  const directiveTasks = useQuery(
    api.directives.getTasksByDirective,
    activeDirectiveId ? { directiveId: activeDirectiveId } : "skip"
  );
  const directiveLogs = useQuery(
    api.telemetry.getLogsByDirective,
    activeDirectiveId ? { directiveId: activeDirectiveId } : "skip"
  );

  // Convex mutations/actions
  const createSession = useMutation(api.chat.createSession);
  const sendChatMessage = useAction(api.chat.sendMessage);
  const createDirective = useMutation(api.directives.createDirective);
  const seedSwarm = useMutation(api.init.seedSwarm);

  // Auto-seed on first load
  useEffect(() => {
    if (isSeeded === false) {
      seedSwarm().catch(console.error);
    }
  }, [isSeeded, seedSwarm]);

  // If session param provided, switch to chat view
  useEffect(() => {
    if (sessionParam) {
      setActiveSessionId(sessionParam as Id<"chatSessions">);
      setView("chat");
    }
  }, [sessionParam]);

  // Get agent info for current chat session
  const chatSessionsList = useQuery(api.chat.getSessions);
  const currentSession = chatSessionsList?.find((s) => s._id === activeSessionId);
  const chatAgent = agents?.find((a) => a._id === currentSession?.agentId);
  const selectedAgent = agents?.find((a) => a._id === selectedAgentId);

  // Poll for directive completion
  useEffect(() => {
    if (activeDirective && (activeDirective.status === "completed" || activeDirective.status === "blocked")) {
      setIsProcessing(false);
    }
  }, [activeDirective]);

  // Keep selectedAgentId synchronized when activeSessionId or chatAgent loads/changes
  useEffect(() => {
    if (chatAgent) {
      setSelectedAgentId(chatAgent._id);
    }
  }, [chatAgent]);

  // Handle agent switching from the dropdown picker
  const handleAgentChange = useCallback((newAgentId: Id<"agents"> | null) => {
    if (!newAgentId) return;
    setSelectedAgentId(newAgentId);

    // Switch to existing session with this agent if it exists
    const existingSession = chatSessionsList?.find((s) => s.agentId === newAgentId);
    if (existingSession) {
      setActiveSessionId(existingSession._id);
      setView("chat");
      setMode("chat");
    } else {
      setActiveSessionId(null);
      setView("chat");
      setMode("chat");
    }
  }, [chatSessionsList]);

  // Auto-switch mode based on active view state
  useEffect(() => {
    if (view === "chat") {
      setMode("chat");
    } else if (view === "task") {
      setMode("task");
    }
  }, [view]);

  const handleChatSend = useCallback(
    async (message: string, agentId: Id<"agents">) => {
      setIsProcessing(true);
      setView("chat");

      try {
        let sessionId = activeSessionId;

        if (!sessionId) {
          // Create a new session
          sessionId = await createSession({
            agentId,
            title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
          });
          setActiveSessionId(sessionId);
        }

        await sendChatMessage({
          sessionId,
          agentId,
          content: message,
        });
      } catch (error) {
        console.error("Chat error:", error);
      } finally {
        setView("chat");
        setIsProcessing(false);
      }
    },
    [activeSessionId, createSession, sendChatMessage]
  );

  const handleTaskSend = useCallback(
    async (title: string, objective: string) => {
      setIsProcessing(true);
      setView("task");

      try {
        const directiveId = await createDirective({ title, objective });
        setActiveDirectiveId(directiveId);
      } catch (error) {
        console.error("Directive error:", error);
        setIsProcessing(false);
      }
    },
    [createDirective]
  );

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setActiveDirectiveId(null);
    setView("idle");
    setIsProcessing(false);
  }, []);

  // Loading state while checking seed
  if (isSeeded === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent z-10">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-white/70 border border-black/[0.04] shadow-sm flex items-center justify-center animate-spin">
            <Loader2 size={18} className="text-accent" />
          </div>
          <p className="text-xs font-semibold text-text-secondary select-none">Initializing FounderOS...</p>
        </div>
      </div>
    );
  }

  // Seeding state
  if (isSeeded === false) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent z-10">
        <div className="flex flex-col items-center gap-3 animate-fade-in text-center px-6">
          <div className="w-10 h-10 rounded-xl bg-white/70 border border-black/[0.04] shadow-sm flex items-center justify-center animate-spin mb-1">
            <Loader2 size={18} className="text-accent" />
          </div>
          <p className="text-xs font-bold text-text-primary tracking-wide">Setting up your Swarm Workspace...</p>
          <p className="text-[10px] text-text-muted font-medium tracking-widest uppercase">Deploying agents and playbooks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative h-full">
      {/* Task Mode: Agent Map */}
      {view === "task" && activeDirective && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Task header */}
          <div className="border-b border-black/[0.03] bg-white/45 backdrop-blur-md px-6 py-4 flex items-center justify-between z-20 shadow-sm shadow-black/[0.002]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center shadow-sm text-accent shrink-0 animate-pulse-soft">
                <Zap size={14} className="text-accent" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-text-primary truncate antialiased">{activeDirective.title}</h2>
                <p className="text-[10px] font-semibold text-text-muted tracking-wider uppercase mt-0.5">
                  {activeDirective.status === "in_progress" || activeDirective.status === "pending_spec"
                    ? "Agents actively coordinating"
                    : activeDirective.status === "completed"
                    ? "Directive completed successfully"
                    : activeDirective.status.replace(/_/g, " ")}
                </p>
              </div>
            </div>
            <button
              onClick={handleNewSession}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary px-3.5 py-2 border border-black/[0.04] bg-white/60 hover:bg-white shadow-sm shadow-black/[0.005] rounded-lg transition-all duration-200 active:scale-[0.97]"
            >
              New Session
            </button>
          </div>

          {/* Agent Map Grid */}
          <AgentMap
            directive={activeDirective}
            tasks={directiveTasks}
            agents={agents}
            logs={directiveLogs}
          />
        </div>
      )}

      {/* Chat Mode */}
      {view === "chat" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat header */}
          <div className="border-b border-black/[0.03] bg-white/45 backdrop-blur-md px-6 py-4 flex items-center justify-between z-20 shadow-sm shadow-black/[0.002]">
            <div className="flex items-center gap-3">
              {chatAgent ? (
                <div className="w-8 h-8 rounded-xl bg-white border border-black/[0.04] shadow-sm flex items-center justify-center text-base shrink-0 select-none">
                  {chatAgent.avatar}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-accent/8 flex items-center justify-center text-accent shrink-0 select-none">
                  <MessageSquare size={14} />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-text-primary truncate antialiased">
                  {chatAgent?.name ?? selectedAgent?.name ?? "Chat Session"}
                </h2>
                <p className="text-[10px] font-semibold text-text-muted tracking-wider uppercase mt-0.5 truncate">
                  {chatAgent?.role ?? "Discuss objective and delegate tasks"}
                </p>
              </div>
            </div>
            <button
              onClick={handleNewSession}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary px-3.5 py-2 border border-black/[0.04] bg-white/60 hover:bg-white shadow-sm shadow-black/[0.005] rounded-lg transition-all duration-200 active:scale-[0.97]"
            >
              New Session
            </button>
          </div>

          {/* Messages view */}
          <ChatView
            messages={chatMessages as any}
            isLoading={isProcessing}
            agentName={chatAgent?.name ?? selectedAgent?.name ?? "Agent"}
            agentAvatar={chatAgent?.avatar ?? selectedAgent?.avatar ?? "🤖"}
          />

          {/* Helper Mode explanation when there are no messages in the chat room yet */}
          {chatMessages && chatMessages.length === 0 && !isProcessing && (
            <div className="flex-1 flex items-center justify-center animate-fade-in relative z-10">
              <div className="flex flex-col items-center text-center max-w-md px-6 select-none">
                <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Chat Mode</h2>
                <h3 className="text-sm font-bold text-text-primary tracking-tight mb-2 antialiased">
                  Conversation with {chatAgent?.name ?? selectedAgent?.name}
                </h3>
                <p className="text-xs font-medium text-text-secondary/90 leading-relaxed max-w-xs">
                  Brainstorm guidelines, refine templates, and explore playbooks. Planning conversations are completely safe and will not alter files.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Idle State */}
      {view === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 z-10 relative">
          {mode === "chat" ? (
            <div className="flex flex-col items-center text-center max-w-md px-6 animate-fade-in select-none">
              <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Chat Mode</h2>
              <h3 className="text-sm font-bold text-text-primary tracking-tight mb-2 antialiased">
                Brainstorm with {selectedAgent?.name ?? "your Agent Swarm"}
              </h3>
              <p className="text-xs font-medium text-text-secondary/90 leading-relaxed max-w-xs">
                Discuss objectives and plan guidelines. Conversational planning sessions will not modify files or make code changes.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center max-w-md px-6 animate-fade-in select-none">
              <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Task Mode</h2>
              <h3 className="text-sm font-bold text-text-primary tracking-tight mb-2 antialiased">
                Issue Swarm Directive
              </h3>
              <p className="text-xs font-medium text-text-secondary/90 leading-relaxed max-w-xs">
                Deploy automated workflows. Your agent crew will self-assemble, draft a multi-step blueprint task matrix, and execute changes in the codebase.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Input Dock — floating always on top */}
      <div className="px-6 py-6 bg-transparent relative z-20">
        <InputDock
          onChatSend={handleChatSend}
          onTaskSend={handleTaskSend}
          isProcessing={isProcessing}
          mode={mode}
          setMode={setMode}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={handleAgentChange}
        />
      </div>
    </div>
  );
}
