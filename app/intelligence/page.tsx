"use client";

import { useState } from "react";
import { Folder, FileText, History, Search, Plus, MoreVertical, Edit2, Download, Trash2, ChevronRight, FileCode, X } from "lucide-react";

export default function IntelligenceHubPage() {
  const [activeTab, setActiveTab] = useState<"knowledge" | "blueprints" | "history">("knowledge");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-full flex-col w-full p-6 md:p-10 max-w-6xl mx-auto">
      {/* Universal Header & Search */}
      <div className="mb-6 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-black">Intelligence</h1>
          <p className="text-sm text-zinc-500">The digital brain of FounderOS.</p>
        </div>
        
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
          <input 
            type="text" 
            placeholder="Search across all contexts..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-sm border border-zinc-200 py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-black focus:outline-none transition-colors"
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
        {activeTab === "knowledge" && <KnowledgeView />}
        {activeTab === "blueprints" && <BlueprintsView />}
        {activeTab === "history" && <HistoryView />}
      </div>
    </div>
  );
}

function ContextMenu({ onDelete }: { onDelete?: (e: React.MouseEvent) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
      <button 
        className="p-1 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-sm transition-colors"
      >
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

function KnowledgeView() {
  const [folders, setFolders] = useState<string[]>(["Marketing", "Engineering", "Legal", "HR"]);
  const [files, setFiles] = useState<Record<string, string[]>>({
    "Marketing": ["Q3_Strategy_Deck.pdf", "Competitor_Analysis.md", "Brand_Assets.zip"]
  });
  
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const handleDeleteFolder = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolders(folders.filter(f => f !== name));
  };

  const handleDeleteFile = (folder: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles({ ...files, [folder]: files[folder].filter(f => f !== name) });
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim() && !folders.includes(newFolderName.trim())) {
      setFolders([...folders, newFolderName.trim()]);
    }
    setNewFolderName("");
    setIsAddFolderModalOpen(false);
  };

  const handleCreateFile = () => {
    if (newFileName.trim() && activeFolder) {
      const current = files[activeFolder] || [];
      setFiles({ ...files, [activeFolder]: [...current, newFileName.trim()] });
    }
    setNewFileName("");
    setIsAddFileModalOpen(false);
  };

  if (activeFolder) {
    const currentFiles = files[activeFolder] || [];
    return (
      <div className="flex flex-col h-full relative">
        {viewingFile ? (
          <div className="absolute inset-0 z-20 flex flex-col bg-white border border-zinc-200 shadow-xl rounded-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Document Header */}
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
            
            {/* Document Body */}
            <div className="flex-1 overflow-y-auto w-full p-8 md:p-12 bg-white">
              <div className="max-w-3xl mx-auto flex flex-col gap-6">
                <h1 className="text-4xl font-bold tracking-tight text-black mb-2">Q3 Marketing Strategy & Expansion Plan</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 font-mono border-b border-zinc-100 pb-6 mb-2">
                  <span>Author: Nova (Content & Strategy)</span>
                  <span>Updated: Today, 09:41 AM</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Verified</span>
                </div>
                
                <div className="prose prose-zinc prose-sm md:prose-base max-w-none text-zinc-600">
                  <h2 className="text-2xl font-semibold text-black mt-4 mb-3">1. Executive Summary</h2>
                  <p className="leading-relaxed mb-6">
                    This document outlines the core operational directives for the upcoming quarter, shifting the primary focus toward 
                    product-led growth and aggressive enterprise expansion across the EMEA corridor. All agentic workflows will be prioritized 
                    based on these parameters.
                  </p>
                  
                  <h2 className="text-2xl font-semibold text-black mt-4 mb-3">2. Key Objectives</h2>
                  <ul className="list-disc list-outside space-y-2 leading-relaxed ml-5 mb-6">
                    <li>Launch the "Executive OS" brand narrative across all primary channels.</li>
                    <li>Reduce customer acquisition cost (CAC) by 15% through programmatic SEO.</li>
                    <li>Establish 3 new enterprise partnership corridors in the EMEA region.</li>
                  </ul>

                  <h2 className="text-2xl font-semibold text-black mt-4 mb-3">3. Resource Allocation</h2>
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-sm font-mono text-sm text-zinc-600 my-4">
                    Marketing Budget: £125,000<br/>
                    Primary Focus: Performance Marketing<br/>
                    Secondary Focus: Organic Content Architecture
                  </div>

                  <p className="leading-relaxed mt-4">
                    All agentic deployments related to these objectives require L2 authorization. Atlas will monitor spend velocity and automatically halt campaigns that exceed the daily £500 threshold.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <button onClick={() => setActiveFolder(null)} className="text-zinc-500 hover:text-black transition-colors">
                  Knowledge
                </button>
                <ChevronRight size={14} className="text-zinc-400" />
                <span className="text-black">{activeFolder}</span>
              </div>
              <button 
                onClick={() => setIsAddFileModalOpen(true)}
                className="flex items-center gap-2 rounded-sm bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
              >
                <Plus size={14} /> Add File
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-12">
              {currentFiles.map((f, i) => (
                <FileCard key={i} name={f} onDelete={(e) => handleDeleteFile(activeFolder, f, e)} onClick={() => setViewingFile(f)} />
              ))}
            </div>
          </>
        )}

        {isAddFileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-white shadow-2xl rounded-sm border border-zinc-200 p-6 flex flex-col">
              <h2 className="text-lg font-semibold text-black mb-4">Upload File to {activeFolder}</h2>
              <input 
                autoFocus
                placeholder="mock_document.pdf"
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

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-end mb-6">
        <button 
          onClick={() => setIsAddFolderModalOpen(true)}
          className="flex items-center gap-2 rounded-sm border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-50 transition-colors"
        >
          <Plus size={14} /> Add Folder
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {folders.map((f, i) => (
          <FolderCard key={i} name={f} onClick={() => setActiveFolder(f)} onDelete={(e) => handleDeleteFolder(f, e)} />
        ))}
      </div>

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

function FolderCard({ name, onClick, onDelete }: { name: string; onClick: () => void; onDelete: (e: React.MouseEvent) => void }) {
  return (
    <div 
      onClick={onClick}
      className="flex flex-col gap-2 rounded-sm border border-zinc-200 bg-white p-4 hover:border-black transition-colors cursor-pointer group shadow-sm"
    >
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

function BlueprintsView() {
  const [blueprints, setBlueprints] = useState([
    { id: "1", title: "Frontend Architecture", desc: "Rules for Next.js App Router and Executive Minimalism." },
    { id: "2", title: "DB Migration", desc: "Standard procedure for Convex schema updates." },
    { id: "3", title: "Weekly Update Format", desc: "Template for generating Friday investor updates." }
  ]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleAddBlueprint = () => {
    if (newTitle.trim() && newDesc.trim()) {
      setBlueprints([...blueprints, { id: Date.now().toString(), title: newTitle.trim(), desc: newDesc.trim() }]);
    }
    setNewTitle("");
    setNewDesc("");
    setIsAddOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBlueprints(blueprints.filter(b => b.id !== id));
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {blueprints.map(b => (
          <BlueprintCard 
            key={b.id}
            title={b.title} 
            desc={b.desc}
            onDelete={(e) => handleDelete(b.id, e)}
          />
        ))}
      </div>

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
              <button onClick={handleAddBlueprint} className="px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-zinc-800 rounded-sm">Save Blueprint</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlueprintCard({ title, desc, onDelete }: { title: string; desc: string; onDelete: (e: React.MouseEvent) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-zinc-200 bg-white p-4 hover:border-black transition-colors shadow-sm group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-black">
          <FileText size={16} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <ContextMenu onDelete={onDelete} />
      </div>
      <p className="text-xs text-zinc-500 mt-2 line-clamp-2 leading-relaxed">{desc}</p>
    </div>
  );
}

function HistoryView() {
  const [history, setHistory] = useState([
    { id: "T-001", action: "Deleted `components/workspace`", user: "Orion", role: "Chief of Staff", time: "10:45 AM", artifact: "{\n  \"status\": \"success\",\n  \"files_removed\": 12\n}" },
    { id: "T-002", action: "Deployed V1.2.0 API server", user: "Atlas", role: "Backend Architecture", time: "09:30 AM", artifact: "Deployment started...\nRegions: us-east-1, eu-central-1\nLoad balancers provisioned." },
    { id: "T-003", action: "Updated `globals.css` with Inter font", user: "Cipher", role: "Frontend Vanguard", time: "Yesterday", artifact: ".font-sans {\n  font-family: 'Inter', sans-serif;\n}" },
  ]);

  const [selectedArtifact, setSelectedArtifact] = useState<any | null>(null);

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setHistory(history.filter(h => h.id !== id));
    if (selectedArtifact?.id === id) {
      setSelectedArtifact(null);
    }
  };

  return (
    <>
      <div className="rounded-sm border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-black border-b border-zinc-200">
            <tr>
              <th className="px-4 py-3">Task ID</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Executed By</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {history.map((row) => (
              <tr 
                key={row.id} 
                onClick={() => setSelectedArtifact(row)}
                className="hover:bg-zinc-50 transition-colors group cursor-pointer"
              >
                <td className="px-4 py-3 font-mono text-zinc-500 text-xs">{row.id}</td>
                <td className="px-4 py-3 text-black font-medium">{row.action}</td>
                <td className="px-4 py-3 text-zinc-600">{row.user}</td>
                <td className="px-4 py-3 font-mono text-zinc-400 text-xs">{row.time}</td>
                <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ContextMenu onDelete={(e) => handleDelete(row.id, e)} />
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500 font-medium">No history available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8 overflow-y-auto animate-in fade-in duration-200" onClick={() => setSelectedArtifact(null)}>
          <div 
            className="w-full max-w-4xl bg-white shadow-2xl rounded-xl flex flex-col border border-zinc-200 max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-col border-b border-zinc-200 bg-white p-6 gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 rounded-sm bg-zinc-100 border border-zinc-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {selectedArtifact.id}
                  </span>
                  <h2 className="text-xl font-semibold tracking-tight text-black">{selectedArtifact.action}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDelete(selectedArtifact.id)} className="text-zinc-500 hover:text-red-600 transition-colors rounded-sm hover:bg-zinc-100 p-1.5 focus:outline-none">
                    <Trash2 size={18} />
                  </button>
                  <button onClick={() => setSelectedArtifact(null)} className="text-zinc-500 hover:text-black transition-colors rounded-sm hover:bg-zinc-100 p-1.5 focus:outline-none">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-black">
                  <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-black text-white text-[10px] font-bold">
                    {selectedArtifact.user[0]}
                  </div>
                  {selectedArtifact.user}
                </div>
                <span className="text-zinc-300">•</span>
                <span className="text-zinc-500 font-mono">{selectedArtifact.time}</span>
              </div>
            </div>

            {/* Artifact Body */}
            <div className="flex-1 bg-zinc-950 p-6 overflow-y-auto w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <FileCode size={14} /> Output Artifact
                </h3>
              </div>
              <pre className="font-mono text-sm leading-relaxed text-zinc-300 bg-transparent rounded-sm whitespace-pre-wrap word-break-all break-all">
                {selectedArtifact.artifact}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
