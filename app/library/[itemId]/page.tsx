"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bot,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareText,
  Pin,
  Save,
  Send,
  Sparkles,
} from "lucide-react";

type ItemDetailData = {
  item: Doc<"items"> & { currentVersion?: Doc<"itemVersions"> | null };
  document?: Doc<"documents"> | null;
  versions: Doc<"itemVersions">[];
  documentVersions: Doc<"documentVersions">[];
  directive?: Doc<"directives"> | null;
  chatSession?: Doc<"chatSessions"> | null;
  sourceTask?: Doc<"tasks"> | null;
  sourceRun?: Doc<"workRuns"> | null;
  sourceArtifacts: Doc<"workArtifacts">[];
  relatedItems: Doc<"items">[];
  relatedEntities: Doc<"entities">[];
  facts: Doc<"facts">[];
};

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type ItemContextData = {
  sections: Array<{
    label: string;
    items: Array<{
      title: string;
      detail?: string;
      href?: string;
    }>;
  }>;
};

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
  presentation: "Deck",
  conversation: "Conversation",
  record: "Record",
  brief: "Brief",
  plan: "Plan",
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

function cleanDisplayText(value?: string | null) {
  return (value ?? "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\*\*?Autonomy Level\s*\d+\s*(?:[-\u2013\u2014]\s*[^*]+)?\*\*?/gi, "")
    .replace(/\bRAG\b|\bAI Router\b|\bTOOL_INVOCATION\b/gi, "")
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/\boperator(s)?\b/gi, "worker$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/---+/g, "")
    .replace(/\*{2,}/g, "")
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
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    user: "Created",
    agent: "Generated",
    upload: "Uploaded",
    website: "Website",
    connector: "Connected",
    migration: "Imported",
    system: "System",
  };
  return labels[source] ?? source;
}

function itemIsPinned(item: Doc<"items">) {
  const metadata = item.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return Boolean((metadata as { isPinned?: boolean; pinned?: boolean }).isPinned ?? (metadata as { pinned?: boolean }).pinned);
}

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function intakeDetails(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const intake = (metadata as { intake?: unknown }).intake;
  if (!intake || typeof intake !== "object" || Array.isArray(intake)) return [];
  const value = intake as {
    mode?: string;
    storageStrategy?: string;
    files?: Array<{ name?: string; sizeBytes?: number; mimeType?: string }>;
    extracted?: { wordCount?: number; lineCount?: number; urls?: string[]; emails?: string[] };
  };
  const files = value.files ?? [];
  return [
    value.mode === "file_text" ? "File upload" : "Pasted content",
    value.storageStrategy ? "Text-first storage" : null,
    files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : null,
    ...files.slice(0, 3).map((file) => [file.name, formatBytes(file.sizeBytes), file.mimeType].filter(Boolean).join(" - ")),
    value.extracted?.wordCount ? `${value.extracted.wordCount} words` : null,
    value.extracted?.urls?.length ? `${value.extracted.urls.length} URLs found` : null,
    value.extracted?.emails?.length ? `${value.extracted.emails.length} emails found` : null,
  ].filter((item): item is string => Boolean(item));
}

function AssistantSidebar({
  detail,
  content,
  itemContext,
}: {
  detail: ItemDetailData;
  content: string;
  itemContext?: ItemContextData | null;
}) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content: `I'm scoped to "${cleanDisplayText(detail.item.title)}". Ask a question or describe the change you want.`,
    },
  ]);

  const contextLine = useMemo(() => {
    const retrievedCount = itemContext?.sections.reduce((count, section) => count + section.items.length, 0) ?? 0;
    const relatedCount = retrievedCount || detail.relatedItems.length + detail.relatedEntities.length + detail.facts.length;
    const source = detail.directive?.title ?? detail.chatSession?.title ?? detail.sourceRun?.title;
    return [source ? `Source: ${cleanDisplayText(source)}` : null, relatedCount ? `${relatedCount} related notes` : null]
      .filter(Boolean)
      .join(" · ");
  }, [detail, itemContext]);

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();
    const isChangeRequest = /\b(change|rewrite|update|edit|shorten|expand|improve|make)\b/.test(lower);
    const summary = cleanDisplayText(detail.item.summary ?? detail.item.currentVersion?.summary ?? "No summary saved yet.");
    const preview = cleanDisplayText(content).slice(0, 280);
    const relatedContext = itemContext?.sections
      .flatMap((section) => section.items.map((item) => `${item.title}${item.detail ? ` (${item.detail})` : ""}`))
      .slice(0, 3)
      .join("; ");
    const reply = isChangeRequest
      ? "I have this item in scope. The live action is limited for now, so I can capture the requested change here while you use the editor to make and save the next version."
      : `Based on the saved summary: ${summary || "there is no saved summary yet."}${preview ? ` The current preview starts: ${preview}` : ""}${relatedContext ? ` Related context: ${relatedContext}.` : ""}`;

    setMessages((current) => [
      ...current,
      { role: "user", content: trimmed },
      { role: "assistant", content: reply },
    ]);
    setPrompt("");
  };

  return (
    <aside className="flex min-h-[520px] flex-col rounded-lg border border-black/[0.06] bg-white shadow-sm">
      <div className="border-b border-black/[0.05] p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} />
          <h2 className="text-sm font-semibold text-text-primary">Ask About This</h2>
        </div>
        {contextLine && <p className="mt-2 text-xs leading-5 text-text-muted">{contextLine}</p>}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-lg px-3 py-2 text-sm leading-6 ${
              message.role === "user" ? "ml-6 bg-black text-white" : "mr-6 bg-surface text-text-secondary"
            }`}
          >
            {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={submitPrompt} className="border-t border-black/[0.05] p-3">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask a question or request a change..."
          className="min-h-24 w-full resize-none rounded-lg border border-black/[0.07] bg-surface px-3 py-2 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white"
        />
        <button
          type="submit"
          disabled={!prompt.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Send size={14} />
          Send
        </button>
      </form>
    </aside>
  );
}

export default function LibraryItemDetailPage() {
  const params = useParams<{ itemId: string }>();
  const itemId = params.itemId as Id<"items">;
  const detail = useQuery(api.items.getDetail, { itemId }) as ItemDetailData | null | undefined;
  const itemContext = useQuery(api.search.itemContext, { itemId, limit: 12 }) as ItemContextData | null | undefined;
  const updateItem = useMutation(api.items.update);
  const archiveItem = useMutation(api.items.archive);
  const restoreItem = useMutation(api.items.restore);
  const setPinned = useMutation(api.items.setPinned);

  const [draftState, setDraftState] = useState<{ itemId: string; content: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const currentContent = useMemo(() => {
    if (!detail) return "";
    const itemContent = detail.item.currentVersion?.content ?? detail.versions[0]?.content ?? "";
    const documentContent =
      detail.documentVersions.find((version) => version._id === detail.document?.currentVersionId)?.content ??
      detail.documentVersions[0]?.content ??
      "";
    return cleanDisplayText(itemContent || documentContent);
  }, [detail]);

  const draft = draftState?.itemId === itemId ? draftState.content : currentContent;

  if (detail === undefined) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 size={18} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="min-h-full px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-4xl rounded-lg border border-black/[0.06] bg-white p-8 text-center shadow-sm">
          <FileText size={20} className="mx-auto text-text-muted" />
          <h1 className="mt-3 text-xl font-semibold text-text-primary">Item not found</h1>
          <p className="mt-1 text-sm text-text-secondary">This Library item may have been moved or deleted.</p>
          <Link href="/library" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white">
            <ArrowLeft size={14} />
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const { item } = detail;
  const archived = item.status === "archived" || item.status === "deprecated";
  const pinned = itemIsPinned(item);
  const summary = cleanDisplayText(item.summary ?? item.currentVersion?.summary ?? detail.document?.summary ?? "Saved in Library.");
  const title = cleanDisplayText(item.title);
  const sourceUrl = item.sourceUrl ?? item.currentVersion?.sourceUrl;
  const versionNumber = item.versionCount ?? item.currentVersion?.versionNumber ?? detail.versions[0]?.versionNumber ?? 1;
  const sourceHref = detail.directive
    ? detail.directive.sessionId
      ? `/?session=${detail.directive.sessionId}&task=${detail.directive._id}`
      : `/?task=${detail.directive._id}`
    : null;
  const suggestedContext = itemContext?.sections.find((section) => section.label === "Suggested Context")?.items ?? [];

  const saveVersion = async () => {
    if (!draft.trim() || archived) return;
    await updateItem({
      itemId: item._id,
      content: draft.trim(),
      summary: "Updated from Library.",
      format: item.currentVersion?.format ?? "markdown",
    });
    setStatus("New version saved.");
  };

  const restoreVersion = async (version: Doc<"itemVersions">) => {
    if (archived) return;
    await updateItem({
      itemId: item._id,
      content: version.content ?? "",
      summary: `Restored from version ${version.versionNumber}.`,
      format: version.format,
      sourceUrl: version.sourceUrl,
      storageId: version.storageId,
      mimeType: version.mimeType,
    });
    setStatus("Version restored.");
  };

  return (
    <div className="min-h-full px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          Back to Library
        </Link>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-text-muted">
                      {itemKindLabels[item.kind] ?? item.kind}
                    </span>
                    <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-text-muted">
                      {sourceLabel(item.source)}
                    </span>
                    <span className="rounded-md bg-surface px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-text-muted">
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">{title}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{summary}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-text-secondary">
                    {sourceUrl && (
                      <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-text-primary">
                        <ExternalLink size={13} />
                        Open source
                      </a>
                    )}
                    {sourceHref && (
                      <Link href={sourceHref} className="inline-flex items-center gap-1.5 hover:text-text-primary">
                        <MessageSquareText size={13} />
                        Source task or chat
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="rounded-lg border border-black/[0.06] bg-surface px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Current</p>
                    <p className="mt-1 text-xl font-semibold text-text-primary">v{versionNumber}</p>
                  </div>
                  {!archived && (
                    <button
                      type="button"
                      onClick={() => void setPinned({ itemId: item._id, isPinned: !pinned })}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.1] text-text-muted hover:bg-surface hover:text-text-primary"
                      aria-label={pinned ? "Unpin item" : "Pin item"}
                    >
                      <Pin size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void (archived ? restoreItem({ itemId: item._id }) : archiveItem({ itemId: item._id }))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/[0.1] text-text-muted hover:bg-surface hover:text-text-primary"
                    aria-label={archived ? "Restore item" : "Archive item"}
                  >
                    {archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} />
                  <h2 className="text-sm font-semibold text-text-primary">Content Preview</h2>
                </div>
                <button
                  onClick={() => void saveVersion()}
                  disabled={!draft.trim() || archived}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Save size={14} />
                  Save version
                </button>
              </div>
              <textarea
                value={draft}
                onChange={(event) => setDraftState({ itemId, content: event.target.value })}
                disabled={archived}
                className="min-h-96 w-full resize-y rounded-lg border border-black/[0.07] bg-surface px-4 py-3 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />
              {status && <p className="mt-3 text-xs font-medium text-text-secondary">{status}</p>}
            </section>

            <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 size={16} />
                <h2 className="text-sm font-semibold text-text-primary">Versions</h2>
              </div>
              {detail.versions.length === 0 ? (
                <p className="text-sm text-text-secondary">No versions saved yet.</p>
              ) : (
                <div className="space-y-3">
                  {detail.versions.map((version) => (
                    <div key={version._id} className="flex items-center justify-between gap-4 rounded-lg border border-black/[0.06] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">Version {version.versionNumber}</p>
                        <p className="mt-1 truncate text-xs text-text-muted">
                          {cleanDisplayText(version.summary) || "Saved version"} - {formatTime(version.createdAt ?? version._creationTime)}
                        </p>
                      </div>
                      <button
                        onClick={() => void restoreVersion(version)}
                        disabled={archived}
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

            <section className="rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Bot size={16} />
                <h2 className="text-sm font-semibold text-text-primary">Related Context</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ContextGroup
                  title="Source"
                  items={[
                    detail.directive ? `${cleanDisplayText(detail.directive.title)} · ${statusLabel(detail.directive.status)}` : null,
                    detail.chatSession ? `Chat: ${cleanDisplayText(detail.chatSession.title)}` : null,
                    detail.sourceRun ? `${cleanDisplayText(detail.sourceRun.title)} · ${statusLabel(detail.sourceRun.status)}` : null,
                    detail.sourceTask ? `${cleanDisplayText(detail.sourceTask.title)} · ${statusLabel(detail.sourceTask.status)}` : null,
                  ]}
                />
                <ContextGroup
                  title="Nearby Items"
                  items={[
                    ...detail.relatedItems.map((related) => cleanDisplayText(related.title)),
                    ...detail.relatedEntities.map((entity) => cleanDisplayText(entity.name)),
                    ...detail.sourceArtifacts.map((artifact) => cleanDisplayText(artifact.title)),
                  ]}
                />
                <ContextGroup
                  title="Saved Facts"
                  items={detail.facts.map((fact) => `${cleanDisplayText(fact.subject)} ${cleanDisplayText(fact.predicate)} ${cleanDisplayText(fact.object)}`)}
                />
                <ContextGroup title="Tags" items={item.tags ?? []} />
                <ContextGroup title="Intake Details" items={intakeDetails(item.metadata)} />
                <ContextGroup
                  title="Suggested Context"
                  items={suggestedContext.map((context) => [context.title, context.detail].filter(Boolean).join(" - "))}
                />
              </div>
            </section>
          </main>

          <AssistantSidebar detail={detail} content={draft} itemContext={itemContext} />
        </div>
      </div>
    </div>
  );
}

function ContextGroup({ title, items }: { title: string; items: Array<string | null | undefined> }) {
  const visible = items.filter((item): item is string => Boolean(item && item.trim())).slice(0, 6);
  return (
    <div className="rounded-lg border border-black/[0.06] bg-surface p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">{title}</h3>
      {visible.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">Nothing linked yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {visible.map((item, index) => (
            <p key={`${title}-${index}`} className="text-sm leading-5 text-text-secondary">
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
