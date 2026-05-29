"use client";

import { Suspense, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { GlobalSearchResults, type GlobalSearchData } from "@/components/search/GlobalSearchResults";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Clock3,
  ExternalLink,
  FilePlus2,
  FileText,
  Inbox,
  Loader2,
  Pin,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";

type LibraryView = "recent" | "created" | "uploaded" | "pinned" | "needs_review" | "archived";
type EditableSource = "document" | "item";

type ItemKind =
  | "created_output"
  | "upload"
  | "website"
  | "deck"
  | "doc"
  | "email"
  | "contact"
  | "company"
  | "decision"
  | "research"
  | "automation"
  | "tool"
  | "task_output"
  | "document"
  | "file"
  | "internal_tool"
  | "presentation"
  | "conversation"
  | "record"
  | "brief"
  | "plan";

type DocumentKind =
  | "document"
  | "file"
  | "website"
  | "internal_tool"
  | "tool"
  | "presentation"
  | "task_output"
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

type LibraryItem = Doc<"items"> & {
  currentVersion?: Doc<"itemVersions"> | null;
};

type WorkHistory = Doc<"directives"> & {
  taskCount?: number;
  completedTaskCount?: number;
};

type LibraryEntry = {
  id: string;
  source: "item" | "document" | "work";
  editableSource?: EditableSource;
  item?: LibraryItem;
  document?: LibraryDocument;
  work?: WorkHistory;
  title: string;
  summary: string;
  kind: ItemKind | DocumentKind | "work";
  sourceLabel: string;
  status: string;
  href: string;
  timestamp: number;
  createdAt: number;
  isArchived: boolean;
  isPinned: boolean;
  isUploaded: boolean;
  needsReview: boolean;
  searchableText: string;
};

const views: Array<{ id: LibraryView; label: string; icon: LucideIcon }> = [
  { id: "recent", label: "Recent", icon: Clock3 },
  { id: "created", label: "Created", icon: Sparkles },
  { id: "uploaded", label: "Uploaded", icon: UploadCloud },
  { id: "pinned", label: "Pinned", icon: Pin },
  { id: "needs_review", label: "Needs Review", icon: Inbox },
  { id: "archived", label: "Archived", icon: Archive },
];

const legacySeedTitles = new Set([
  "Founder briefing",
  "Website preview request",
  "Launch messaging draft",
]);

type IntakeFile = {
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  lastModified?: number;
};

const readableFilePattern = /\.(txt|md|markdown|csv|json|html?|xml|yaml|yml|log|ts|tsx|js|jsx|css|scss|sql)$/i;
const intakeContentLimit = 500_000;

const itemKindLabels: Record<string, string> = {
  created_output: "Created output",
  upload: "Upload",
  website: "Website",
  deck: "Deck",
  doc: "Document",
  email: "Email",
  contact: "Contact",
  company: "Company",
  decision: "Decision",
  research: "Research",
  automation: "Automation",
  tool: "Tool",
  task_output: "Task output",
  document: "Document",
  file: "File",
  internal_tool: "Tool",
  presentation: "Presentation",
  conversation: "Conversation",
  record: "Record",
  brief: "Brief",
  plan: "Plan",
  work: "Task",
};

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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    active: "Active",
    under_review: "Needs review",
    approved: "Approved",
    finalized: "Final",
    archived: "Archived",
    deprecated: "Archived",
    completed: "Completed",
  };

  return labels[status] ?? status.replace(/_/g, " ");
}

function sourceLabel(source?: string) {
  const labels: Record<string, string> = {
    user: "Created",
    agent: "Generated",
    upload: "Uploaded",
    website: "Website",
    connector: "Connected",
    migration: "Imported",
    system: "System",
  };
  return source ? labels[source] ?? source : "Library";
}

function itemIsPinned(item?: LibraryItem) {
  const metadata = item?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return Boolean((metadata as { isPinned?: boolean; pinned?: boolean }).isPinned ?? (metadata as { pinned?: boolean }).pinned);
}

function isLegacySeed(item: { title: string; author?: string; traceId?: unknown }) {
  return item.author === "FounderOS" && item.traceId === undefined && legacySeedTitles.has(item.title);
}

function kindForDocument(kind?: string): ItemKind | DocumentKind {
  if (kind === "file") return "upload";
  if (kind === "presentation") return "deck";
  if (kind === "document") return "doc";
  return (kind as ItemKind | DocumentKind | undefined) ?? "doc";
}

function fileCanBeReadAsText(file: File) {
  return file.type.startsWith("text/") || file.type === "application/json" || readableFilePattern.test(file.name);
}

function fileTitle(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || name;
}

function metadataSearchText(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const searchText = (metadata as { searchText?: unknown }).searchText;
  if (typeof searchText === "string") return searchText;
  return "";
}

function itemViewMatches(entry: LibraryEntry, activeView: LibraryView) {
  if (activeView === "archived") return entry.isArchived;
  if (entry.isArchived) return false;
  if (activeView === "recent") return true;
  if (activeView === "created") return !entry.isUploaded;
  if (activeView === "uploaded") return entry.isUploaded;
  if (activeView === "pinned") return entry.isPinned;
  if (activeView === "needs_review") return entry.needsReview;
  return true;
}

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 size={18} className="animate-spin text-text-muted" />
    </div>
  );
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
  const selectedParam = searchParams.get("item");
  const sessionParam = searchParams.get("session") as Id<"chatSessions"> | null;

  const overview = useQuery(api.commandCenter.getOverview);
  const items = useQuery(api.items.list, { includeArchived: true, limit: 250 }) as LibraryItem[] | undefined;
  const documents = useQuery(api.artifacts.list, { includeArchived: true }) as LibraryDocument[] | undefined;
  const createIntake = useMutation(api.items.intake);
  const updateDocument = useMutation(api.artifacts.update);
  const revertDocument = useMutation(api.artifacts.revert);
  const archiveDocument = useMutation(api.artifacts.archive);
  const restoreDocument = useMutation(api.artifacts.restore);
  const updateItem = useMutation(api.items.update);
  const archiveItem = useMutation(api.items.archive);
  const restoreItem = useMutation(api.items.restore);
  const setPinned = useMutation(api.items.setPinned);
  const deleteTask = useMutation(api.directives.deleteDirective);

  const [activeView, setActiveView] = useState<LibraryView>("recent");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<ItemKind>("doc");
  const [newContent, setNewContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [intakeFiles, setIntakeFiles] = useState<IntakeFile[]>([]);
  const [linkedTraceId, setLinkedTraceId] = useState<Id<"directives"> | "">(
    (searchParams.get("task") as Id<"directives"> | null) ?? "",
  );
  const [isIntaking, setIsIntaking] = useState(false);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const normalizedSearchQuery = query.trim();
  const globalSearch = useQuery(
    api.search.globalSearch,
    normalizedSearchQuery
      ? {
          query: normalizedSearchQuery,
          limit: 60,
          includeArchived: activeView === "archived",
        }
      : "skip",
  ) as GlobalSearchData | undefined;

  const entries = useMemo<LibraryEntry[] | undefined>(() => {
    if (!items || !documents || !overview) return undefined;

    const docsByItemId = new Map<string, LibraryDocument>();
    for (const document of documents) {
      if (document.itemId) docsByItemId.set(document.itemId, document);
    }

    const itemEntries: LibraryEntry[] = items
      .filter((item) => item.kind !== "automation" && !isLegacySeed(item))
      .map((item) => {
        const document = docsByItemId.get(item._id);
        const isArchived = item.status === "archived" || item.status === "deprecated" || Boolean(document?.isArchived);
        const isUploaded = item.source === "upload" || item.kind === "upload" || item.kind === "file";
        const needsReview =
          item.status === "under_review" ||
          Boolean(document?.status === "under_review") ||
          (item.source === "agent" && item.status === "draft");
        const title = displayTitle(item.title);
        const summary = cleanDisplayText(
          item.summary ??
            item.currentVersion?.summary ??
            document?.summary ??
            document?.currentVersion?.summary ??
            "Saved in Library.",
        );
        const kind = item.kind as ItemKind;
        const searchableText = [
          title,
          summary,
          kind,
          item.source,
          item.tags?.join(" "),
          metadataSearchText(item.metadata),
          item.currentVersion?.content,
          document?.currentVersion?.contentPreview,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return {
          id: `item:${item._id}`,
          source: "item",
          editableSource: document ? "document" : "item",
          item,
          document,
          title,
          summary,
          kind,
          sourceLabel: sourceLabel(item.source),
          status: item.status,
          href: `/library/${item._id}`,
          timestamp: item.updatedAt ?? item._creationTime,
          createdAt: item.createdAt ?? item._creationTime,
          isArchived,
          isPinned: itemIsPinned(item),
          isUploaded,
          needsReview,
          searchableText,
        };
      });

    const seenDocumentIds = new Set(itemEntries.flatMap((entry) => (entry.document ? [entry.document._id] : [])));
    const documentEntries: LibraryEntry[] = documents
      .filter((document) => !seenDocumentIds.has(document._id) && !isLegacySeed(document))
      .map((document) => {
        const title = displayTitle(document.title);
        const summary = cleanDisplayText(document.summary ?? document.currentVersion?.summary ?? "Saved in Library.");
        const kind = kindForDocument(document.kind);
        const isArchived = document.isArchived || document.status === "deprecated";
        const searchableText = [
          title,
          summary,
          kind,
          document.departmentName,
          document.currentVersion?.contentPreview,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return {
          id: `document:${document._id}`,
          source: "document",
          editableSource: "document",
          document,
          title,
          summary,
          kind,
          sourceLabel: document.author === "FounderOS" ? "Created" : document.author,
          status: document.status,
          href: document.itemId ? `/library/${document.itemId}` : `/library?item=${document._id}`,
          timestamp: document.updatedAt ?? document._creationTime,
          createdAt: document.createdAt ?? document._creationTime,
          isArchived,
          isPinned: false,
          isUploaded: kind === "upload" || kind === "file",
          needsReview: document.status === "under_review" || Boolean(document.traceId && document.status === "draft"),
          searchableText,
        };
      });

    const workEntries: LibraryEntry[] = (overview.recentWork as WorkHistory[])
      .filter((work) => work.status === "completed")
      .filter((work) => !itemEntries.some((entry) => entry.item?.traceId === work._id))
      .map((work) => {
        const title = displayTitle(work.title);
        const summary = cleanDisplayText(work.objective);
        return {
          id: `work:${work._id}`,
          source: "work",
          work,
          title,
          summary,
          kind: "work",
          sourceLabel: "Task",
          status: work.status,
          href: work.sessionId ? `/?session=${work.sessionId}&task=${work._id}` : `/?task=${work._id}`,
          timestamp: work._creationTime,
          createdAt: work._creationTime,
          isArchived: false,
          isPinned: false,
          isUploaded: false,
          needsReview: false,
          searchableText: [title, summary, "task", "created output"].join(" ").toLowerCase(),
        };
      });

    return [...itemEntries, ...documentEntries, ...workEntries].sort((a, b) => b.timestamp - a.timestamp);
  }, [documents, items, overview]);

  const selectedEntry = useMemo(() => {
    if (!selectedParam || !entries) return null;
    return entries.find((entry) => entry.item?._id === selectedParam || entry.document?._id === selectedParam) ?? null;
  }, [entries, selectedParam]);

  const selectedDocument = selectedEntry?.document ?? null;
  const selectedItem = selectedEntry?.item ?? null;
  const selectedEditableSource = selectedEntry?.editableSource;

  const documentVersions = useQuery(
    api.artifacts.getVersions,
    selectedDocument && selectedEditableSource === "document"
      ? { artifactId: selectedDocument._id }
      : "skip",
  );
  const itemVersions = useQuery(
    api.items.getVersions,
    selectedItem && selectedEditableSource === "item" ? { itemId: selectedItem._id } : "skip",
  );

  const versions = selectedEditableSource === "document" ? documentVersions : itemVersions;
  const activeDepartmentId = overview?.departments[0]?._id ?? null;
  const currentContent = cleanDisplayText(
    selectedEditableSource === "document"
      ? (documentVersions?.find((version) => version._id === selectedDocument?.currentVersionId)?.content ??
          documentVersions?.[0]?.content ??
          selectedDocument?.currentVersion?.contentPreview ??
          "")
      : (itemVersions?.find((version) => version._id === selectedItem?.currentVersionId)?.content ??
          itemVersions?.[0]?.content ??
          selectedItem?.currentVersion?.content ??
          ""),
  );
  const editorKey = selectedEntry?.id ?? null;
  const editorContent = draftKey === editorKey ? draftContent : currentContent;

  const counts = useMemo(() => {
    const result = new Map<LibraryView, number>();
    for (const view of views) result.set(view.id, 0);
    if (!entries) return result;
    for (const entry of entries) {
      for (const view of views) {
        if (itemViewMatches(entry, view.id)) {
          result.set(view.id, (result.get(view.id) ?? 0) + 1);
        }
      }
    }
    return result;
  }, [entries]);

  const kindOptions = useMemo(() => {
    if (!entries) return [];
    return Array.from(new Set(entries.map((entry) => String(entry.kind)))).sort();
  }, [entries]);

  const sourceOptions = useMemo(() => {
    if (!entries) return [];
    return Array.from(new Set(entries.map((entry) => entry.sourceLabel))).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!entries) return undefined;
    const normalizedQuery = normalizedSearchQuery.toLowerCase();
    const searchTargets = globalSearch
      ? globalSearch.groups.reduce(
          (targets, group) => {
            for (const result of group.results) {
              if (result.itemId) targets.itemIds.add(result.itemId);
              if (result.targetType === "item" || result.targetType === "version") targets.itemIds.add(result.targetId);
              if (result.targetType === "document") targets.documentIds.add(result.targetId);
              if (result.targetType === "task" || result.targetType === "work") targets.workIds.add(result.targetId);
            }
            return targets;
          },
          {
            itemIds: new Set<string>(),
            documentIds: new Set<string>(),
            workIds: new Set<string>(),
          },
        )
      : null;

    return entries.filter((entry) => {
      if (!itemViewMatches(entry, activeView)) return false;
      if (kindFilter !== "all" && entry.kind !== kindFilter) return false;
      if (sourceFilter !== "all" && entry.sourceLabel !== sourceFilter) return false;
      if (normalizedQuery && searchTargets) {
        const matchesGlobalSearch =
          (entry.item && searchTargets.itemIds.has(entry.item._id)) ||
          (entry.document && searchTargets.documentIds.has(entry.document._id)) ||
          (entry.document?.itemId && searchTargets.itemIds.has(entry.document.itemId)) ||
          (entry.work && searchTargets.workIds.has(entry.work._id));
        if (!matchesGlobalSearch) return false;
      } else if (normalizedQuery && !entry.searchableText.includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [activeView, entries, globalSearch, kindFilter, normalizedSearchQuery, sourceFilter]);

  const readFilesForIntake = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setStatus(null);
    const fileMetadata = files.map((file) => ({
      name: file.name,
      mimeType: file.type || undefined,
      sizeBytes: file.size,
      lastModified: file.lastModified,
    }));
    const chunks: string[] = [];

    for (const file of files) {
      if (!fileCanBeReadAsText(file)) {
        chunks.push(
          `# ${file.name}\n\nThis file is recorded as upload metadata. Full binary storage can attach here once file storage is connected.`,
        );
        continue;
      }

      const text = await file.text();
      const remaining = intakeContentLimit - chunks.join("\n\n").length;
      if (remaining <= 0) break;
      chunks.push(`# ${file.name}\n\n${text.slice(0, remaining)}`);
    }

    setIntakeFiles(fileMetadata);
    setNewKind("upload");
    setNewTitle((current) => current || (files.length === 1 ? fileTitle(files[0].name) : `Upload batch (${files.length})`));
    setNewContent((current) => [current.trim(), chunks.join("\n\n").trim()].filter(Boolean).join("\n\n").slice(0, intakeContentLimit));
    setStatus(files.length === 1 ? "File ready to save." : `${files.length} files ready to save.`);
    event.target.value = "";
  };

  const createNewItem = async () => {
    if (!activeDepartmentId || !newContent.trim()) return;
    setStatus(null);
    setIsIntaking(true);
    try {
      const result = await createIntake({
        title: newTitle.trim() || undefined,
        departmentId: activeDepartmentId,
        content: newContent.trim(),
        kind: newKind,
        sourceUrl: sourceUrl.trim() || undefined,
        traceId: linkedTraceId || undefined,
        sourceChatSessionId: sessionParam ?? undefined,
        files: intakeFiles.length ? intakeFiles : undefined,
      });
      setDraftKey(null);
      setNewTitle("");
      setNewContent("");
      setSourceUrl("");
      setIntakeFiles([]);
      setStatus("Saved to Library.");
      router.replace(`/library/${result.itemId}`);
    } finally {
      setIsIntaking(false);
    }
  };

  const saveVersion = async () => {
    if (!selectedEntry || !editorContent.trim()) return;
    if (selectedEditableSource === "document" && selectedDocument) {
      await updateDocument({
        artifactId: selectedDocument._id,
        content: editorContent.trim(),
        summary: "Updated from Library.",
      });
    } else if (selectedEditableSource === "item" && selectedItem) {
      await updateItem({
        itemId: selectedItem._id,
        content: editorContent.trim(),
        summary: "Updated from Library.",
      });
    }
    setDraftKey(null);
    setStatus("New version saved.");
  };

  const restoreVersion = async (versionId: Id<"documentVersions"> | Id<"itemVersions">) => {
    if (selectedEditableSource === "document" && selectedDocument) {
      await revertDocument({
        artifactId: selectedDocument._id,
        versionId: versionId as Id<"documentVersions">,
      });
      setStatus("Version restored.");
    } else if (selectedEditableSource === "item" && selectedItem) {
      const version = (itemVersions as Doc<"itemVersions">[] | undefined)?.find((candidate) => candidate._id === versionId);
      if (!version) return;
      await updateItem({
        itemId: selectedItem._id,
        content: version.content ?? "",
        summary: `Restored from version ${version.versionNumber}.`,
        format: version.format,
        sourceUrl: version.sourceUrl,
        storageId: version.storageId,
        mimeType: version.mimeType,
      });
      setStatus("Version restored.");
    }
    setDraftKey(null);
  };

  const archiveEntry = async (entry: LibraryEntry) => {
    if (entry.item) {
      await archiveItem({ itemId: entry.item._id });
    } else if (entry.document) {
      await archiveDocument({ artifactId: entry.document._id });
    }
    setStatus("Archived.");
    if (selectedParam) router.replace("/library");
  };

  const restoreEntry = async (entry: LibraryEntry) => {
    if (entry.item) {
      await restoreItem({ itemId: entry.item._id });
    } else if (entry.document) {
      await restoreDocument({ artifactId: entry.document._id });
    }
    setStatus("Restored.");
  };

  const togglePin = async (entry: LibraryEntry) => {
    if (!entry.item) return;
    await setPinned({ itemId: entry.item._id, isPinned: !entry.isPinned });
    setStatus(entry.isPinned ? "Removed from pinned." : "Pinned.");
  };

  if (!overview || !entries || !filteredEntries || !items || !documents) {
    return <PageLoader />;
  }

  if (selectedParam) {
    if (!selectedEntry) {
      return (
        <div className="min-h-full px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-5xl rounded-lg border border-black/[0.06] bg-white p-8 text-center shadow-sm">
            <FileText size={22} className="mx-auto text-text-muted" />
            <p className="mt-3 text-sm font-semibold text-text-primary">Library item not found</p>
            <Link href="/library" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white">
              <ArrowLeft size={14} />
              Back to Library
            </Link>
          </div>
        </div>
      );
    }

    if (selectedEntry.source === "work") {
      router.replace(selectedEntry.href);
      return <PageLoader />;
    }

    return (
      <ItemDetail
        entry={selectedEntry}
        versions={versions}
        editorContent={editorContent}
        status={status}
        onDraft={(content) => {
          setDraftKey(editorKey);
          setDraftContent(content);
        }}
        saveVersion={saveVersion}
        restoreVersion={restoreVersion}
        archiveEntry={archiveEntry}
        restoreEntry={restoreEntry}
        togglePin={togglePin}
      />
    );
  }

  return (
    <div className="min-h-full px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Library</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Search and review everything saved from work, uploads, and manual notes.
            </p>
          </div>
          {status && <p className="text-xs font-medium text-text-secondary">{status}</p>}
        </header>

        <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <label className="flex h-11 items-center gap-2 rounded-lg border border-black/[0.07] bg-surface px-3 focus-within:border-black/20 focus-within:bg-white">
              <Search size={16} className="shrink-0 text-text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Library, chats, tasks, facts"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-white hover:text-text-primary"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <select
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value)}
              className="h-11 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
              aria-label="Filter by kind"
            >
              <option value="all">All kinds</option>
              {kindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {itemKindLabels[kind] ?? kind}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="h-11 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
              aria-label="Filter by source"
            >
              <option value="all">All sources</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {views.map((view) => {
              const Icon = view.icon;
              const active = activeView === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                  className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                    active
                      ? "border-black/15 bg-black text-white"
                      : "border-black/[0.06] bg-surface text-text-secondary hover:border-black/15 hover:bg-white"
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span>{view.label}</span>
                  <span className={active ? "text-white/70" : "text-text-muted"}>{counts.get(view.id) ?? 0}</span>
                </button>
              );
            })}
          </div>
        </section>

        {normalizedSearchQuery && globalSearch && (
          <GlobalSearchResults data={globalSearch} maxPerGroup={3} />
        )}

        <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FilePlus2 size={16} />
              <h2 className="text-sm font-semibold text-text-primary">Add to Library</h2>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-black/[0.08] bg-surface px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-white hover:text-text-primary">
              <UploadCloud size={14} />
              Files
              <input type="file" multiple className="sr-only" onChange={(event) => void readFilesForIntake(event)} />
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_160px]">
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Title"
              className="h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
            />
            <select
              value={newKind}
              onChange={(event) => setNewKind(event.target.value as ItemKind)}
              className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
              aria-label="Library item type"
            >
              <option value="doc">Document</option>
              <option value="upload">Upload</option>
              <option value="website">Website</option>
              <option value="deck">Deck</option>
              <option value="research">Research</option>
              <option value="record">Record</option>
              <option value="brief">Brief</option>
              <option value="plan">Plan</option>
            </select>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_220px]">
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="Source URL"
              className="h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
            />
            <select
              value={linkedTraceId}
              onChange={(event) => setLinkedTraceId(event.target.value as Id<"directives"> | "")}
              className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
              aria-label="Link to task"
            >
              <option value="">No linked task</option>
              {(overview.recentWork as WorkHistory[]).map((work) => (
                <option key={work._id} value={work._id}>
                  {displayTitle(work.title)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={newContent}
            onChange={(event) => setNewContent(event.target.value.slice(0, intakeContentLimit))}
            placeholder="Paste content or choose files..."
            className="mt-2 min-h-32 w-full resize-y rounded-lg border border-black/[0.07] bg-surface px-3 py-2 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-xs text-text-muted">
              {intakeFiles.length > 0 ? `${intakeFiles.length} file${intakeFiles.length === 1 ? "" : "s"} attached as text-first metadata` : null}
            </div>
            <button
              onClick={() => void createNewItem()}
              disabled={!newContent.trim() || !activeDepartmentId || isIntaking}
              className="flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isIntaking ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />}
              Save
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/[0.05] px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">{views.find((view) => view.id === activeView)?.label}</h2>
            <span className="text-xs text-text-muted">{filteredEntries.length}</span>
          </div>
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox size={18} className="mx-auto text-text-muted" />
              <p className="mt-3 text-sm font-semibold text-text-primary">Nothing matches</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Adjust search or filters to widen the surface.</p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {filteredEntries.map((entry) => (
                <LibraryRow
                  key={entry.id}
                  entry={entry}
                  onArchive={archiveEntry}
                  onRestore={restoreEntry}
                  onPin={togglePin}
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

function LibraryRow({
  entry,
  onArchive,
  onRestore,
  onPin,
  onDeleteTask,
}: {
  entry: LibraryEntry;
  onArchive: (entry: LibraryEntry) => Promise<void>;
  onRestore: (entry: LibraryEntry) => Promise<void>;
  onPin: (entry: LibraryEntry) => Promise<void>;
  onDeleteTask: (directiveId: Id<"directives">) => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface/70">
      <Link href={entry.href} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-surface">
          <FileText size={15} className="text-text-muted" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">{entry.title}</p>
            {entry.isPinned && <Pin size={12} className="shrink-0 text-text-muted" />}
          </div>
          <p className="mt-0.5 truncate text-xs text-text-muted">{entry.summary}</p>
        </div>
      </Link>
      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-semibold text-text-secondary">
          {itemKindLabels[String(entry.kind)] ?? entry.kind}
        </span>
        <span className="text-xs text-text-muted">{entry.sourceLabel}</span>
        <span className="text-xs text-text-muted">{formatTime(entry.timestamp)}</span>
      </div>
      {entry.item && !entry.isArchived && (
        <button
          type="button"
          onClick={() => void onPin(entry)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text-primary"
          aria-label={entry.isPinned ? "Unpin item" : "Pin item"}
        >
          <Pin size={14} />
        </button>
      )}
      {entry.source === "work" && entry.work ? (
        <button
          type="button"
          onClick={() => void onDeleteTask(entry.work!._id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-red-600"
          aria-label="Delete task"
        >
          <X size={14} />
        </button>
      ) : entry.isArchived ? (
        <button
          type="button"
          onClick={() => void onRestore(entry)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text-primary"
          aria-label="Restore item"
        >
          <RefreshCcw size={14} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void onArchive(entry)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text-primary"
          aria-label="Archive item"
        >
          <Archive size={14} />
        </button>
      )}
    </div>
  );
}

function ItemDetail({
  entry,
  versions,
  editorContent,
  status,
  onDraft,
  saveVersion,
  restoreVersion,
  archiveEntry,
  restoreEntry,
  togglePin,
}: {
  entry: LibraryEntry;
  versions: Doc<"documentVersions">[] | Doc<"itemVersions">[] | undefined;
  editorContent: string;
  status: string | null;
  onDraft: (content: string) => void;
  saveVersion: () => Promise<void>;
  restoreVersion: (versionId: Id<"documentVersions"> | Id<"itemVersions">) => Promise<void>;
  archiveEntry: (entry: LibraryEntry) => Promise<void>;
  restoreEntry: (entry: LibraryEntry) => Promise<void>;
  togglePin: (entry: LibraryEntry) => Promise<void>;
}) {
  const versionNumber = entry.document?.currentVersion?.versionNumber ?? entry.item?.versionCount ?? entry.document?.versionCount ?? 1;
  const sourceUrl = entry.item?.sourceUrl ?? entry.item?.currentVersion?.sourceUrl;

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
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-text-muted">
                  {itemKindLabels[String(entry.kind)] ?? entry.kind}
                </span>
                <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-text-muted">
                  {entry.sourceLabel}
                </span>
                <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-text-muted">
                  {statusLabel(entry.status)}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">{entry.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{entry.summary}</p>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
                >
                  <ExternalLink size={13} />
                  Open source
                </a>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="rounded-lg border border-black/[0.06] bg-surface px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Current</p>
                <p className="mt-1 text-xl font-semibold text-text-primary">v{versionNumber}</p>
              </div>
              {entry.item && !entry.isArchived && (
                <button
                  type="button"
                  onClick={() => void togglePin(entry)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.1] text-text-muted hover:bg-surface hover:text-text-primary"
                  aria-label={entry.isPinned ? "Unpin item" : "Pin item"}
                >
                  <Pin size={15} />
                </button>
              )}
              {entry.isArchived ? (
                <button
                  type="button"
                  onClick={() => void restoreEntry(entry)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.1] text-text-muted hover:bg-surface hover:text-text-primary"
                  aria-label="Restore item"
                >
                  <ArchiveRestore size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void archiveEntry(entry)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.1] text-text-muted hover:bg-surface hover:text-text-primary"
                  aria-label="Archive item"
                >
                  <Archive size={15} />
                </button>
              )}
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
              disabled={!editorContent.trim() || entry.isArchived}
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
              onChange={(event) => onDraft(event.target.value)}
              disabled={entry.isArchived}
              className="min-h-80 w-full resize-y rounded-lg border border-black/[0.07] bg-surface px-4 py-3 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            />
          )}
          {status && <p className="mt-3 text-xs font-medium text-text-secondary">{status}</p>}
        </section>

        <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Clock3 size={16} />
            <h2 className="text-sm font-semibold text-text-primary">Version History</h2>
          </div>
          {!versions ? (
            <Loader2 size={16} className="animate-spin text-text-muted" />
          ) : versions.length === 0 ? (
            <p className="text-sm text-text-secondary">No versions saved yet.</p>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div key={version._id} className="flex items-center justify-between gap-4 rounded-lg border border-black/[0.06] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">Version {version.versionNumber ?? 1}</p>
                    <p className="mt-1 truncate text-xs text-text-muted">
                      {version.summary ?? "Saved version"} - {formatTime(version.createdAt ?? version._creationTime)}
                    </p>
                  </div>
                  <button
                    onClick={() => void restoreVersion(version._id)}
                    disabled={entry.isArchived}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-black/[0.1] px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
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
