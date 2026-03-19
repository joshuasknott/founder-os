"use client";

import * as React from "react";
import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FileCode, Beaker, GitFork, ArrowUpRight, Box } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Mock Data ---

type FileNodeType = "file" | "folder";

interface FileNode {
  name: string;
  type: FileNodeType;
  children?: FileNode[];
  metadata?: {
    exports: string[];
    dependencies: string[];
    lastExtracted: string;
    complexity: string; // "Low", "Medium", "High"
  };
}

const mockRepoTree: FileNode[] = [
  {
    name: "app",
    type: "folder",
    children: [
      {
        name: "layout.tsx",
        type: "file",
        metadata: {
          exports: ["default function RootLayout", "metadata"],
          dependencies: ["react", "next/font/google", "@/lib/utils", "@/styles/globals.css"],
          lastExtracted: "2 mins ago",
          complexity: "Low",
        }
      },
      {
        name: "page.tsx",
        type: "file",
        metadata: {
          exports: ["default function BoardroomPage"],
          dependencies: ["react", "lucide-react", "next/link", "@/components/modals/code-intervention-modal"],
          lastExtracted: "5 mins ago",
          complexity: "High",
        }
      }
    ]
  },
  {
    name: "components",
    type: "folder",
    children: [
      {
        name: "layout",
        type: "folder",
        children: [
          {
            name: "workspace-switcher.tsx",
            type: "file",
            metadata: {
              exports: ["export function WorkspaceSwitcher"],
              dependencies: ["react", "lucide-react", "@/lib/utils"],
              lastExtracted: "1 hour ago",
              complexity: "Medium",
            }
          }
        ]
      },
      {
        name: "ui",
        type: "folder",
        children: [
          {
            name: "button.tsx",
            type: "file",
            metadata: {
              exports: ["export interface ButtonProps", "export const Button", "export const buttonVariants"],
              dependencies: ["react", "class-variance-authority", "@radix-ui/react-slot", "@/lib/utils"],
              lastExtracted: "1 day ago",
              complexity: "Low",
            }
          }
        ]
      }
    ]
  },
  {
    name: "lib",
    type: "folder",
    children: [
      {
        name: "utils.ts",
        type: "file",
        metadata: {
          exports: ["export function cn"],
          dependencies: ["clsx", "tailwind-merge"],
          lastExtracted: "1 day ago",
          complexity: "Low",
        }
      }
    ]
  }
];

const CONNECTED_REPOS = [
  "joshuasknott/founder-os-core",
  "memvella/web-client",
  "memvella/ai-service"
];

// --- Component ---

export function CodebaseMapViewer() {
  const [activeRepo, setActiveRepo] = useState(CONNECTED_REPOS[0]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["app", "components", "components/layout"]));
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

  const toggleFolder = (path: string) => {
    const newPaths = new Set(expandedFolders);
    if (newPaths.has(path)) {
      newPaths.delete(path);
    } else {
      newPaths.add(path);
    }
    setExpandedFolders(newPaths);
  };

  const renderTree = (nodes: FileNode[], currentPath: string = "") => {
    return nodes.map((node, index) => {
      const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
      const isExpanded = expandedFolders.has(nodePath);
      const isSelected = selectedFile?.name === node.name && node.type === "file";

      if (node.type === "folder") {
        return (
          <div key={nodePath} className="flex flex-col">
            <button
              onClick={() => toggleFolder(nodePath)}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-black transition-colors rounded-sm text-left group"
            >
              <div className="flex h-4 w-4 items-center justify-center shrink-0">
                {isExpanded ? (
                  <ChevronDown size={14} className="text-zinc-400 group-hover:text-black" />
                ) : (
                  <ChevronRight size={14} className="text-zinc-400 group-hover:text-black" />
                )}
              </div>
              <Folder size={14} className="text-zinc-400 group-hover:text-black fill-zinc-100 group-hover:fill-zinc-200" />
              <span className="font-medium truncate">{node.name}</span>
            </button>
            {isExpanded && node.children && (
              <div className="pl-4 ml-2 border-l border-zinc-100 flex flex-col mt-0.5 mb-1">
                {renderTree(node.children, nodePath)}
              </div>
            )}
          </div>
        );
      }

      return (
        <button
          key={nodePath}
          onClick={() => setSelectedFile(node)}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 ml-2 text-sm text-left transition-colors rounded-sm group",
            isSelected 
              ? "bg-black text-white" 
              : "text-zinc-600 hover:bg-zinc-100 hover:text-black"
          )}
        >
          <FileCode size={14} className={isSelected ? "text-zinc-400" : "text-zinc-400 group-hover:text-black"} />
          <span className="truncate">{node.name}</span>
        </button>
      );
    });
  };

  return (
    <div className="flex flex-col w-full h-[600px] border border-zinc-200 bg-white shadow-sm overflow-hidden">
      
      {/* Top Bar: Repo Selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50/50 shrink-0">
        <div className="flex items-center gap-3">
          <GitFork size={16} className="text-zinc-500" />
          <div className="relative">
            <select
              title="Select Repository"
              value={activeRepo}
              onChange={(e) => setActiveRepo(e.target.value)}
              className="appearance-none bg-transparent pr-8 py-1 text-sm font-semibold text-black focus:outline-none cursor-pointer"
            >
              {CONNECTED_REPOS.map(repo => (
                <option key={repo} value={repo}>{repo}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
          <span className="px-2 py-0.5 text-[10px] font-mono tracking-tight text-zinc-500 bg-zinc-100 border border-zinc-200 uppercase rounded-sm">
            Skeleton Map Active
          </span>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-black transition-colors rounded-sm px-2 py-1 hover:bg-zinc-100">
          Sync Remote <ArrowUpRight size={14} />
        </button>
      </div>

      {/* Two-Pane Layout */}
      <div className="flex flex-1 min-h-0">
        
        {/* Left Pane: File Tree */}
        <div className="w-1/3 min-w-[250px] flex flex-col border-r border-zinc-200 bg-white">
          <div className="px-4 py-2 border-b border-zinc-100 bg-zinc-50/50 shrink-0">
            <h3 className="text-xs font-semibold tracking-wider text-black uppercase">Directory Array</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {renderTree(mockRepoTree)}
          </div>
        </div>

        {/* Right Pane: Metadata Viewer */}
        <div className="flex-1 flex flex-col bg-zinc-50/20 overflow-hiddem">
          {selectedFile && selectedFile.metadata ? (
            <div className="flex flex-col h-full animate-in fade-in duration-200">
              
              <div className="px-6 py-4 border-b border-zinc-200 bg-white shrink-0">
                <div className="flex items-center gap-3 mb-1">
                  <FileCode size={20} className="text-black" />
                  <h2 className="text-lg font-semibold text-black">{selectedFile.name}</h2>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 mt-2">
                  <span className="flex items-center gap-1">
                    <Box size={12} /> Size: <span className="text-black">1.2 KB</span>
                  </span>
                  <span>•</span>
                  <span>Extracted: <span className="text-black">{selectedFile.metadata.lastExtracted}</span></span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    Complexity: 
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      selectedFile.metadata.complexity === "High" && "bg-amber-500",
                      selectedFile.metadata.complexity === "Medium" && "bg-blue-500",
                      selectedFile.metadata.complexity === "Low" && "bg-emerald-500"
                    )} />
                    <span className="text-black">{selectedFile.metadata.complexity}</span>
                  </span>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto w-full gap-8 flex flex-col">
                {/* Exports Section */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-black uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-sm" /> 
                    Extracted Exports
                  </h3>
                  <div className="border border-zinc-200 rounded-sm bg-white overflow-hidden">
                    {selectedFile.metadata.exports.map((exp, i) => (
                      <div key={i} className="px-4 py-2 text-sm font-mono text-zinc-600 border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                        {exp}
                      </div>
                    ))}
                    {selectedFile.metadata.exports.length === 0 && (
                      <div className="px-4 py-3 text-sm text-zinc-500 font-medium bg-zinc-50">No exports detected.</div>
                    )}
                  </div>
                </div>

                {/* Dependencies Section */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-black uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-sm" /> 
                    Import Dependencies
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedFile.metadata.dependencies.map((dep, i) => (
                      <div key={i} className="px-2.5 py-1 text-xs font-mono text-zinc-600 bg-white border border-zinc-200 rounded-sm hover:border-black transition-colors cursor-default">
                        {dep}
                      </div>
                    ))}
                    {selectedFile.metadata.dependencies.length === 0 && (
                      <div className="text-sm text-zinc-500 font-medium">No dependencies mapped.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
              <Beaker size={32} className="mb-4 text-zinc-300" strokeWidth={1.5} />
              <p className="text-sm font-medium text-black mb-1">No file selected</p>
              <p className="text-xs max-w-xs">Select a file from the directory array to view its extracted skeletal metadata and dependencies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
