"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  ArchiveRestore,
  ArrowLeft,
  FilePlus2,
  FileText,
  Globe2,
  History,
  Library,
  Loader2,
  MessageSquare,
  Presentation,
  Save,
  Search,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type LibrarySection =
  | "all"
  | "documents"
  | "websites"
  | "presentations"
  | "tools"
  | "history"
  | "conversations";

type DocumentKind =
  | "document"
  | "file"
  | "website"
  | "internal_tool"
  | "tool"
  | "presentation"
  | "task_output"
  | "conversation"
  | "record"
  | "brief"
  | "plan";

type LibraryDocument = Doc<"documents"> & {
  departmentName?: string;
  versionCount?: number;
  currentVersion?: {
    _id: Id<"documentVersions">;
    versionNumber?: number;
    createdAt?: number;
    createdBy?: string;
    summary?: string;
    contentPreview: string;
  } | null;
};

type WorkHistory = Doc<"directives"> & {
  taskCount?: number;
  completedTaskCount?: number;
};

type LibraryEntry =
  | {
      id: string;
      source: "document";
      section: Exclude<LibrarySection, "all" | "conversations">;
      title: string;
      summary: string;
      timestamp: number;
      href: string;
      record: LibraryDocument;
    }
  | {
      id: string;
      source: "conversation";
      section: "conversations";
      title: string;
      summary: string;
      timestamp: number;
      href: string;
      record: Doc<"chatSessions">;
    }
  | {
      id: string;
      source: "history";
      section: "history";
      title: string;
      summary: string;
      timestamp: number;
      href: string;
      record: WorkHistory;
    };

const typeTabs: Array<{ id: LibrarySection; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All", icon: Library },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "websites", label: "Websites", icon: Globe2 },
  { id: "presentations", label: "Presentations", icon: Presentation },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "history", label: "History", icon: History },
  { id: "conversations", label: "Conversations", icon: MessageSquare },
];

const legacySeedTitles = new Set([
  "Founder briefing",
  "Website preview request",
  "Launch messaging draft",
]);

function formatTime(timestamp?: number) {
  if (!timestamp) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function displayTitle(title: string) {
  return cleanDisplayText(title.replace(/^\[[^\]]+\]\s*/, ""));
}

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
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/\ban Library item\b/gi, "a Library item")
    .replace(/\ban Library items\b/gi, "Library items")
    .replace(/\boperator(s)?\b/gi, "worker$1")
    .replace(/\brouting\b/gi, "planning")
    .replace(/\bcommand center\b/gi, "workspace")
    .replace(/#{1,6}\s*/g, "")
    .replace(/---+/g, "")
    .replace(/\*{2,}/g, "")
    .replace(/,{2,}/g, ",")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

function sectionForKind(kind?: string, hasTrace?: boolean): Exclude<LibrarySection, "all" | "conversations"> {
  if (kind === "website") return "websites";
  if (kind === "presentation") return "presentations";
  if (kind === "internal_tool" || kind === "tool") return "tools";
  if (kind === "task_output" || kind === "conversation" || hasTrace) return "history";
  return "documents";
}

function sectionLabel(section: LibrarySection) {
  return typeTabs.find((tab) => tab.id === section)?.label ?? "Library";
}

function SectionIcon({ section, className }: { section: LibrarySection; className?: string }) {
  if (section === "documents") return <FileText size={16} className={className} />;
  if (section === "websites") return <Globe2 size={16} className={className} />;
  if (section === "presentations") return <Presentation size={16} className={className} />;
  if (section === "tools") return <Wrench size={16} className={className} />;
  if (section === "history") return <History size={16} className={className} />;
  if (section === "conversations") return <MessageSquare size={16} className={className} />;
  return <Library size={16} className={className} />;
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

function canStopTask(status: string) {
  return !["completed", "aborted_by_principal"].includes(status);
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LibraryPageContent />
    </Suspense>
  );
}

function LibraryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemParam = searchParams.get("item") as Id<"documents"> | null;

  const overview = useQuery(api.commandCenter.getOverview);
  const documents = useQuery(api.artifacts.list, {}) as LibraryDocument[] | undefined;
  const conversations = useQuery(api.chat.getSessions) as Doc<"chatSessions">[] | undefined;
  const createItem = useMutation(api.artifacts.create);
  const updateItem = useMutation(api.artifacts.update);
  const revertItem = useMutation(api.artifacts.revert);
  const deleteItem = useMutation(api.artifacts.remove);
  const deleteConversation = useMutation(api.chat.deleteSession);
  const stopTask = useMutation(api.directives.stopDirective);
  const deleteTask = useMutation(api.directives.deleteDirective);

  const [activeSection, setActiveSection] = useState<LibrarySection>("all");
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<DocumentKind>("document");
  const [newContent, setNewContent] = useState("");
  const [draftItemId, setDraftItemId] = useState<Id<"documents"> | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const visibleDocuments = useMemo(
    () =>
      documents?.filter(
        (item) =>
          item.kind !== "automation" &&
          !(
            item.author === "FounderOS" &&
            item.traceId === undefined &&
            legacySeedTitles.has(item.title)
          ),
      ),
    [documents],
  );

  const entries = useMemo<LibraryEntry[] | undefined>(() => {
    if (!visibleDocuments || !conversations || !overview) return undefined;

    const documentEntries: LibraryEntry[] = visibleDocuments.map((item) => {
      const section = sectionForKind(item.kind, Boolean(item.traceId));
      return {
        id: `document:${item._id}`,
        source: "document",
        section,
        title: displayTitle(item.title),
        summary: cleanDisplayText(item.summary ?? item.currentVersion?.summary ?? "Saved in Library."),
        timestamp: item.updatedAt ?? item._creationTime,
        href: `/library?item=${item._id}`,
        record: item,
      };
    });

    const conversationEntries: LibraryEntry[] = conversations.map((item) => ({
      id: `conversation:${item._id}`,
      source: "conversation",
      section: "conversations",
      title: displayTitle(item.title),
      summary: `Conversation updated ${formatTime(item.lastMessageAt)}`,
      timestamp: item.lastMessageAt,
      href: `/?session=${item._id}`,
      record: item,
    }));

    const historyEntries: LibraryEntry[] = (overview.recentWork as WorkHistory[]).map((item) => ({
      id: `history:${item._id}`,
      source: "history",
      section: "history",
      title: displayTitle(item.title),
      summary: `${statusLabel(item.status)} - ${cleanDisplayText(item.objective)}`,
      timestamp: item._creationTime,
      href: item.sessionId ? `/?session=${item.sessionId}&task=${item._id}` : `/?task=${item._id}`,
      record: item,
    }));

    return [...documentEntries, ...conversationEntries, ...historyEntries].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [conversations, overview, visibleDocuments]);

  const filteredEntries = useMemo(() => {
    if (!entries) return undefined;
    return activeSection === "all"
      ? entries
      : entries.filter((entry) => entry.section === activeSection);
  }, [activeSection, entries]);

  const selectedDocument = useMemo(() => {
    if (!itemParam || !visibleDocuments) return null;
    return visibleDocuments.find((item) => item._id === itemParam) ?? null;
  }, [itemParam, visibleDocuments]);

  const versions = useQuery(
    api.artifacts.getVersions,
    selectedDocument ? { artifactId: selectedDocument._id } : "skip",
  );

  const activeDepartmentId = overview?.departments[0]?._id ?? null;
  const currentVersion =
    selectedDocument && versions
      ? versions.find((version) => version._id === selectedDocument.currentVersionId) ?? versions[0]
      : null;
  const currentContent =
    cleanDisplayText(currentVersion?.content ?? selectedDocument?.currentVersion?.contentPreview ?? "");
  const editorContent = draftItemId === selectedDocument?._id ? draftContent : currentContent;

  const counts = useMemo(() => {
    const result = new Map<LibrarySection, number>();
    for (const tab of typeTabs) result.set(tab.id, 0);
    if (!entries) return result;
    result.set("all", entries.length);
    for (const entry of entries) {
      result.set(entry.section, (result.get(entry.section) ?? 0) + 1);
    }
    return result;
  }, [entries]);

  const createNewItem = async () => {
    if (!activeDepartmentId || !newTitle.trim() || !newContent.trim()) return;
    setStatus(null);
    const itemId = await createItem({
      title: newTitle.trim(),
      departmentId: activeDepartmentId,
      content: newContent.trim(),
      kind: newKind,
      summary: "Created from Library.",
    });
    setDraftItemId(null);
    setNewTitle("");
    setNewContent("");
    setStatus("Saved to Library.");
    router.replace(`/library?item=${itemId}`);
  };

  const saveVersion = async () => {
    if (!selectedDocument || !editorContent.trim()) return;
    await updateItem({
      artifactId: selectedDocument._id,
      content: editorContent.trim(),
      summary: "Updated from Library.",
    });
    setDraftItemId(null);
    setStatus("New version saved.");
  };

  const restoreVersion = async (versionId: Id<"documentVersions">) => {
    if (!selectedDocument) return;
    await revertItem({
      artifactId: selectedDocument._id,
      versionId,
    });
    setDraftItemId(null);
    setStatus("Version restored.");
  };

  const removeDocument = async () => {
    if (!selectedDocument) return;
    await deleteItem({ artifactId: selectedDocument._id });
    setDraftItemId(null);
    setStatus(null);
    router.replace("/library");
  };

  if (!overview || !entries || !filteredEntries || !visibleDocuments) {
    return <PageLoader />;
  }

  if (itemParam) {
    if (!selectedDocument) {
      return (
        <div className="min-h-full px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-5xl rounded-lg border border-black/[0.06] bg-white p-8 text-center shadow-sm">
            <Library size={22} className="mx-auto text-text-muted" />
            <p className="mt-3 text-sm font-semibold text-text-primary">Library item not found</p>
            <Link href="/library" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white">
              <ArrowLeft size={14} />
              Back to Library
            </Link>
          </div>
        </div>
      );
    }

    return (
      <DocumentView
        document={selectedDocument}
        versions={versions}
        editorContent={editorContent}
        status={status}
        setDraftItemId={setDraftItemId}
        setDraftContent={setDraftContent}
        saveVersion={saveVersion}
        restoreVersion={restoreVersion}
        removeDocument={removeDocument}
      />
    );
  }

  return (
    <div className="min-h-full px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Library
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
              Business context, saved work, and history.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              Browse saved files and records. Open a document to edit, restore, or delete it.
            </p>
          </div>
          {status && <p className="text-xs font-medium text-text-secondary">{status}</p>}
        </header>

        <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Search size={16} />
            <h2 className="text-sm font-semibold text-text-primary">Browse by Type</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSection(tab.id)}
                  className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                    active
                      ? "border-black/15 bg-black text-white"
                      : "border-black/[0.06] bg-surface text-text-secondary hover:border-black/15 hover:bg-white"
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span>{tab.label}</span>
                  <span className={active ? "text-white/70" : "text-text-muted"}>
                    {counts.get(tab.id) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FilePlus2 size={16} />
            <h2 className="text-sm font-semibold text-text-primary">Save New Item</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_170px]">
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Title"
              className="h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
            />
            <select
              value={newKind}
              onChange={(event) => setNewKind(event.target.value as DocumentKind)}
              className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
              aria-label="Library item type"
            >
              <option value="document">Document</option>
              <option value="website">Website</option>
              <option value="presentation">Presentation</option>
              <option value="tool">Tool</option>
              <option value="record">Record</option>
            </select>
          </div>
          <textarea
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            placeholder="Write or paste the first version..."
            className="mt-2 min-h-24 w-full resize-none rounded-lg border border-black/[0.07] bg-surface px-3 py-2 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white"
          />
          <button
            onClick={() => void createNewItem()}
            disabled={!newTitle.trim() || !newContent.trim() || !activeDepartmentId}
            className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <FilePlus2 size={15} />
            Save
          </button>
        </section>

        <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/[0.05] px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">{sectionLabel(activeSection)}</h2>
            <span className="text-xs text-text-muted">{filteredEntries.length}</span>
          </div>
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center">
              <Library size={18} className="mx-auto text-text-muted" />
              <p className="mt-3 text-sm font-semibold text-text-primary">Nothing here yet</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                Save an item or start work from Home.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {filteredEntries.map((entry) => (
                <DirectoryRow
                  key={entry.id}
                  entry={entry}
                  onDeleteConversation={async (sessionId) => {
                    await deleteConversation({ sessionId });
                    setStatus("Conversation deleted.");
                  }}
                  onStopTask={async (directiveId) => {
                    await stopTask({ directiveId });
                    setStatus("Task stopped.");
                  }}
                  onDeleteTask={async (directiveId) => {
                    await deleteTask({ directiveId });
                    setStatus("Task deleted.");
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DirectoryRow({
  entry,
  onDeleteConversation,
  onStopTask,
  onDeleteTask,
}: {
  entry: LibraryEntry;
  onDeleteConversation: (sessionId: Id<"chatSessions">) => Promise<void>;
  onStopTask: (directiveId: Id<"directives">) => Promise<void>;
  onDeleteTask: (directiveId: Id<"directives">) => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface/70">
      <Link href={entry.href} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-surface">
          <SectionIcon section={entry.section} className="text-text-muted" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">{entry.title}</p>
          <p className="mt-0.5 truncate text-xs text-text-muted">{entry.summary}</p>
        </div>
      </Link>
      <span className="hidden shrink-0 text-xs text-text-muted md:block">{formatTime(entry.timestamp)}</span>
      {entry.source === "conversation" && (
        <button
          type="button"
          onClick={() => void onDeleteConversation(entry.record._id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-red-600"
          aria-label="Delete conversation"
        >
          <Trash2 size={14} />
        </button>
      )}
      {entry.source === "history" && (
        <div className="flex shrink-0 items-center gap-1">
          {canStopTask(entry.record.status) && (
            <button
              type="button"
              onClick={() => void onStopTask(entry.record._id)}
              className="rounded-lg border border-black/[0.08] px-2.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
            >
              Stop
            </button>
          )}
          <button
            type="button"
            onClick={() => void onDeleteTask(entry.record._id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-red-600"
            aria-label="Delete task"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function DocumentView({
  document,
  versions,
  editorContent,
  status,
  setDraftItemId,
  setDraftContent,
  saveVersion,
  restoreVersion,
  removeDocument,
}: {
  document: LibraryDocument;
  versions: Doc<"documentVersions">[] | undefined;
  editorContent: string;
  status: string | null;
  setDraftItemId: (id: Id<"documents"> | null) => void;
  setDraftContent: (content: string) => void;
  saveVersion: () => Promise<void>;
  restoreVersion: (versionId: Id<"documentVersions">) => Promise<void>;
  removeDocument: () => Promise<void>;
}) {
  const section = sectionForKind(document.kind, Boolean(document.traceId));

  return (
    <div className="min-h-full px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          Back to Library
        </Link>

        <section className="rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                {sectionLabel(section)}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
                {displayTitle(document.title)}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                {cleanDisplayText(document.summary ?? "Ready for review and editing.")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="rounded-lg border border-black/[0.06] bg-surface px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                  Current
                </p>
                <p className="mt-1 text-xl font-semibold text-text-primary">
                  v{document.currentVersion?.versionNumber ?? document.versionCount ?? 1}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removeDocument()}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.1] text-text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete document"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Save size={16} />
              <h2 className="text-sm font-semibold text-text-primary">Edit Item</h2>
            </div>
            <button
              onClick={() => void saveVersion()}
              disabled={!editorContent.trim()}
              className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Save version
            </button>
          </div>
          {!versions ? (
            <div className="flex min-h-72 items-center justify-center rounded-lg border border-black/[0.07] bg-surface">
              <Loader2 size={16} className="animate-spin text-text-muted" />
            </div>
          ) : (
            <textarea
              value={editorContent}
              onChange={(event) => {
                setDraftItemId(document._id);
                setDraftContent(event.target.value);
              }}
              className="min-h-80 w-full resize-y rounded-lg border border-black/[0.07] bg-surface px-4 py-3 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white"
            />
          )}
          {status && <p className="mt-3 text-xs font-medium text-text-secondary">{status}</p>}
        </section>

        <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <History size={16} />
            <h2 className="text-sm font-semibold text-text-primary">Version History</h2>
          </div>
          {!versions ? (
            <Loader2 size={16} className="animate-spin text-text-muted" />
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div key={version._id} className="flex items-center justify-between gap-4 rounded-lg border border-black/[0.06] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      Version {version.versionNumber ?? 1}
                    </p>
                    <p className="mt-1 truncate text-xs text-text-muted">
                      {version.summary ?? "Saved version"} - {formatTime(version.createdAt ?? version._creationTime)}
                    </p>
                  </div>
                  <button
                    onClick={() => void restoreVersion(version._id)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-black/[0.1] px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
                  >
                    <ArchiveRestore size={13} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 size={18} className="animate-spin text-text-muted" />
    </div>
  );
}
