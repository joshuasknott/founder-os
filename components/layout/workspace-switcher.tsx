"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceItem {
  _id: string;
  name: string;
}

export function WorkspaceSwitcher() {
  const workspaces = useQuery(api.workspaces.get);
  const createWorkspace = useMutation(api.workspaces.create);

  const [isOpen, setIsOpen] = React.useState(false);
  const [activeWorkspace, setActiveWorkspace] = React.useState<WorkspaceItem | null>(null);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Set the first workspace as active once data loads
  React.useEffect(() => {
    if (workspaces && workspaces.length > 0 && !activeWorkspace) {
      setActiveWorkspace(workspaces[0] as WorkspaceItem);
    }
  }, [workspaces, activeWorkspace]);

  // Focus input when create form opens
  React.useEffect(() => {
    if (showCreateForm) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showCreateForm]);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowCreateForm(false);
        setNewName("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      const newId = await createWorkspace({ name: trimmed });
      setActiveWorkspace({ _id: newId as Id<"workspaces">, name: trimmed });
      setNewName("");
      setShowCreateForm(false);
      setIsOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  // Loading skeleton
  if (workspaces === undefined) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 w-full max-w-[240px]">
        <div className="w-6 h-6 rounded-sm bg-zinc-200 animate-pulse shrink-0" />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-3 w-24 rounded-sm bg-zinc-200 animate-pulse" />
          <div className="h-2 w-12 rounded-sm bg-zinc-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!activeWorkspace) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setShowCreateForm(false); setNewName(""); }}
        className={cn(
          "flex items-center justify-between w-full max-w-[240px] px-3 py-2 text-sm text-left transition-colors duration-200 bg-white border outline-none focus:ring-2 focus:ring-black",
          "border-transparent hover:bg-zinc-50",
          isOpen && "bg-zinc-50 border-zinc-200"
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center gap-2 truncate">
          <div className="flex flex-col truncate">
            <span className="font-semibold text-black truncate leading-tight">
              {activeWorkspace.name}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono tracking-tight uppercase leading-tight">
              Owner
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 ml-2",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 w-[240px] mt-1 bg-white border border-zinc-200 shadow-sm animate-in fade-in zoom-in-95 duration-100 origin-top">
          <ul
            className="flex flex-col p-1 max-h-[300px] overflow-auto"
            role="listbox"
          >
            {workspaces.map((workspace) => (
              <li
                key={workspace._id}
                role="option"
                aria-selected={activeWorkspace._id === workspace._id}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveWorkspace(workspace as WorkspaceItem);
                    setIsOpen(false);
                    setShowCreateForm(false);
                    setNewName("");
                  }}
                  className={cn(
                    "flex items-center justify-between w-full px-2 py-2 text-sm text-left transition-colors",
                    "hover:bg-zinc-100 focus:bg-zinc-100 outline-none rounded-sm",
                    activeWorkspace._id === workspace._id
                      ? "text-black font-medium"
                      : "text-zinc-600"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{workspace.name}</span>
                  </div>
                  {activeWorkspace._id === workspace._id && (
                    <Check className="w-4 h-4 shrink-0 text-black" />
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="px-1 py-1 border-t border-zinc-200">
            {!showCreateForm ? (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="flex items-center w-full gap-2 px-2 py-2 text-sm text-left transition-colors text-zinc-600 hover:text-black hover:bg-zinc-50 rounded-sm outline-none focus:bg-zinc-50"
              >
                <div className="flex items-center justify-center w-5 h-5 shrink-0 rounded-sm bg-zinc-50 border border-dashed border-zinc-300">
                  <Plus className="w-3 h-3 text-zinc-400" />
                </div>
                <span className="font-medium">Create New Workspace</span>
              </button>
            ) : (
              <form onSubmit={handleCreate} className="flex flex-col gap-2 p-2">
                <div className="flex items-center gap-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Workspace name..."
                    className="flex-1 px-2 py-1.5 text-xs border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-black rounded-none bg-white text-black placeholder:text-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => { setShowCreateForm(false); setNewName(""); }}
                    className="p-1.5 text-zinc-400 hover:text-black"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!newName.trim() || isCreating}
                  className="w-full px-2 py-1.5 text-xs font-medium text-white bg-black hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
                >
                  {isCreating ? "Creating..." : "Create Workspace"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
