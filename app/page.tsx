"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  ListTodo,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCcw,
  UserRound,
} from "lucide-react";

type PromptMode = "chat" | "task";

type Message = {
  _id: Id<"chatMessages">;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  _creationTime: number;
};

type WorkRun = {
  _id: Id<"workRuns">;
  title: string;
  status: string;
  summary?: string;
  previewUrl?: string;
  updatedAt: number;
  updates: Array<{
    _id: Id<"workRunUpdates">;
    message: string;
    tone: string;
    createdAt: number;
  }>;
};

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



function cleanDisplayText(value: string) {
  return value
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\*\*?Autonomy Level\s*\d+\s*(?:[-\u2013\u2014]\s*[^*]+)?\*\*?/gi, "")
    .replace(/\bAutonomy Level\s*\d+\s*(?:[-\u2013\u2014]\s*[A-Za-z ]+)?/gi, "")
    .replace(/\bRAG\b|\bAI Router\b|\bTOOL_INVOCATION\b/gi, "")
    .replace(/last commit:\s*`?HEAD`?\s*\([^)]*\)/gi, "workspace history is up to date")
    .replace(/\bBuild\/Webhook Activity\b/gi, "Activity")
    .replace(/\bcommit\b/gi, "version")
    .replace(/\bexecute\b/gi, "run")
    .replace(/(?:ready to\s*)?operate at\s*[\u2013\u2014-]\s*/gi, "ready to continue and ")
    .replace(/\bApproval Needed\b/gi, "Review")
    .replace(/task at,?\s*/gi, "task, ")
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/\ban Library item\b/gi, "a Library item")
    .replace(/\ban Library items\b/gi, "Library items")
    .replace(/\boperator(s)?\b/gi, "worker$1")
    .replace(/\brouting\b/gi, "planning")
    .replace(/#{1,6}\s*/g, "")
    .replace(/---+/g, "")
    .replace(/\*{2,}/g, "")
    .replace(/,{2,}/g, ",")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

function titleFromPrompt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) return "New task";
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoader />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session") as Id<"chatSessions"> | null;
  const taskParam = searchParams.get("task") as Id<"directives"> | null;

  const overview = useQuery(api.commandCenter.getOverview);
  const isSeeded = useQuery(api.init.isSeeded);
  const agents = useQuery(api.swarm.getAllAgents);
  const messages = useQuery(
    api.chat.getMessages,
    sessionParam ? { sessionId: sessionParam } : "skip",
  ) as Message[] | undefined;

  const workRuns = useQuery(
    api.workRuns.getRunsAndUpdates,
    taskParam ? { directiveId: taskParam } : "skip",
  ) as WorkRun[] | undefined;

  const seedWorkspace = useMutation(api.init.seedSwarm);
  const createSession = useMutation(api.chat.createSession);
  const sendMessage = useAction(api.chat.sendMessage);
  const createTask = useMutation(api.directives.createDirective);
  const approve = useMutation(api.approvals.approve);
  const deny = useMutation(api.approvals.deny);

  const [mode, setMode] = useState<PromptMode>("chat");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasConversation = Boolean(messages?.length);

  useEffect(() => {
    if (isSeeded === false) {
      seedWorkspace().catch(() => setNotice("FounderOS could not prepare the workspace yet."));
    }
  }, [isSeeded, seedWorkspace]);

  useEffect(() => {
    if (!sessionParam && !taskParam) {
      setMode("chat");
      setNotice(null);
    }
  }, [taskParam, sessionParam]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
  }, [input]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && hasConversation) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages?.length, hasConversation]);

  const defaultWorker = useMemo(() => {
    if (!agents?.length) return null;
    return agents.find((agent) => agent.name === "Orion") ?? agents[0];
  }, [agents]);

  const suggestions = useMemo(() => {
    const hasLibraryItems = (overview?.stats.artifacts ?? 0) > 0;
    const all = [
      // --- Chat Mode ---
      {
        mode: "chat" as const,
        label: "Help me decide what to focus on this week",
        personalizationKey: "weekly_focus",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        ),
      },
      {
        mode: "chat" as const,
        label: "Turn these rough notes into a clear task",
        personalizationKey: "shape_task",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        ),
      },
      {
        mode: "chat" as const,
        label: "Draft a message explaining a project delay",
        personalizationKey: "delay_message",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        ),
      },
      {
        mode: "chat" as const,
        label: "Help me find the strongest next task from Library",
        personalizationKey: "library_next_task",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
          </svg>
        ),
        libraryOnly: true,
      },
      {
        mode: "chat" as const,
        label: "Help me prioritize customer feedback",
        personalizationKey: "feedback_priority",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
        excludeIfLibrary: true,
      },

      // --- Task Mode ---
      {
        mode: "task" as const,
        label: "Create a client onboarding checklist",
        personalizationKey: "client_onboarding",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500">
            <path d="m9 11 3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        ),
      },
      {
        mode: "task" as const,
        label: "Draft a one-page investor update",
        personalizationKey: "investor_update",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-500">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
        ),
      },
      {
        mode: "task" as const,
        label: "Write a detailed product specification",
        personalizationKey: "product_spec",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 9H8" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
          </svg>
        ),
      },
      {
        mode: "task" as const,
        label: "Summarize recent Library work into a founder brief",
        personalizationKey: "library_brief",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
        ),
        libraryOnly: true,
      },
      {
        mode: "task" as const,
        label: "Prepare a meeting agenda for tomorrow",
        personalizationKey: "meeting_agenda",
        svg: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500">
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
          </svg>
        ),
        excludeIfLibrary: true,
      },
    ];

    return all.filter((item) => {
      if (item.libraryOnly && !hasLibraryItems) return false;
      if (item.excludeIfLibrary && hasLibraryItems) return false;
      return item.mode === mode;
    });
  }, [overview?.stats.artifacts, mode]);

  const ensureConversation = useCallback(
    async (title: string) => {
      if (sessionParam) return sessionParam;
      if (!defaultWorker) throw new Error("FounderOS is still preparing your AI workers.");

      const sessionId = await createSession({
        agentId: defaultWorker._id,
        title,
      });
      router.replace(`/?session=${sessionId}`);
      return sessionId;
    },
    [createSession, defaultWorker, router, sessionParam],
  );

  const resetHome = useCallback(() => {
    setInput("");
    setMode("chat");
    setNotice(null);
    router.replace("/");
  }, [router]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setNotice(null);
    setInput("");

    try {
      const sessionId = await ensureConversation(titleFromPrompt(trimmed));

      if (mode === "chat") {
        if (!defaultWorker) throw new Error("FounderOS is still preparing your AI workers.");
        await sendMessage({
          sessionId,
          agentId: defaultWorker._id,
          content: trimmed,
        });
        router.replace(`/?session=${sessionId}`);
        return;
      }

      const directiveId = await createTask({
        title: titleFromPrompt(trimmed),
        objective: trimmed,
        sessionId,
      });

      setMode("chat");
      setNotice("Task added to your workspace. I'll keep you posted on progress.");
      router.replace(`/?session=${sessionId}&task=${directiveId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Try again in a moment.";
      setInput(trimmed);
      setNotice(message);
    } finally {
      setIsSending(false);
    }
  }, [
    createTask,
    defaultWorker,
    ensureConversation,
    input,
    isSending,
    mode,
    router,
    sendMessage,
  ]);

  const isLoading = overview === undefined || isSeeded === undefined || isSeeded === false || agents === undefined;

  if (isLoading) {
    return <HomeLoader />;
  }

  /* ── Empty state: prompt centered vertically ── */
  if (!hasConversation) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-3xl">
          <PromptBox
            mode={mode}
            setMode={setMode}
            input={input}
            setInput={setInput}
            inputRef={inputRef}
            isSending={isSending}
            onSend={handleSend}
          />

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.personalizationKey}
                type="button"
                onClick={() => {
                  setInput(suggestion.label);
                  inputRef.current?.focus();
                }}
                className="group flex items-center gap-2.5 rounded-lg border border-black/[0.04] bg-white px-3 py-2 text-left transition-all duration-150 hover:border-black/10 hover:bg-black/[0.005] hover:shadow-[0_2px_8px_rgba(0,0,0,0.015)] active:scale-[0.99]"
              >
                <div className="shrink-0 flex items-center justify-center rounded-md bg-black/[0.02] p-1.5 transition group-hover:bg-black/[0.04]">
                  {suggestion.svg}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-secondary leading-normal group-hover:text-text-primary">
                    {suggestion.label}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {notice && <p className="mt-3 text-xs font-medium text-text-secondary">{notice}</p>}
        </div>
      </div>
    );
  }

  /* ── Conversation state: messages above, prompt pinned to bottom ── */
  return (
    <div className="flex min-h-full flex-col">
      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-end">
            <button
              type="button"
              onClick={resetHome}
              className="flex items-center gap-1.5 rounded-lg border border-black/[0.06] bg-white px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
            >
              <RefreshCcw size={13} />
              New
            </button>
          </div>

          <ConversationPanel messages={messages ?? []} />

          {taskParam && workRuns === undefined && (
            <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Loader2 size={15} className="animate-spin text-text-muted" />
                <p className="text-sm font-medium text-text-secondary">Preparing task progress</p>
              </div>
            </div>
          )}

          {taskParam && workRuns && workRuns.length > 0 && (
            <WorkRunPanel runs={workRuns} />
          )}

          {overview && overview.approvals.length > 0 && (
            <section className="mt-5 rounded-lg border border-amber-500/20 bg-amber-50/70 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={17} className="mt-0.5 text-warning" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-text-primary">Review needed</h2>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    FounderOS is waiting before a publishing, deployment, deletion, spending, or outreach step.
                  </p>
                  <div className="mt-3 space-y-2">
                    {overview.approvals.map((approval) => (
                      <div key={approval._id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-primary">
                            {approval.actionTitle ?? "Approval request"}
                          </p>
                          {approval.actionDescription && (
                            <p className="mt-0.5 text-[11px] leading-4 text-text-muted">
                              {approval.actionDescription}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void approve({ approvalId: approval._id })}
                            className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void deny({ approvalId: approval._id })}
                            className="rounded-lg border border-black/[0.1] px-3 py-1.5 text-xs font-semibold text-text-secondary"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pinned prompt at bottom */}
      <div className="shrink-0 border-t border-black/[0.04] bg-surface/80 px-4 pb-4 pt-3 backdrop-blur-md sm:px-8">
        <div className="mx-auto max-w-3xl">
          <PromptBox
            mode={mode}
            setMode={setMode}
            input={input}
            setInput={setInput}
            inputRef={inputRef}
            isSending={isSending}
            onSend={handleSend}
          />
          {notice && <p className="mt-2 text-xs font-medium text-text-secondary">{notice}</p>}
        </div>
      </div>
    </div>
  );
}

/* ── Prompt Box (reusable between centered + bottom layouts) ── */
function PromptBox({
  mode,
  setMode,
  input,
  setInput,
  inputRef,
  isSending,
  onSend,
}: {
  mode: PromptMode;
  setMode: (mode: PromptMode) => void;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isSending: boolean;
  onSend: () => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

  return (
    <div className={`rounded-2xl bg-white shadow-[0_16px_60px_rgba(0,0,0,0.08)] transition-all duration-300 ${mode === "chat" ? "prompt-glow-chat" : "prompt-glow-task"}`}>
      <div className="px-4 pb-3.5 pt-4">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={
            mode === "chat"
              ? "Ask anything..."
              : "Describe the work to create..."
          }
          rows={1}
          disabled={isSending}
          className="max-h-[180px] min-h-[48px] w-full resize-none bg-transparent text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted/70 disabled:opacity-60"
        />

        <div className="flex items-center justify-between gap-3 pt-2">
          {/* Bottom left dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              disabled={isSending}
              className="flex items-center gap-1.5 rounded-lg border border-black/[0.06] bg-white px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-black/[0.02] active:scale-[0.98] transition-all"
            >
              {mode === "chat" ? (
                <>
                  <MessageSquare size={13} className="text-indigo-500" />
                  <span>Chat</span>
                </>
              ) : (
                <>
                  <ListTodo size={13} className="text-purple-500" />
                  <span>Task</span>
                </>
              )}
              <ChevronDown size={12} className="text-text-muted ml-0.5" />
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute bottom-full left-0 mb-1.5 z-50 w-36 rounded-xl border border-black/[0.06] bg-white p-1 shadow-[0_10px_30px_rgba(0,0,0,0.08)] animate-slide-up">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("chat");
                      setIsDropdownOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                      mode === "chat"
                        ? "bg-black/[0.03] text-text-primary"
                        : "text-text-secondary hover:bg-black/[0.015] hover:text-text-primary"
                    }`}
                  >
                    <MessageSquare size={13} className="text-indigo-500" />
                    <span>Chat mode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("task");
                      setIsDropdownOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                      mode === "task"
                        ? "bg-black/[0.03] text-text-primary"
                        : "text-text-secondary hover:bg-black/[0.015] hover:text-text-primary"
                    }`}
                  >
                    <ListTodo size={13} className="text-purple-500" />
                    <span>Task mode</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleListening}
              disabled={isSending}
              aria-label={isListening ? "Stop listening" : "Start listening"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 ${
                isListening
                  ? "bg-red-500 border-red-500 text-white animate-pulse"
                  : "border-black/[0.06] bg-white text-text-secondary hover:text-text-primary hover:bg-black/[0.02]"
              }`}
            >
              <Mic size={16} />
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={!input.trim() || isSending}
              aria-label={mode === "chat" ? "Send message" : "Start task"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-25"
            >
              {isSending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={17} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-white px-4 py-3 shadow-sm">
        <Loader2 size={16} className="animate-spin text-text-muted" />
        <span className="text-sm font-medium text-text-secondary">Preparing your workspace</span>
      </div>
    </div>
  );
}

function ConversationPanel({ messages }: { messages: Message[] }) {
  // Sort chronologically — oldest at top, newest at bottom (like ChatGPT)
  const sorted = useMemo(
    () => [...messages].sort((a, b) => a._creationTime - b._creationTime),
    [messages],
  );

  return (
    <div className="space-y-4">
      {sorted.map((message) => {
        const isUser = message.role === "user";

        return (
          <div key={message._id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} animate-slide-up`}>
            {!isUser && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white text-xs font-semibold text-text-primary">
                {(message.agentName ?? "F").slice(0, 1)}
              </div>
            )}
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                isUser
                  ? "bg-black text-white"
                  : "border border-black/[0.06] bg-white text-text-primary"
              }`}
            >
              {!isUser && (
                <p className="mb-1 text-[11px] font-semibold text-text-muted">
                  {message.agentName ?? "FounderOS"}
                </p>
              )}
              <div className="whitespace-pre-wrap">{cleanDisplayText(message.content)}</div>
            </div>
            {isUser && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-text-muted">
                <UserRound size={15} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function runStatusLabel(status: string) {
  switch (status) {
    case "queued": return "Preparing";
    case "working": return "In progress";
    case "needs_review": return "Ready for review";
    case "waiting_for_approval": return "Waiting for approval";
    case "completed": return "Done";
    case "failed": return "Could not finish";
    case "stopped": return "Stopped";
    default: return status;
  }
}

function runStatusClasses(status: string) {
  switch (status) {
    case "queued": return "bg-gray-100 text-gray-600";
    case "working": return "bg-blue-50 text-blue-600";
    case "needs_review":
    case "waiting_for_approval": return "bg-amber-50 text-amber-600";
    case "completed": return "bg-green-50 text-green-600";
    case "failed": return "bg-red-50 text-red-600";
    case "stopped": return "bg-gray-100 text-gray-500";
    default: return "bg-gray-100 text-gray-600";
  }
}

function updateDotClass(tone: string) {
  switch (tone) {
    case "progress": return "bg-blue-400";
    case "review":
    case "blocked": return "bg-amber-400";
    case "complete": return "bg-green-400";
    case "error": return "bg-red-400";
    default: return "bg-gray-300";
  }
}

function WorkRunPanel({ runs }: { runs: WorkRun[] }) {
  return (
    <div className="mt-4 space-y-3">
      {runs.map((run) => {
        const recentUpdates = run.updates.slice(-5);

        return (
          <div
            key={run._id}
            className="rounded-xl border border-black/[0.06] bg-gradient-to-b from-white to-slate-50/50 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.03]">
                {run.status === "working" ? (
                  <Loader2 size={14} className="text-blue-500 animate-spin" />
                ) : run.status === "completed" ? (
                  <CheckCircle2 size={14} className="text-green-500" />
                ) : run.status === "failed" ? (
                  <AlertCircle size={14} className="text-red-500" />
                ) : (
                  <Clock size={14} className="text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">{run.title}</p>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${runStatusClasses(run.status)}`}
                  >
                    {runStatusLabel(run.status)}
                  </span>
                </div>
                {run.summary && (
                  <p className="mt-1 text-xs leading-5 text-text-secondary">{run.summary}</p>
                )}
              </div>
            </div>

            {recentUpdates.length > 0 && (
              <div className="ml-10 mt-3 space-y-1.5">
                {recentUpdates.map((update) => (
                  <div key={update._id} className="flex items-start gap-2">
                    <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${updateDotClass(update.tone)}`} />
                    <p className="text-xs leading-5 text-text-secondary">{update.message}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="ml-10 mt-3 flex flex-wrap items-center gap-2">
              {run.previewUrl && (
                <a
                  href={run.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-black/[0.02]"
                >
                  <ExternalLink size={13} />
                  Open preview
                </a>
              )}
              {run.status === "waiting_for_approval" && (
                <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                  Waiting for your approval before continuing.
                </p>
              )}
              {run.status === "needs_review" && (
                <p className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                  Ready for your review.
                </p>
              )}
              {run.status === "failed" && (
                <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                  FounderOS could not finish this step yet.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
