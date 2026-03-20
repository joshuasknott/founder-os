"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Folder, FileText, History, Search, Plus, MoreVertical,
  Edit2, Download, Trash2, ChevronRight, FileCode, X
} from "lucide-react";
import { cn } from "@/lib/utils";

type NodeType = "Folder" | "File" | "Blueprint";

function IntelligenceHubContent() {
  const searchParams = useSearchParams();
  const initTab = searchParams.get("tab") === "blueprints" ? "blueprints" : "knowledge";
  const [activeTab, setActiveTab] = useState<"knowledge" | "blueprints" | "history">(initTab);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-full flex-col w-full p-8 md:p-12 max-w-6xl mx-auto">
      {/* Universal Header & Search */}
      <div className="mb-8 flex flex-col gap-6">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-black">Intelligence</h1>
          <p className="text-base text-zinc-500">The digital brain of FounderOS.</p>
        </div>

        <div className="relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black" />
          <input
            type="text"
            placeholder="Search across all contexts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-sm border border-zinc-200 py-4 pl-12 pr-4 text-base font-medium text-black focus:border-black focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-200 mb-6">
        <button
          onClick={() => setActiveTab("knowledge")}
          className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold transition-colors relative ${
            activeTab === "knowledge" ? "text-black" : "text-zinc-500 hover:text-black"
          }`}
        >
          <Folder size={16} /> Knowledge
          {activeTab === "knowledge" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-black" />}
        </button>
        <button
          onClick={() => setActiveTab("blueprints")}
          className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold transition-colors relative ${
            activeTab === "blueprints" ? "text-black" : "text-zinc-500 hover:text-black"
          }`}
        >
          <FileText size={16} /> Blueprints
          {activeTab === "blueprints" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-black" />}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold transition-colors relative ${
            activeTab === "history" ? "text-black" : "text-zinc-500 hover:text-black"
          }`}
        >
          <History size={16} /> History
          {activeTab === "history" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-black" />}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "knowledge" && <KnowledgeView searchQuery={searchQuery} />}
        {activeTab === "blueprints" && <BlueprintsView searchQuery={searchQuery} />}
        {activeTab === "history" && <HistoryView searchQuery={searchQuery} />}
      </div>
    </div>
  );
}

export default function IntelligenceHubPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-black animate-spin" />
      </div>
    }>
      <IntelligenceHubContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Shared Context Menu
// ---------------------------------------------------------------------------

function ContextMenu({ onDelete }: { onDelete?: (e: React.MouseEvent) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
      <button className="p-1 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-sm transition-colors">
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
          <div className="absolute right-0 top-full mt-1 w-36 rounded-sm border border-zinc-200 bg-white p-1 shadow-lg z-20" onClick={(e) => e.stopPropagation()}>
            <button className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black" onClick={() => setIsOpen(false)}>
              <Edit2 size={12} /> Edit
            </button>
            <button className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-zinc-100 rounded-sm font-medium text-black" onClick={() => setIsOpen(false)}>
              <Download size={12} /> Download
            </button>
            <div className="my-1 border-t border-zinc-100" />
            <button
              onClick={(e) => { setIsOpen(false); onDelete?.(e); }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-red-50 text-red-600 rounded-sm font-medium transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 rounded-sm bg-zinc-100 border border-zinc-100" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knowledge View
// ---------------------------------------------------------------------------

function KnowledgeView({ searchQuery }: { searchQuery: string }) {
  const nodes = useQuery(api.intelligence.getNodes);
  const workspaces = useQuery(api.workspaces.get);
  const workspaceId = workspaces?.[0]?._id as Id<"workspaces"> | undefined;

  const createNode = useMutation(api.intelligence.createNode);
  const deleteNode = useMutation(api.intelligence.deleteNode);

  const [activeFolderId, setActiveFolderId] = useState<Id<"knowledge_nodes"> | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const folders = nodes?.filter(n => n.type === "Folder" && !n.parentId) ?? [];
  const activeFolder = nodes?.find(n => n._id === activeFolderId) ?? null;
  const filesInFolder = nodes?.filter(n => n.type === "File" && n.parentId === activeFolderId) ?? [];

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !workspaceId) return;
    await createNode({ workspaceId, type: "Folder", title: newFolderName.trim() });
    setNewFolderName("");
    setIsAddFolderModalOpen(false);
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim() || !workspaceId || !activeFolderId) return;
    await createNode({ workspaceId, type: "File", title: newFileName.trim(), parentId: activeFolderId });
    setNewFileName("");
    setIsAddFileModalOpen(false);
  };

  const handleDeleteNode = async (nodeId: Id<"knowledge_nodes">, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNode({ nodeId });
    if (nodeId === activeFolderId) setActiveFolderId(null);
  };

  // Inside folder view
  if (activeFolderId && activeFolder) {
    const filteredFiles = filesInFolder.filter(f =>
      !searchQuery || f.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="flex flex-col h-full relative">
        {viewingFile ? (
          <div className="absolute inset-0 z-20 flex flex-col bg-white border border-zinc-200 shadow-xl rounded-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/50 px-6 py-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-white border border-zinc-200 shadow-sm">
                  <FileText size={16} className="text-zinc-500" />
                </div>
                <h2 className="text-lg font-semibold text-black">{viewingFile}</h2>
              </div>
              <button onClick={() => setViewingFile(null)} className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-sm transition-colors focus:outline-none">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto w-full p-8 md:p-12 bg-white">
              <div className="max-w-3xl mx-auto">
                <h1 className="text-4xl font-bold tracking-tight text-black mb-4">{viewingFile}</h1>
                <p className="text-zinc-500 text-sm font-mono">No content yet. Edit this document to add content.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <button onClick={() => setActiveFolderId(null)} className="text-zinc-500 hover:text-black transition-colors">
                  Knowledge
                </button>
                <ChevronRight size={14} className="text-zinc-400" />
                <span className="text-black">{activeFolder.title}</span>
              </div>
              <button
                onClick={() => setIsAddFileModalOpen(true)}
                className="flex items-center gap-2 rounded-sm bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
              >
                <Plus size={14} /> Add File
              </button>
            </div>

            {nodes === undefined ? (
              <GridSkeleton count={3} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-12">
                {filteredFiles.map(f => (
                  <FileCard
                    key={f._id}
                    name={f.title}
                    onDelete={(e) => handleDeleteNode(f._id, e)}
                    onClick={() => setViewingFile(f.title)}
                  />
                ))}
                {filteredFiles.length === 0 && (
                  <p className="text-sm text-zinc-400 col-span-3 py-8">No files yet. Add one above.</p>
                )}
              </div>
            )}
          </>
        )}

        {isAddFileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-white shadow-2xl rounded-sm border border-zinc-200 p-6 flex flex-col">
              <h2 className="text-lg font-semibold text-black mb-4">Add File to {activeFolder.title}</h2>
              <input
                autoFocus
                placeholder="document.md"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
                className="w-full rounded-sm border border-zinc-200 py-2 px-3 text-sm focus:border-black focus:outline-none mb-4"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsAddFileModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-sm">Cancel</button>
                <button onClick={handleCreateFile} className="px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-zinc-800 rounded-sm">Add File</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Root folder grid
  const filteredFolders = folders.filter(f =>
    !searchQuery || f.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => setIsAddFolderModalOpen(true)}
          className="flex items-center gap-2 rounded-sm bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          <Plus size={14} /> Add Folder
        </button>
      </div>

      {nodes === undefined ? (
        <GridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFolders.map(f => (
            <FolderCard
              key={f._id}
              name={f.title}
              onClick={() => setActiveFolderId(f._id)}
              onDelete={(e) => handleDeleteNode(f._id, e)}
            />
          ))}
          {filteredFolders.length === 0 && nodes.length >= 0 && (
            <p className="text-sm text-zinc-400 col-span-4 py-8">No folders yet. Create one above.</p>
          )}
        </div>
      )}

      {isAddFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white shadow-2xl rounded-sm border border-zinc-200 p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-black mb-4">New Folder</h2>
            <input
              autoFocus
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              className="w-full rounded-sm border border-zinc-200 py-2 px-3 text-sm focus:border-black focus:outline-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAddFolderModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-sm">Cancel</button>
              <button onClick={handleCreateFolder} className="px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-zinc-800 rounded-sm">Create Folder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder & File Cards
// ---------------------------------------------------------------------------

function FolderCard({ name, onClick, onDelete }: { name: string; onClick: () => void; onDelete: (e: React.MouseEvent) => void }) {
  return (
    <div onClick={onClick} className="flex flex-col gap-2 rounded-sm border border-zinc-200 bg-white p-4 hover:border-black transition-colors cursor-pointer group shadow-sm">
      <div className="flex items-start justify-between">
        <Folder size={24} className="fill-zinc-100 text-zinc-400 group-hover:text-black group-hover:fill-zinc-200 transition-colors" />
        <ContextMenu onDelete={onDelete} />
      </div>
      <span className="text-sm font-semibold text-black mt-2">{name}</span>
    </div>
  );
}

function FileCard({ name, onDelete, onClick }: { name: string; onDelete: (e: React.MouseEvent) => void; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center justify-between rounded-sm border border-zinc-200 bg-white p-3 hover:border-black transition-colors cursor-pointer shadow-sm group">
      <div className="flex items-center gap-3 overflow-hidden">
        <FileCode size={18} className="text-zinc-400 group-hover:text-black shrink-0" />
        <span className="text-sm font-medium text-black truncate">{name}</span>
      </div>
      <ContextMenu onDelete={onDelete} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blueprints View
// ---------------------------------------------------------------------------

function BlueprintsView({ searchQuery }: { searchQuery: string }) {
  const nodes = useQuery(api.intelligence.getNodes);
  const workspaces = useQuery(api.workspaces.get);
  const workspaceId = workspaces?.[0]?._id as Id<"workspaces"> | undefined;

  const createNode = useMutation(api.intelligence.createNode);
  const deleteNode = useMutation(api.intelligence.deleteNode);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const blueprints = nodes?.filter(n => n.type === "Blueprint") ?? [];
  const filtered = blueprints.filter(b =>
    !searchQuery || b.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = async () => {
    if (!newTitle.trim() || !workspaceId) return;
    await createNode({ workspaceId, type: "Blueprint", title: newTitle.trim(), content: newDesc.trim() });
    setNewTitle("");
    setNewDesc("");
    setIsAddOpen(false);
  };

  const handleDelete = async (nodeId: Id<"knowledge_nodes">, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNode({ nodeId });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 rounded-sm bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          <Plus size={14} /> Add Blueprint
        </button>
      </div>

      {nodes === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-sm bg-zinc-100 border border-zinc-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(b => (
            <BlueprintCard
              key={b._id}
              title={b.title}
              desc={b.content ?? ""}
              onDelete={(e) => handleDelete(b._id, e)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-400 col-span-3 py-8">No blueprints yet. Create one above.</p>
          )}
        </div>
      )}

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white shadow-2xl rounded-sm border border-zinc-200 p-6 flex flex-col">
            <h2 className="text-lg font-semibold text-black mb-4">Create Blueprint</h2>
            <input
              autoFocus
              placeholder="Blueprint Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-sm border border-zinc-200 py-2 px-3 text-sm focus:border-black focus:outline-none mb-3"
            />
            <textarea
              placeholder="Blueprint Description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
              className="w-full rounded-sm border border-zinc-200 py-2 px-3 text-sm focus:border-black focus:outline-none mb-4 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-sm">Cancel</button>
              <button onClick={handleAdd} className="px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-zinc-800 rounded-sm">Save Blueprint</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlueprintCard({ title, desc, onDelete }: { title: string; desc: string; onDelete: (e: React.MouseEvent) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className={cn(
        "flex flex-col gap-2 rounded-sm border border-zinc-200 bg-white p-4 transition-all cursor-pointer shadow-sm group",
        isExpanded ? "border-black shadow-md ring-1 ring-black/5" : "hover:border-zinc-300"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-black">
          <FileText size={16} className={isExpanded ? "text-black" : "text-zinc-500"} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <ChevronRight size={16} className={cn("text-zinc-400 transition-transform duration-200", isExpanded && "rotate-90")} />
      </div>
      
      {isExpanded ? (
        <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-sm text-zinc-600 leading-relaxed font-mono bg-zinc-50 p-3 rounded-sm border border-zinc-100 mb-4 whitespace-pre-wrap">
            {desc || "No description provided."}
          </p>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
            <button 
              onClick={(e) => { e.stopPropagation(); /* Edit hook to be wired */ }}
              className="text-xs font-semibold text-zinc-500 hover:text-black transition-colors px-2 py-1"
            >
              Edit
            </button>
            <button 
              onClick={onDelete}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors px-2 py-1 rounded-sm"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{desc || "No description."}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History View
// ---------------------------------------------------------------------------

function HistoryView({ searchQuery }: { searchQuery: string }) {
  const history = useQuery(api.intelligence.getHistory);
  type HistoryEntry = NonNullable<ReturnType<typeof history extends undefined ? never : () => typeof history>>[number] extends never
    ? { _id: string; displayLabel: string; action: string; actorType: string; actorId: string; timestamp: number; targetResource?: string }
    : NonNullable<typeof history>[number];
  const [selectedEntry, setSelectedEntry] = useState<NonNullable<typeof history>[number] | null>(null);

  const filtered = history?.filter(h =>
    !searchQuery ||
    h.displayLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.action.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  return (
    <>
      <div className="rounded-sm border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-black border-b border-zinc-200">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {history === undefined && (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-3 w-48 rounded-sm bg-zinc-200" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-24 rounded-sm bg-zinc-100" /></td>
                  <td className="px-4 py-3"><div className="h-3 w-20 rounded-sm bg-zinc-100" /></td>
                </tr>
              ))
            )}

            {history !== undefined && filtered.map((row) => (
              <tr
                key={row._id}
                onClick={() => setSelectedEntry(row as any)}
                className="hover:bg-zinc-50 transition-colors group cursor-pointer"
              >
                <td className="px-4 py-3 text-black font-medium">{row.displayLabel}</td>
                <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{row.actorType}: {row.actorId}</td>
                <td className="px-4 py-3 font-mono text-zinc-400 text-xs">
                  {new Date(row.timestamp).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                </td>
              </tr>
            ))}

            {history !== undefined && filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500 font-medium">No history available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="w-full max-w-4xl bg-white shadow-2xl rounded-xl flex flex-col border border-zinc-200 max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col border-b border-zinc-200 bg-white p-6 gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight text-black">{(selectedEntry as any).displayLabel}</h2>
                <button onClick={() => setSelectedEntry(null)} className="text-zinc-500 hover:text-black transition-colors rounded-sm hover:bg-zinc-100 p-1.5 focus:outline-none">
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="font-mono text-zinc-500">{(selectedEntry as any).actorType}: {(selectedEntry as any).actorId}</span>
                <span className="text-zinc-300">•</span>
                <span className="text-zinc-500 font-mono">
                  {new Date((selectedEntry as any).timestamp).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
            </div>
            <div className="flex-1 bg-zinc-950 p-6 overflow-y-auto w-full">
              <h3 className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                <FileCode size={14} /> Event Detail
              </h3>
              <pre className="font-mono text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap break-all">
                {JSON.stringify({
                  action: (selectedEntry as any).action,
                  targetResource: (selectedEntry as any).targetResource,
                  actorType: (selectedEntry as any).actorType,
                  actorId: (selectedEntry as any).actorId,
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
