"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GlobalSearchResults, type GlobalSearchData } from "@/components/search/GlobalSearchResults";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  ListTodo,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCcw,
  UserRound,
} from "lucide-react";

type PromptMode = "chat" | "task";

type ChatMessageCard = {
  type: "task_result" | "item_navigation";
  title: string;
  summary?: string;
  href?: string;
  label?: string;
  itemId?: Id<"items">;
  documentId?: Id<"documents">;
  runId?: Id<"workRuns">;
  directiveId?: Id<"directives">;
};

type Message = {
  _id: Id<"chatMessages">;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  card?: ChatMessageCard;
  _creationTime: number;
};

type ChatActivity = {
  status: "queued" | "working";
  safeProgress: string;
  directiveId?: Id<"directives">;
  runId?: Id<"workRuns">;
  updatedAt: number;
};

type WorkRun = {
  _id: Id<"workRuns">;
  title: string;
  kind?: string;
  status: string;
  summary?: string;
  previewUrl?: string;
  outputItemId?: Id<"items">;
  failureReason?: string;
  artifacts?: Array<{
    _id: Id<"workArtifacts">;
    title: string;
    summary?: string;
    url?: string;
    libraryItemId?: Id<"items">;
    libraryDocumentId?: Id<"documents">;
  }>;
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
    .replace(/\b(?:OpenCode|Codex|DeepSeek|OpenRouter|Z\.ai|ZAI|GLM|GPT|Claude|Gemini|Mistral|Llama)\b[-\w./]*/gi, "FounderOS")
    .replace(/\bzai-coding-plan\/[a-z0-9._-]+/gi, "FounderOS")
    .replace(/\bprovider(s)?\b|\bmodel(s)?\b|\bagent(s)?\b/gi, "setting$1")
    .replace(/\blogs?\b/gi, "updates")
    .replace(/\btool calls?\b|\btool invocations?\b/gi, "steps")
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

function approvalActionLabel(kind?: string) {
  switch (kind) {
    case "send_email":
      return "Send email";
    case "publish_preview":
      return "Publish preview";
    case "post_externally":
      return "Post externally";
    case "spend_money":
      return "Spend money";
    case "delete_data":
      return "Delete data";
    case "change_live_asset":
      return "Change live asset";
    default:
      return "Sensitive action";
  }
}

function titleFromPrompt(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (!normalized) return "New task";
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

function useStableDefined<T>(value: T | undefined) {
  const [stableValue, setStableValue] = useState<T | undefined>(value);

  useEffect(() => {
    if (value !== undefined) queueMicrotask(() => setStableValue(value));
  }, [value]);

  return value ?? stableValue;
}

const GREETING_CACHE_KEY = "founderos:greeting";
const GREETING_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_GREETING = "What are you working on today?";
let greetingRequest: Promise<string> | null = null;

function readCachedGreeting() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.sessionStorage.getItem(GREETING_CACHE_KEY);
    if (!raw) return "";
    const cached = JSON.parse(raw) as { greeting?: unknown; savedAt?: unknown };
    if (typeof cached.greeting !== "string" || typeof cached.savedAt !== "number") return "";
    if (Date.now() - cached.savedAt > GREETING_CACHE_TTL_MS) return "";
    return cached.greeting;
  } catch {
    return "";
  }
}

function cacheGreeting(greeting: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      GREETING_CACHE_KEY,
      JSON.stringify({ greeting, savedAt: Date.now() }),
    );
  } catch {
    // Ignore storage failures; the greeting can fall back safely.
  }
}

async function loadGreeting() {
  const cached = readCachedGreeting();
  if (cached) return cached;
  if (!greetingRequest) {
    greetingRequest = fetch("/api/greeting")
      .then((res) => res.json())
      .then((data: { greeting?: string }) => data.greeting || DEFAULT_GREETING)
      .catch(() => DEFAULT_GREETING)
      .then((text) => {
        cacheGreeting(text);
        return text;
      })
      .finally(() => {
        greetingRequest = null;
      });
  }
  return greetingRequest;
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

  const liveOverview = useQuery(api.commandCenter.getOverview);
  const overview = useStableDefined(liveOverview);
  const liveIsSeeded = useQuery(api.init.isSeeded);
  const isSeeded = useStableDefined(liveIsSeeded);
  const liveAgents = useQuery(api.swarm.getAllAgents);
  const agents = useStableDefined(liveAgents);
  const messages = useQuery(
    api.chat.getMessages,
    sessionParam ? { sessionId: sessionParam } : "skip",
  ) as Message[] | undefined;
  const chatActivity = useQuery(
    api.chat.getSessionActivity,
    sessionParam ? { sessionId: sessionParam } : "skip",
  ) as ChatActivity | null | undefined;

  const workRuns = useQuery(
    api.workRuns.getRunsAndUpdates,
    taskParam ? { directiveId: taskParam } : "skip",
  ) as WorkRun[] | undefined;

  const createSession = useMutation(api.chat.createSession);
  const sendHomeMessage = useAction(api.chat.sendHomeMessage);
  const createTask = useMutation(api.directives.createDirective);
  const addClarification = useMutation(api.directives.addClarification);
  const approve = useMutation(api.approvals.approve);
  const deny = useMutation(api.approvals.deny);

  const [mode, setMode] = useState<PromptMode>("chat");
  const [input, setInput] = useState("");
  const [useRememberedDetails, setUseRememberedDetails] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const trimmedInput = input.trim();
  const searchPreview = useQuery(
    api.search.globalSearch,
    trimmedInput.length >= 2 ? { query: trimmedInput, limit: 12 } : "skip",
  ) as GlobalSearchData | undefined;

  const hasConversation = Boolean(sessionParam) || Boolean(taskParam && workRuns?.length);

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

  // ── Dynamic prompt suggestions (randomized on mount / mode switch) ──
  const [suggestionSeed, setSuggestionSeed] = useState(() => Date.now());
  useEffect(() => { setSuggestionSeed(Date.now()); }, [mode]);

  const suggestions = useMemo(() => {
    const chatPool = [
      "Help me decide what to focus on this week",
      "Turn these rough notes into a clear task",
      "Draft a message explaining a project delay",
      "Help me prioritize customer feedback",
      "Brainstorm names for a new product feature",
      "Summarize the key risks in my current plan",
      "Help me write a follow-up email after a meeting",
      "What questions should I ask in my next investor call?",
      "Help me simplify this complex idea into one sentence",
      "Give me a framework for making this decision",
      "What am I probably overlooking right now?",
      "Help me prepare talking points for a team standup",
      "Rewrite this paragraph to sound more confident",
      "What's a creative way to onboard new users?",
      "Help me think through pricing for this product",
    ];
    const taskPool = [
      "Create a client onboarding checklist",
      "Draft a one-page investor update",
      "Write a detailed product specification",
      "Prepare a meeting agenda for tomorrow",
      "Build a competitive analysis brief",
      "Write a post-mortem for last week's outage",
      "Create a 90-day roadmap outline",
      "Draft an internal announcement for a new hire",
      "Write a customer case study template",
      "Create a weekly metrics dashboard summary",
      "Outline a partnership proposal",
      "Draft release notes for the latest update",
      "Write an FAQ for a new feature launch",
      "Create a quarterly OKR template",
      "Build a vendor evaluation scorecard",
    ];

    const pool = mode === "chat" ? chatPool : taskPool;
    // Fisher-Yates shuffle with deterministic seed per render cycle
    const shuffled = [...pool];
    let seed = suggestionSeed;
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 16807 + 0) % 2147483647;
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 4);
  }, [mode, suggestionSeed]);

  // ── AI-generated greeting above the prompt box ──
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    let cancelled = false;
    const cached = readCachedGreeting();
    if (cached) {
      queueMicrotask(() => {
        if (!cancelled) setGreeting(cached);
      });
      return () => { cancelled = true; };
    }
    loadGreeting().then((text) => {
      if (!cancelled) setGreeting(text);
    });
    return () => { cancelled = true; };
  }, []);

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
        const result = await sendHomeMessage({
          sessionId,
          agentId: defaultWorker._id,
          content: trimmed,
          useMemory: useRememberedDetails,
        }) as { directiveId?: Id<"directives">; requiresWork?: boolean };
        if (result.requiresWork) {
          setNotice("Added to Work. I'll keep you posted on progress.");
        }
        router.replace(result.directiveId ? `/?session=${sessionId}&task=${result.directiveId}` : `/?session=${sessionId}`);
        return;
      }

      const directiveId = await createTask({
        title: titleFromPrompt(trimmed),
        objective: trimmed,
        sessionId,
        useMemory: useRememberedDetails,
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
    sendHomeMessage,
    useRememberedDetails,
  ]);

  const handleRequestChanges = useCallback(async (content: string) => {
    if (!taskParam) return;
    await addClarification({
      directiveId: taskParam,
      content,
      ...(sessionParam ? { sessionId: sessionParam } : {}),
    });
    setNotice("Changes requested. FounderOS will prepare a new review version.");
  }, [addClarification, sessionParam, taskParam]);

  const isLoading =
    overview === undefined ||
    isSeeded === undefined ||
    agents === undefined;

  if (isLoading) {
    return <HomeLoader />;
  }

  /* ── Empty state: prompt centered vertically ── */
  if (!hasConversation && !(taskParam && workRuns?.length)) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-3xl">
          <p className={`mb-8 -mt-12 text-center text-2xl font-normal tracking-tight text-text-secondary transition-opacity duration-500 ${greeting ? "opacity-100" : "opacity-0"}`}>
            {greeting || "\u00A0"}
          </p>

          <PromptBox
            mode={mode}
            setMode={setMode}
            input={input}
            setInput={setInput}
            inputRef={inputRef}
            isSending={isSending}
            onSend={handleSend}
            useRememberedDetails={useRememberedDetails}
            setUseRememberedDetails={setUseRememberedDetails}
          />

          {trimmedInput.length >= 2 && searchPreview ? (
            <div className="mt-3">
              <GlobalSearchResults data={searchPreview} compact maxPerGroup={2} />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestions.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setInput(label);
                    inputRef.current?.focus();
                  }}
                  className="group rounded-lg border border-black/[0.04] bg-white px-3 py-2 text-left transition-all duration-150 hover:border-black/10 hover:bg-black/[0.005] hover:shadow-[0_2px_8px_rgba(0,0,0,0.015)] active:scale-[0.99]"
                >
                  <p className="text-xs font-medium text-text-secondary leading-normal group-hover:text-text-primary">
                    {label}
                  </p>
                </button>
              ))}
            </div>
          )}

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

          {sessionParam && messages === undefined ? (
            <div className="rounded-xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Loader2 size={15} className="animate-spin text-text-muted" />
                <p className="text-sm font-medium text-text-secondary">Opening conversation</p>
              </div>
            </div>
          ) : (
            <ConversationPanel messages={messages ?? []} activity={chatActivity ?? null} />
          )}

          {taskParam && workRuns === undefined && (
            <div className="mt-4 rounded-xl border border-black/[0.06] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Loader2 size={15} className="animate-spin text-text-muted" />
                <p className="text-sm font-medium text-text-secondary">Preparing task progress</p>
              </div>
            </div>
          )}

          {taskParam && workRuns && workRuns.length > 0 && (
            <WorkRunPanel runs={workRuns} onRequestChanges={handleRequestChanges} />
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
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-warning">
                            {approvalActionLabel(approval.actionKind)}
                          </p>
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
            useRememberedDetails={useRememberedDetails}
            setUseRememberedDetails={setUseRememberedDetails}
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
  useRememberedDetails,
  setUseRememberedDetails,
}: {
  mode: PromptMode;
  setMode: (mode: PromptMode) => void;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isSending: boolean;
  onSend: () => void;
  useRememberedDetails: boolean;
  setUseRememberedDetails: (value: boolean) => void;
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
          <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              disabled={isSending}
              className="flex items-center gap-1.5 rounded-lg border border-black/[0.06] bg-white px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-black/[0.02] active:scale-[0.98] transition-all"
            >
              {mode === "chat" ? (
                <>
                  <MessageSquare size={13} className="text-zinc-500" />
                  <span>Chat</span>
                </>
              ) : (
                <>
                  <ListTodo size={13} className="text-zinc-900" />
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
                    <MessageSquare size={13} className="text-zinc-500" />
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
                    <ListTodo size={13} className="text-zinc-900" />
                    <span>Task mode</span>
                  </button>
                </div>
              </>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
            <input
              type="checkbox"
              checked={useRememberedDetails}
              onChange={(event) => setUseRememberedDetails(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-black/20"
            />
            Use remembered details
          </label>

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

function ConversationPanel({ messages, activity }: { messages: Message[]; activity: ChatActivity | null }) {
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
              <div className="whitespace-pre-wrap">{isUser ? message.content : cleanDisplayText(message.content)}</div>
              {!isUser && message.card && <MessageCard card={message.card} />}
            </div>
            {isUser && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-text-muted">
                <UserRound size={15} />
              </div>
            )}
          </div>
        );
      })}
      {activity && (
        <div className="flex gap-3 justify-start animate-slide-up">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white text-xs font-semibold text-text-primary">
            F
          </div>
          <div className="max-w-[82%] rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-sm leading-6 text-text-primary shadow-sm">
            <p className="mb-1 text-[11px] font-semibold text-text-muted">FounderOS</p>
            <div className="flex items-center gap-2 text-text-secondary">
              <Loader2 size={14} className="animate-spin" />
              <span>{cleanDisplayText(activity.safeProgress)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageCard({ card }: { card: ChatMessageCard }) {
  const href = card.href ?? (card.itemId ? `/library/${card.itemId}` : undefined);
  const icon =
    card.type === "item_navigation" ? (
      <FileText size={15} className="text-text-secondary" />
    ) : (
      <CheckCircle2 size={15} className="text-emerald-600" />
    );

  const body = (
    <div className="mt-3 rounded-lg border border-black/[0.06] bg-surface px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-text-primary">{cleanDisplayText(card.title)}</p>
          {card.summary && (
            <p className="mt-0.5 text-[11px] leading-4 text-text-secondary">
              {cleanDisplayText(card.summary)}
            </p>
          )}
          {href && (
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-text-primary">
              {card.label ?? "Open"}
              <ExternalLink size={11} />
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return href ? (
    <a href={href} className="block">
      {body}
    </a>
  ) : (
    body
  );
}

function runStatusLabel(status: string) {
  switch (status) {
    case "queued": return "Working";
    case "working": return "Working";
    case "needs_review": return "Ready to review";
    case "waiting_for_approval": return "Needs approval";
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

function WorkRunPanel({
  runs,
  onRequestChanges,
}: {
  runs: WorkRun[];
  onRequestChanges: (content: string) => Promise<void>;
}) {
  const [changeRequest, setChangeRequest] = useState("");
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const canRequestChanges = runs.some((run) =>
    ["needs_review", "completed", "waiting_for_approval"].includes(run.status),
  );

  const submitChanges = async () => {
    const clean = changeRequest.trim();
    if (!clean || isRequestingChanges) return;
    setIsRequestingChanges(true);
    try {
      await onRequestChanges(clean);
      setChangeRequest("");
    } finally {
      setIsRequestingChanges(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      {runs.map((run) => {
        const recentUpdates = run.updates.slice(-5);
        const waitingForBuilder = run.status === "queued" && run.kind === "code_preview";
        const libraryArtifact = run.artifacts?.find((artifact) => artifact.libraryItemId);
        const libraryHref = run.outputItemId
          ? `/library/${run.outputItemId}`
          : libraryArtifact?.libraryItemId
            ? `/library/${libraryArtifact.libraryItemId}`
            : undefined;

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
                  {waitingForBuilder ? "Working" : runStatusLabel(run.status)}
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

            {waitingForBuilder && (
              <div className="ml-10 mt-3 rounded-lg border border-amber-500/15 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                The product builder has not started on this computer yet. This work will move forward when the local builder is running.
              </div>
            )}

            {run.previewUrl && (
              <div className="ml-10 mt-3 overflow-hidden rounded-lg border border-black/[0.06] bg-white">
                <iframe
                  title={`${run.title} preview`}
                  src={run.previewUrl}
                  sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
                  className="h-[360px] w-full bg-white"
                />
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
              {libraryHref && (
                <a
                  href={libraryHref}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-black/[0.02]"
                >
                  <FileText size={13} />
                  Open Library item
                </a>
              )}
              {run.status === "waiting_for_approval" && (
                <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                  Needs approval.
                </p>
              )}
              {run.status === "needs_review" && (
                <p className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                  Ready to review.
                </p>
              )}
              {run.status === "failed" && (
                <p className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                  {run.failureReason ?? "FounderOS could not finish this step yet."}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {canRequestChanges && (
        <div className="rounded-xl border border-black/[0.06] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-text-primary">Ask for changes</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Tell FounderOS what to improve and it will prepare another review version.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <textarea
              value={changeRequest}
              onChange={(event) => setChangeRequest(event.target.value)}
              rows={2}
              placeholder="Make the booking form shorter and add a pricing section."
              className="min-h-16 flex-1 resize-none rounded-lg border border-black/[0.07] bg-surface px-3 py-2 text-sm leading-5 outline-none focus:border-black/20 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => void submitChanges()}
              disabled={!changeRequest.trim() || isRequestingChanges}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30 sm:self-end"
            >
              {isRequestingChanges ? <Loader2 size={15} className="animate-spin" /> : "Request changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
