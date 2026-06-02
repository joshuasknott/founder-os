"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  FilePlus2,
  Loader2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

type WorkStatus =
  | "queued"
  | "working"
  | "needs review"
  | "needs approval"
  | "done"
  | "failed";

type WorkItem = {
  id: Id<"workRuns">;
  taskId: Id<"directives">;
  sessionId?: Id<"chatSessions">;
  title: string;
  kind?: string;
  objective?: string;
  summary?: string;
  latestUpdate?: string;
  status: WorkStatus;
  statusLabel: string;
  previewUrl?: string;
  libraryItemId?: Id<"items">;
  libraryHref?: string;
  createdAt: number;
  updatedAt: number;
  approval: {
    id: Id<"approvalQueue">;
    actionKind?: string;
    title?: string;
    description?: string;
  } | null;
};

type WorkPageData = {
  active: WorkItem[];
  readyForReview: WorkItem[];
  pendingApprovals: WorkItem[];
  completed: WorkItem[];
};

const documentTypes = ["Memo", "Brief", "Plan", "SOP", "Email draft", "Proposal", "Strategy document"];

function cleanDisplayText(value?: string) {
  if (!value) return "";

  return value
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\*\*?Autonomy Level\s*\d+\s*(?:[-\u2013\u2014]\s*[^*]+)?\*\*?/gi, "")
    .replace(/\bAutonomy Level\s*\d+\s*(?:[-\u2013\u2014]\s*[A-Za-z ]+)?/gi, "")
    .replace(/\bRAG\b|\bAI Router\b|\bTOOL_INVOCATION\b/gi, "")
    .replace(/\b(?:OpenCode|Codex|DeepSeek|OpenRouter|Z\.ai|ZAI|GLM|GPT|Claude|Gemini|Mistral|Llama)\b[-\w./]*/gi, "FounderOS")
    .replace(/\bzai-coding-plan\/[a-z0-9._-]+/gi, "FounderOS")
    .replace(/\bwork\s*runs?\b|\bworkRuns\b/gi, "work")
    .replace(/\bdirectives?\b/gi, "tasks")
    .replace(/\bconnectors?\b/gi, "connections")
    .replace(/\blogs?\b/gi, "updates")
    .replace(/\btool calls?\b|\btool invocations?\b/gi, "steps")
    .replace(/\bprovider(s)?\b|\bmodel(?: names?)?s?\b|\bagent(s)?\b/gi, "setting$1")
    .replace(/\b(gpt|o|claude|gemini|llama|mistral)[-\w.]*\b/gi, "AI")
    .replace(/\bbranch(?: name)?\s*[:=]\s*[\w./-]+/gi, "workspace version")
    .replace(/\bbranch\b/gi, "workspace version")
    .replace(/\bcommit\b/gi, "version")
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/\ban Library item\b/gi, "a Library item")
    .replace(/\ban Library items\b/gi, "Library items")
    .replace(/\boperator(s)?\b/gi, "worker$1")
    .replace(/\brouting\b/gi, "planning")
    .replace(/\bcommand center\b/gi, "workspace")
    .replace(/#{1,6}\s*/g, "")
    .replace(/---+/g, "")
    .replace(/\*{2,}/g, "")
    .replace(/`+/g, "")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function statusClasses(status: WorkStatus) {
  switch (status) {
    case "queued":
      return "bg-zinc-100 text-zinc-600";
    case "working":
      return "bg-blue-50 text-blue-700";
    case "needs review":
      return "bg-emerald-50 text-emerald-700";
    case "needs approval":
      return "bg-amber-50 text-amber-700";
    case "done":
      return "bg-green-50 text-green-700";
    case "failed":
      return "bg-red-50 text-red-700";
  }
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

function approvalRiskText(kind?: string) {
  switch (kind) {
    case "send_email":
      return "This will contact someone outside your workspace.";
    case "publish_preview":
      return "This will make a preview or draft visible outside your private workspace.";
    case "post_externally":
      return "This will publish content to an external channel.";
    case "spend_money":
      return "This may create a charge or commit budget.";
    case "delete_data":
      return "This can remove business data.";
    case "change_live_asset":
      return "This will change something already live.";
    default:
      return "FounderOS will pause until you decide.";
  }
}

function StatusIcon({ status }: { status: WorkStatus }) {
  if (status === "done" || status === "needs review") {
    return <CheckCircle2 size={15} className="text-emerald-600" />;
  }
  if (status === "needs approval") {
    return <PauseCircle size={15} className="text-amber-600" />;
  }
  if (status === "failed") {
    return <AlertCircle size={15} className="text-red-600" />;
  }
  if (status === "working") {
    return <PlayCircle size={15} className="text-blue-600" />;
  }
  return <Clock3 size={15} className="text-text-muted" />;
}

function hrefForItem(item: WorkItem) {
  return item.sessionId
    ? `/?session=${item.sessionId}&task=${item.taskId}`
    : `/?task=${item.taskId}`;
}

export default function WorkPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <WorkPageContent />
    </Suspense>
  );
}

function WorkPageContent() {
  const data = useQuery(api.workRuns.getWorkPage) as WorkPageData | undefined;
  const approve = useMutation(api.approvals.approve);
  const deny = useMutation(api.approvals.deny);
  const createTask = useMutation(api.directives.createDirective);
  const [notice, setNotice] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState("Memo");
  const [documentRequest, setDocumentRequest] = useState("");
  const [isRequestingDocument, setIsRequestingDocument] = useState(false);

  const totals = useMemo(() => {
    if (!data) return null;
    return {
      active: data.active.length,
      readyForReview: data.readyForReview.length,
      pendingApprovals: data.pendingApprovals.length,
      completed: data.completed.length,
    };
  }, [data]);

  if (!data || !totals) return <PageLoader />;

  const handleApprove = async (approvalId: Id<"approvalQueue">) => {
    await approve({ approvalId });
    setNotice("Approved. Work will continue.");
  };

  const handleDecline = async (approvalId: Id<"approvalQueue">) => {
    await deny({ approvalId });
    setNotice("Declined. The item is back for review.");
  };

  const requestDocument = async () => {
    const details = documentRequest.trim();
    if (!details || isRequestingDocument) return;
    setIsRequestingDocument(true);
    try {
      await createTask({
        title: `${documentType}: ${details}`.slice(0, 72),
        objective: `Create a ${documentType.toLowerCase()} for this request:\n\n${details}`,
      });
      setDocumentRequest("");
      setNotice("Document added to Work. FounderOS will save a review draft in Library.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "FounderOS could not add that document yet.");
    } finally {
      setIsRequestingDocument(false);
    }
  };

  return (
    <div className="min-h-full px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Work</h1>
            <p className="mt-1 text-sm text-text-secondary">
              A clear view of what is moving, waiting, ready, and done.
            </p>
          </div>
          {notice && <p className="text-xs font-medium text-text-secondary">{notice}</p>}
        </header>

        <section className="grid gap-2 sm:grid-cols-4">
          <SummaryStat label="Active" value={totals.active} />
          <SummaryStat label="Ready to review" value={totals.readyForReview} />
          <SummaryStat label="Needs approval" value={totals.pendingApprovals} />
          <SummaryStat label="Completed" value={totals.completed} />
        </section>

        <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <FilePlus2 size={16} />
            <h2 className="text-sm font-semibold text-text-primary">Request a document</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            FounderOS will prepare a private draft, save it to Library, and leave it ready for review.
          </p>
          <div className="mt-3 flex flex-col gap-2 lg:flex-row">
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="rounded-lg border border-black/[0.08] bg-surface px-3 py-2 text-sm font-medium outline-none focus:border-black/20"
            >
              {documentTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
            <input
              value={documentRequest}
              onChange={(event) => setDocumentRequest(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void requestDocument();
              }}
              placeholder="Describe the audience, goal, and any details to include."
              className="min-w-0 flex-1 rounded-lg border border-black/[0.08] bg-surface px-3 py-2 text-sm outline-none focus:border-black/20 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => void requestDocument()}
              disabled={!documentRequest.trim() || isRequestingDocument}
              className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isRequestingDocument ? <Loader2 size={15} className="animate-spin" /> : "Create draft"}
            </button>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-4">
          <WorkColumn title="Working" count={totals.active} items={data.active} />
          <WorkColumn title="Ready to review" count={totals.readyForReview} items={data.readyForReview} />
          <WorkColumn
            title="Needs approval"
            count={totals.pendingApprovals}
            items={data.pendingApprovals}
            onApprove={handleApprove}
            onDecline={handleDecline}
          />
          <WorkColumn title="Completed work" count={totals.completed} items={data.completed} />
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/[0.06] bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function WorkColumn({
  title,
  count,
  items,
  onApprove,
  onDecline,
}: {
  title: string;
  count: number;
  items: WorkItem[];
  onApprove?: (approvalId: Id<"approvalQueue">) => Promise<void>;
  onDecline?: (approvalId: Id<"approvalQueue">) => Promise<void>;
}) {
  return (
    <section className="min-h-80 overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/[0.05] px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <span className="text-xs text-text-muted">{count}</span>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
          <Clock3 size={18} className="text-text-muted" />
          <p className="mt-3 text-sm font-semibold text-text-primary">Nothing here</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            New work started from Home will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.05]">
          {items.map((item) => (
            <WorkRow
              key={item.id}
              item={item}
              onApprove={onApprove}
              onDecline={onDecline}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function WorkRow({
  item,
  onApprove,
  onDecline,
}: {
  item: WorkItem;
  onApprove?: (approvalId: Id<"approvalQueue">) => Promise<void>;
  onDecline?: (approvalId: Id<"approvalQueue">) => Promise<void>;
}) {
  const description =
    cleanDisplayText(item.approval?.description) ||
    cleanDisplayText(item.summary) ||
    cleanDisplayText(item.latestUpdate) ||
    cleanDisplayText(item.objective) ||
    "No update yet.";

  return (
    <article className="px-4 py-3 hover:bg-surface/60">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-surface">
          <StatusIcon status={item.status} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
              {cleanDisplayText(item.title)}
            </h3>
            <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold leading-none ${statusClasses(item.status)}`}>
              {item.statusLabel}
            </span>
          </div>
          {item.approval?.title && (
            <p className="mt-1 text-xs font-semibold text-text-secondary">
              {cleanDisplayText(item.approval.title)}
            </p>
          )}
          {item.approval ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-amber-700">
                  Needs approval
                </span>
                <span className="text-[11px] font-semibold text-text-primary">
                  {approvalActionLabel(item.approval.actionKind)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-secondary">{description}</p>
              <p className="mt-1 text-[11px] leading-4 text-text-muted">
                {approvalRiskText(item.approval.actionKind)}
              </p>
            </div>
          ) : (
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-text-secondary">{description}</p>
          )}
          <p className="mt-2 text-[11px] text-text-muted">Updated {formatTime(item.updatedAt)}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={hrefForItem(item)}
              className="rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
            >
              Open
            </Link>
            {item.previewUrl && (
              <a
                href={item.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
              >
                <ExternalLink size={13} />
                Open preview
              </a>
            )}
            {item.libraryHref && (
              <Link
                href={item.libraryHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
              >
                <FileText size={13} />
                Library
              </Link>
            )}
            {item.approval && onApprove && onDecline && (
              <>
                <button
                  type="button"
                  onClick={() => void onApprove(item.approval!.id)}
                  className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void onDecline(item.approval!.id)}
                  className="rounded-lg border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
                >
                  Decline
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 size={18} className="animate-spin text-text-muted" />
    </div>
  );
}
