"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  ArchiveRestore,
  CalendarClock,
  FilePlus2,
  FileText,
  Globe2,
  History,
  Library,
  ListTodo,
  Loader2,
  MessageSquare,
  Presentation,
  Save,
  Search,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type LibrarySection =
  | "all"
  | "documents"
  | "websites"
  | "presentations"
  | "tools"
  | "automations"
  | "history"
  | "conversations";

type DocumentKind =
  | "document"
  | "file"
  | "website"
  | "internal_tool"
  | "tool"
  | "presentation"
  | "automation"
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
      record: LibraryDocument;
    }
  | {
      id: string;
      source: "automation";
      section: "automations";
      title: string;
      summary: string;
      timestamp: number;
      record: Doc<"scheduleItems">;
    }
  | {
      id: string;
      source: "conversation";
      section: "conversations";
      title: string;
      summary: string;
      timestamp: number;
      record: Doc<"chatSessions">;
    }
  | {
      id: string;
      source: "history";
      section: "history";
      title: string;
      summary: string;
      timestamp: number;
      record: WorkHistory;
    };

const typeTabs: Array<{ id: LibrarySection; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All", icon: Library },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "websites", label: "Websites", icon: Globe2 },
  { id: "presentations", label: "Presentations", icon: Presentation },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "automations", label: "Automations", icon: CalendarClock },
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

function formatAutomationTime(item: Doc<"scheduleItems">) {
  const cadence = item.cadence === "daily"
    ? "Every day"
    : item.cadence === "weekdays"
      ? "Weekdays"
      : item.cadence === "weekly"
        ? "Weekly"
        : "Once";

  return `${cadence} at ${new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(item.startAt))}`;
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
  if (kind === "automation") return "automations";
  if (kind === "task_output" || kind === "conversation" || hasTrace) return "history";
  return "documents";
}

function sectionLabel(section: LibrarySection) {
  return typeTabs.find((tab) => tab.id === section)?.label ?? "Library";
}

function iconForSection(section: LibrarySection) {
  return typeTabs.find((tab) => tab.id === section)?.icon ?? Library;
}

function startAtFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 6, minutes || 0, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date.getTime();
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
  const automations = useQuery(api.automations.list) as Doc<"scheduleItems">[] | undefined;
  const createItem = useMutation(api.artifacts.create);
  const updateItem = useMutation(api.artifacts.update);
  const revertItem = useMutation(api.artifacts.revert);
  const createAutomation = useMutation(api.automations.create);
  const pauseAutomation = useMutation(api.automations.pause);

  const [activeSection, setActiveSection] = useState<LibrarySection>("all");
  const [manualSelectedId, setManualSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<DocumentKind>("document");
  const [newContent, setNewContent] = useState("");
  const [automationTitle, setAutomationTitle] = useState("Send me priorities");
  const [automationPrompt, setAutomationPrompt] = useState("Send me my priorities for the day.");
  const [automationTime, setAutomationTime] = useState("06:00");
  const [automationCadence, setAutomationCadence] = useState<"daily" | "weekdays" | "weekly">("daily");
  const [draftItemId, setDraftItemId] = useState<Id<"documents"> | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const visibleDocuments = useMemo(
    () =>
      documents?.filter(
        (item) =>
          !(
            item.author === "FounderOS" &&
            item.traceId === undefined &&
            legacySeedTitles.has(item.title)
          ),
      ),
    [documents],
  );

  const entries = useMemo<LibraryEntry[] | undefined>(() => {
    if (!visibleDocuments || !conversations || !automations || !overview) return undefined;

    const documentEntries: LibraryEntry[] = visibleDocuments.map((item) => {
      const section = sectionForKind(item.kind, Boolean(item.traceId));
      return {
        id: `document:${item._id}`,
        source: "document",
        section,
        title: displayTitle(item.title),
        summary: cleanDisplayText(item.summary ?? item.currentVersion?.summary ?? "Saved in Library."),
        timestamp: item.updatedAt ?? item._creationTime,
        record: item,
      };
    });

    const automationEntries: LibraryEntry[] = automations.map((item) => ({
      id: `automation:${item._id}`,
      source: "automation",
      section: "automations",
      title: displayTitle(item.title),
      summary: formatAutomationTime(item),
      timestamp: item.updatedAt ?? item.createdAt ?? item._creationTime,
      record: item,
    }));

    const conversationEntries: LibraryEntry[] = conversations.map((item) => ({
      id: `conversation:${item._id}`,
      source: "conversation",
      section: "conversations",
      title: displayTitle(item.title),
      summary: `Conversation updated ${formatTime(item.lastMessageAt)}`,
      timestamp: item.lastMessageAt,
      record: item,
    }));

    const historyEntries: LibraryEntry[] = (overview.recentWork as WorkHistory[])
      .filter((item) => item.status === "completed")
      .map((item) => ({
        id: `history:${item._id}`,
        source: "history",
        section: "history",
        title: displayTitle(item.title),
        summary: cleanDisplayText(item.objective),
        timestamp: item._creationTime,
        record: item,
      }));

    return [...documentEntries, ...automationEntries, ...conversationEntries, ...historyEntries].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [automations, conversations, overview, visibleDocuments]);

  const selectedId = itemParam ? `document:${itemParam}` : manualSelectedId;
  const filteredEntries = useMemo(() => {
    if (!entries) return undefined;
    return activeSection === "all"
      ? entries
      : entries.filter((entry) => entry.section === activeSection);
  }, [activeSection, entries]);

  const selectedEntry = useMemo(() => {
    if (!entries?.length) return null;
    const selected = selectedId ? entries.find((entry) => entry.id === selectedId) : null;
    if (selected) return selected;
    return filteredEntries?.[0] ?? entries[0];
  }, [entries, filteredEntries, selectedId]);

  const selectedDocument = selectedEntry?.source === "document" ? selectedEntry.record : null;
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
    setManualSelectedId(`document:${itemId}`);
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

  const saveAutomation = async () => {
    if (!automationTitle.trim() || !automationPrompt.trim()) return;
    const automationId = await createAutomation({
      title: automationTitle.trim(),
      prompt: automationPrompt.trim(),
      startAt: startAtFromTime(automationTime),
      cadence: automationCadence,
    });
    setManualSelectedId(`automation:${automationId}`);
    setStatus("Automation saved.");
  };

  if (!overview || !entries || !filteredEntries) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-full px-4 py-6 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[360px_1fr]">
        <aside className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
            Library
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
            Business context, saved work, and history.
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Documents, websites, presentations, tools, automations, conversations, and useful records live here.
          </p>

          <section className="mt-6 rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Search size={16} />
              <h2 className="text-sm font-semibold text-text-primary">Browse by Type</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {typeTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(tab.id);
                      setManualSelectedId(null);
                    }}
                    className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                      active
                        ? "border-black/15 bg-black text-white"
                        : "border-black/[0.06] bg-surface text-text-secondary hover:border-black/15 hover:bg-white"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon size={14} className="shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </span>
                    <span className={active ? "text-white/70" : "text-text-muted"}>
                      {counts.get(tab.id) ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FilePlus2 size={16} />
              <h2 className="text-sm font-semibold text-text-primary">Save New Item</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_140px] xl:grid-cols-1">
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
              className="mt-2 min-h-28 w-full resize-none rounded-lg border border-black/[0.07] bg-surface px-3 py-2 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white"
            />
            <button
              onClick={() => void createNewItem()}
              disabled={!newTitle.trim() || !newContent.trim() || !activeDepartmentId}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              <FilePlus2 size={15} />
              Save
            </button>
          </section>

          <section className="mt-4 rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock size={16} />
              <h2 className="text-sm font-semibold text-text-primary">Add Automation</h2>
            </div>
            <input
              value={automationTitle}
              onChange={(event) => setAutomationTitle(event.target.value)}
              placeholder="Send me priorities"
              className="h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
            />
            <textarea
              value={automationPrompt}
              onChange={(event) => setAutomationPrompt(event.target.value)}
              placeholder="What should FounderOS send or prepare?"
              className="mt-2 min-h-20 w-full resize-none rounded-lg border border-black/[0.07] bg-surface px-3 py-2 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={automationCadence}
                onChange={(event) => setAutomationCadence(event.target.value as "daily" | "weekdays" | "weekly")}
                className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                aria-label="Automation frequency"
              >
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
              </select>
              <input
                type="time"
                value={automationTime}
                onChange={(event) => setAutomationTime(event.target.value)}
                className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
                aria-label="Automation time"
              />
            </div>
            <button
              onClick={() => void saveAutomation()}
              disabled={!automationTitle.trim() || !automationPrompt.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-black/[0.1] bg-white px-4 py-2 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <CalendarClock size={15} />
              Save automation
            </button>
          </section>
        </aside>

        <main className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(260px,340px)_1fr]">
          <section className="min-w-0 rounded-lg border border-black/[0.06] bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-text-primary">{sectionLabel(activeSection)}</h2>
              <span className="text-xs text-text-muted">{filteredEntries.length}</span>
            </div>
            {filteredEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-black/[0.08] bg-surface/70 p-5 text-center">
                <Library size={18} className="mx-auto text-text-muted" />
                <p className="mt-3 text-sm font-semibold text-text-primary">Nothing here yet</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  Save an item, start a task from Home, or add an automation.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEntries.map((entry) => {
                  const Icon = iconForSection(entry.section);
                  const selected = selectedEntry?.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => {
                        setManualSelectedId(entry.id);
                        setDraftItemId(null);
                        if (entry.source === "document") {
                          router.replace(`/library?item=${entry.record._id}`);
                        } else {
                          router.replace("/library");
                        }
                      }}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                        selected
                          ? "border-black/15 bg-surface shadow-sm"
                          : "border-black/[0.06] bg-white hover:border-black/10 hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon size={16} className="mt-0.5 shrink-0 text-text-muted" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {entry.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-text-muted">
                            {entry.summary}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <SelectedEntryView
            entry={selectedEntry}
            versions={versions}
            editorContent={editorContent}
            status={status}
            setDraftItemId={setDraftItemId}
            setDraftContent={setDraftContent}
            saveVersion={saveVersion}
            restoreVersion={restoreVersion}
            pauseAutomation={pauseAutomation}
          />
        </main>
      </div>
    </div>
  );
}

function SelectedEntryView({
  entry,
  versions,
  editorContent,
  status,
  setDraftItemId,
  setDraftContent,
  saveVersion,
  restoreVersion,
  pauseAutomation,
}: {
  entry: LibraryEntry | null;
  versions: Doc<"documentVersions">[] | undefined;
  editorContent: string;
  status: string | null;
  setDraftItemId: (id: Id<"documents"> | null) => void;
  setDraftContent: (content: string) => void;
  saveVersion: () => Promise<void>;
  restoreVersion: (versionId: Id<"documentVersions">) => Promise<void>;
  pauseAutomation: (args: { automationId: Id<"scheduleItems"> }) => Promise<null>;
}) {
  if (!entry) {
    return (
      <section className="rounded-lg border border-black/[0.06] bg-white p-8 text-center shadow-sm">
        <Library size={22} className="mx-auto text-text-muted" />
        <p className="mt-3 text-sm font-semibold text-text-primary">No Library item selected</p>
        <p className="mt-1 text-xs text-text-secondary">Saved work and useful history will appear here.</p>
      </section>
    );
  }

  if (entry.source === "document") {
    const item = entry.record;
    return (
      <div className="min-w-0 space-y-5">
        <section className="rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                {sectionLabel(entry.section)}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
                {entry.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                {entry.summary || "Ready for review and editing."}
              </p>
            </div>
            <div className="rounded-lg border border-black/[0.06] bg-surface px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                Current
              </p>
              <p className="mt-1 text-xl font-semibold text-text-primary">
                v{item.currentVersion?.versionNumber ?? item.versionCount ?? 1}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Save size={16} />
              <h3 className="text-sm font-semibold text-text-primary">Edit Item</h3>
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
                setDraftItemId(item._id);
                setDraftContent(event.target.value);
              }}
              className="min-h-72 w-full resize-y rounded-lg border border-black/[0.07] bg-surface px-4 py-3 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white"
            />
          )}
          {status && <p className="mt-3 text-xs font-medium text-text-secondary">{status}</p>}
        </section>

        <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <History size={16} />
            <h3 className="text-sm font-semibold text-text-primary">Version History</h3>
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
    );
  }

  if (entry.source === "automation") {
    return (
      <section className="rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Automations</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{entry.title}</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{entry.summary}</p>
        <div className="mt-5 rounded-lg border border-black/[0.06] bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Task</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-primary">
            {entry.record.prompt ?? "Prepare the requested update."}
          </p>
        </div>
        <button
          onClick={() => void pauseAutomation({ automationId: entry.record._id })}
          className="mt-5 rounded-lg border border-black/[0.1] px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
        >
          Pause automation
        </button>
      </section>
    );
  }

  if (entry.source === "conversation") {
    return (
      <section className="rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Conversations</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{entry.title}</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{entry.summary}</p>
        <Link
          href={`/?session=${entry.record._id}`}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"
        >
          <MessageSquare size={14} />
          Open conversation
        </Link>
      </section>
    );
  }

  const sessionId = entry.record.sessionId;
  return (
    <section className="rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">History</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{entry.title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{entry.summary}</p>
      <Link
        href={sessionId ? `/?session=${sessionId}&task=${entry.record._id}` : `/?task=${entry.record._id}`}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"
      >
        <ListTodo size={14} />
        Open task
      </Link>
    </section>
  );
}

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 size={18} className="animate-spin text-text-muted" />
    </div>
  );
}
