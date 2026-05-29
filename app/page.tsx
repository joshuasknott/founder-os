"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  Library,
  ListTodo,
  Loader2,
  MessageSquare,
  PauseCircle,
  RefreshCcw,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type PromptMode = "chat" | "task";

type Worker = {
  _id: Id<"agents">;
  name: string;
  role: string;
  avatar: string;
};

type WorkTask = {
  _id: Id<"tasks">;
  title: string;
  description: string;
  assignedAgentId: Id<"agents">;
  status: string;
};

type WorkItem = {
  _id: Id<"directives">;
  title: string;
  objective: string;
  status: string;
  sessionId?: Id<"chatSessions">;
  taskCount: number;
  completedTaskCount: number;
};

type Message = {
  _id: Id<"chatMessages">;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  _creationTime: number;
};

type LibraryOutput = {
  _id: Id<"documents">;
  title: string;
  summary?: string;
  kind?: string;
  versionCount: number;
  updatedAt: number;
};

const suggestionBase: Array<{
  mode: PromptMode;
  label: string;
  personalizationKey: string;
}> = [
  {
    mode: "chat",
    label: "Help me decide what to focus on this week",
    personalizationKey: "weekly_focus",
  },
  {
    mode: "chat",
    label: "Turn these rough notes into a clear task",
    personalizationKey: "shape_task",
  },
  {
    mode: "task",
    label: "Create a client onboarding checklist",
    personalizationKey: "client_onboarding",
  },
  {
    mode: "task",
    label: "Draft a one-page investor update",
    personalizationKey: "investor_update",
  },
];

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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_spec: "Preparing",
    needs_clarification: "Needs your answer",
    custom_fallback: "Needs review",
    awaiting_approval: "Waiting for review",
    in_progress: "In progress",
    blocked: "Paused",
    aborted_by_principal: "Stopped",
    completed: "Completed",
    queued: "Queued",
    shadow_pending: "Waiting for review",
    failed: "Needs attention",
  };

  return labels[status] ?? status.replace(/_/g, " ");
}

function progressFor(work: WorkItem, tasks?: WorkTask[]) {
  if (work.status === "completed") return 100;
  const total = tasks?.length ?? work.taskCount;
  const done = tasks?.filter((task) => task.status === "completed").length ?? work.completedTaskCount;
  if (total > 0) return Math.max(8, Math.round((done / total) * 100));
  if (work.status === "in_progress") return 24;
  if (work.status === "needs_clarification") return 12;
  return 8;
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

  const seedWorkspace = useMutation(api.init.seedSwarm);
  const createSession = useMutation(api.chat.createSession);
  const sendMessage = useAction(api.chat.sendMessage);
  const createTask = useMutation(api.directives.createDirective);
  const addClarification = useMutation(api.directives.addClarification);
  const approve = useMutation(api.approvals.approve);
  const deny = useMutation(api.approvals.deny);

  const [mode, setMode] = useState<PromptMode>("chat");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<Id<"directives"> | null>(taskParam);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isSeeded === false) {
      seedWorkspace().catch(() => setNotice("FounderOS could not prepare the workspace yet."));
    }
  }, [isSeeded, seedWorkspace]);

  useEffect(() => {
    if (taskParam) {
      setCurrentTaskId(taskParam);
    } else if (!sessionParam) {
      setCurrentTaskId(null);
      setMode("chat");
      setNotice(null);
    }
  }, [taskParam, sessionParam]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
  }, [input]);

  const defaultWorker = useMemo(() => {
    if (!agents?.length) return null;
    return agents.find((agent) => agent.name === "Orion") ?? agents[0];
  }, [agents]);

  const activeWork = useMemo<WorkItem | null>(() => {
    if (!overview?.recentWork.length) return null;
    const preferredId = currentTaskId ?? taskParam;
    const preferred = preferredId
      ? overview.recentWork.find((work) => work._id === preferredId)
      : null;
    if (preferred) return preferred;

    return (
      overview.recentWork.find((work) =>
        ["pending_spec", "needs_clarification", "awaiting_approval", "in_progress", "blocked"].includes(
          work.status,
        ),
      ) ?? null
    );
  }, [currentTaskId, overview?.recentWork, taskParam]);

  const activeTasks = useQuery(
    api.directives.getTasksByDirective,
    activeWork ? { directiveId: activeWork._id } : "skip",
  ) as WorkTask[] | undefined;

  const taskOutputs = useQuery(
    api.artifacts.listByTrace,
    activeWork ? { directiveId: activeWork._id } : "skip",
  ) as LibraryOutput[] | undefined;

  const suggestions = useMemo(() => {
    const hasLibraryItems = (overview?.stats.artifacts ?? 0) > 0;
    if (!hasLibraryItems) return suggestionBase;

    return [
      {
        mode: "chat" as const,
        label: "Help me find the strongest next task from Library",
        personalizationKey: "library_next_task",
      },
      {
        mode: "task" as const,
        label: "Summarize recent Library work into a founder brief",
        personalizationKey: "library_brief",
      },
      ...suggestionBase.slice(0, 2),
    ];
  }, [overview?.stats.artifacts]);

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
    setCurrentTaskId(null);
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

      const clarificationTarget =
        activeWork?.status === "needs_clarification" ? activeWork : null;
      const directiveId = clarificationTarget
        ? await addClarification({
            directiveId: clarificationTarget._id,
            content: trimmed,
            sessionId,
          })
        : await createTask({
            title: titleFromPrompt(trimmed),
            objective: trimmed,
            sessionId,
          });

      setCurrentTaskId(directiveId);
      setMode("chat");
      setNotice(
        clarificationTarget
          ? "Answer added. FounderOS will continue this task in the same conversation."
          : "Task created. Updates will stay in this conversation.",
      );
      router.replace(`/?session=${sessionId}&task=${directiveId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Try again in a moment.";
      setInput(trimmed);
      setNotice(message);
    } finally {
      setIsSending(false);
    }
  }, [
    activeWork,
    addClarification,
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

  return (
    <div className="min-h-full px-4 py-6 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col">
        <section className={`mx-auto w-full max-w-3xl ${messages?.length || activeWork ? "pt-4" : "pt-[16vh]"}`}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-text-muted">
              {overview?.workspace?.name ?? "FounderOS"}
            </p>
            <button
              type="button"
              onClick={resetHome}
              className="flex items-center gap-1.5 rounded-lg border border-black/[0.06] bg-white px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
            >
              <RefreshCcw size={13} />
              New
            </button>
          </div>

          <div className="rounded-2xl border border-black/[0.08] bg-white shadow-[0_16px_60px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] px-4 py-3">
              <div className="flex rounded-lg bg-surface p-1">
                <ModeButton icon={MessageSquare} label="Chat" mode="chat" activeMode={mode} setMode={setMode} />
                <ModeButton icon={ListTodo} label="Task" mode="task" activeMode={mode} setMode={setMode} />
              </div>
              <div className="hidden items-center gap-2 text-xs text-text-muted sm:flex">
                <Sparkles size={14} />
                <span>{mode === "chat" ? "Think and plan" : "Create visible work"}</span>
              </div>
            </div>

            <div className="px-4 pb-3 pt-4">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={
                  mode === "chat"
                    ? "Ask FounderOS to think through a decision, shape a plan, or understand your business context..."
                    : activeWork?.status === "needs_clarification"
                      ? "Answer the question FounderOS needs to continue this task..."
                      : "Describe the work to create: a document, website, presentation, internal tool, schedule, or summary..."
                }
                rows={1}
                disabled={isSending}
                className="max-h-[180px] min-h-20 w-full resize-none bg-transparent text-base leading-7 text-text-primary outline-none placeholder:text-text-muted/70 disabled:opacity-60"
              />

              <div className="flex items-end justify-between gap-3 border-t border-black/[0.04] pt-3">
                <p className="min-w-0 text-xs leading-5 text-text-muted">
                  {mode === "chat"
                    ? "Chat helps you think and plan. It does not create business outputs."
                    : "Task creates a work item and saves finished outputs in Library."}
                </p>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || isSending}
                  aria-label={mode === "chat" ? "Send message" : "Start task"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-25"
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={17} />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.personalizationKey}
                type="button"
                onClick={() => {
                  setMode(suggestion.mode);
                  setInput(suggestion.label);
                  inputRef.current?.focus();
                }}
                className="rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-left text-xs font-medium text-text-secondary shadow-sm hover:border-black/15 hover:text-text-primary"
              >
                <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  {suggestion.mode}
                </span>
                {suggestion.label}
              </button>
            ))}
          </div>

          {notice && <p className="mt-3 text-xs font-medium text-text-secondary">{notice}</p>}
        </section>

        {messages && messages.length > 0 && (
          <ConversationPanel messages={messages} />
        )}

        {activeWork ? (
          <WorkItemPanel
            work={activeWork}
            tasks={activeTasks}
            workers={(agents ?? []) as Worker[]}
            outputs={taskOutputs}
          />
        ) : (
          <QuietEmptyState />
        )}

        {overview && overview.approvals.length > 0 && (
          <section className="mx-auto mt-5 w-full max-w-3xl rounded-lg border border-amber-500/20 bg-amber-50/70 p-4">
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
                      <span className="text-xs font-medium text-text-secondary">Approval request</span>
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

function ModeButton({
  icon: Icon,
  label,
  mode,
  activeMode,
  setMode,
}: {
  icon: LucideIcon;
  label: string;
  mode: PromptMode;
  activeMode: PromptMode;
  setMode: (mode: PromptMode) => void;
}) {
  const active = activeMode === mode;

  return (
    <button
      type="button"
      onClick={() => setMode(mode)}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-white text-text-primary shadow-sm"
          : "text-text-muted hover:text-text-primary"
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function ConversationPanel({ messages }: { messages: Message[] }) {
  return (
    <section className="mx-auto mt-8 w-full max-w-3xl space-y-4">
      {messages.map((message) => {
        const isUser = message.role === "user";

        return (
          <div key={message._id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
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
    </section>
  );
}

function WorkItemPanel({
  work,
  tasks,
  workers,
  outputs,
}: {
  work: WorkItem;
  tasks: WorkTask[] | undefined;
  workers: Worker[];
  outputs: LibraryOutput[] | undefined;
}) {
  const workerById = useMemo(
    () => new Map(workers.map((worker) => [worker._id, worker])),
    [workers],
  );
  const percent = progressFor(work, tasks);
  const visibleTasks = tasks ?? [];

  return (
    <section className="mx-auto mt-8 w-full max-w-3xl rounded-xl border border-black/[0.06] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ListTodo size={16} className="text-text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Current task</p>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
            {cleanDisplayText(work.title)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            {cleanDisplayText(work.objective)}
          </p>
        </div>
        <span className="w-fit rounded-lg border border-black/[0.07] bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary">
          {statusLabel(work.status)}
        </span>
      </div>

      <div className="mt-5">
        <div className="h-2 rounded-lg bg-black/[0.06]">
          <div className="h-2 rounded-lg bg-black" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {work.status === "completed"
            ? "Finished and recorded in the workspace."
            : `${Math.min(percent, 99)}% prepared`}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {visibleTasks.length === 0 ? (
          <WorkerStep
            title="Preparing the plan"
            status={work.status}
            worker={{ name: "Orion", role: "Chief of Staff", avatar: "O" }}
          />
        ) : (
          visibleTasks.map((task) => {
            const worker = workerById.get(task.assignedAgentId);
            return (
              <WorkerStep
                key={task._id}
                title={task.title}
                status={task.status}
                worker={{
                  name: worker?.name ?? "FounderOS",
                  role: worker?.role ?? "AI worker",
                  avatar: worker?.avatar ?? "F",
                }}
              />
            );
          })
        )}
      </div>

      {outputs && outputs.length > 0 && (
        <div className="mt-5 border-t border-black/[0.06] pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Library size={15} className="text-text-primary" />
            <h3 className="text-sm font-semibold text-text-primary">Saved outputs</h3>
          </div>
          <div className="grid gap-2">
            {outputs.map((output) => (
              <Link
                key={output._id}
                href={`/library?item=${output._id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.06] px-3 py-2 hover:border-black/15"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {cleanDisplayText(output.title)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {cleanDisplayText(output.summary ?? "Ready in Library")}
                  </p>
                </div>
                <FileText size={15} className="shrink-0 text-text-muted" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function WorkerStep({
  title,
  status,
  worker,
}: {
  title: string;
  status: string;
  worker: { name: string; role: string; avatar: string };
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-surface px-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-semibold text-text-primary shadow-sm">
        {worker.avatar}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{cleanDisplayText(title)}</p>
        <p className="mt-0.5 truncate text-xs text-text-muted">
          {worker.name} - {worker.role}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-text-secondary">
        <TaskStatusIcon status={status} />
        {statusLabel(status)}
      </div>
    </div>
  );
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 size={13} />;
  if (status === "in_progress") return <Loader2 size={13} className="animate-spin" />;
  if (status === "blocked" || status === "failed") return <AlertTriangle size={13} />;
  if (status === "shadow_pending") return <PauseCircle size={13} />;
  return <Circle size={13} />;
}

function QuietEmptyState() {
  return (
    <section className="mx-auto mt-8 w-full max-w-3xl rounded-lg border border-dashed border-black/[0.08] bg-white/60 p-5 text-center">
      <Clock3 size={18} className="mx-auto text-text-muted" />
      <p className="mt-3 text-sm font-semibold text-text-primary">No active task</p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">
        Chats and tasks you start here will appear in the sidebar.
      </p>
    </section>
  );
}
