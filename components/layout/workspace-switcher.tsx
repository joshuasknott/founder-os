"use client";

import * as React from "react";
import { Check, ChevronDown, Plus, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
type Role = "Owner" | "Contributor" | "Viewer";

interface Workspace {
  id: string;
  name: string;
  role: Role;
  icon?: React.ReactNode;
}

const mockWorkspaces: Workspace[] = [
  {
    id: "ws_01",
    name: "FounderOS",
    role: "Owner",
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    id: "ws_02",
    name: "Memvella",
    role: "Contributor",
    icon: <Building2 className="w-4 h-4" />,
  },
];

export function WorkspaceSwitcher() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeWorkspace, setActiveWorkspace] = React.useState<Workspace>(
    mockWorkspaces[0]
  );
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full max-w-[240px] px-3 py-2 text-sm text-left transition-colors duration-200 bg-white border outline-none focus:ring-2 focus:ring-black",
          "border-transparent hover:bg-zinc-50",
          isOpen && "bg-zinc-50 border-zinc-200"
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center gap-2 truncate">
          <div className="flex items-center justify-center w-6 h-6 rounded-sm bg-black text-white shrink-0">
            {activeWorkspace.icon || (
              <span className="text-xs font-semibold">
                {activeWorkspace.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex flex-col truncate">
            <span className="font-semibold text-black truncate leading-tight">
              {activeWorkspace.name}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono tracking-tight uppercase leading-tight">
              {activeWorkspace.role}
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
            {mockWorkspaces.map((workspace) => (
              <li key={workspace.id} role="option" aria-selected={activeWorkspace.id === workspace.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveWorkspace(workspace);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between w-full px-2 py-2 text-sm text-left transition-colors",
                    "hover:bg-zinc-100 focus:bg-zinc-100 outline-none rounded-sm",
                    activeWorkspace.id === workspace.id ? "text-black font-medium" : "text-zinc-600"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="flex items-center justify-center w-5 h-5 rounded-sm bg-zinc-100 text-zinc-600 shrink-0">
                      {workspace.icon || (
                        <span className="text-[10px] font-semibold">
                          {workspace.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <span className="truncate">{workspace.name}</span>
                  </div>
                  {activeWorkspace.id === workspace.id && (
                    <Check className="w-4 h-4 shrink-0 text-black" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          
          <div className="px-1 py-1 border-t border-zinc-200">
            <button
              type="button"
              className="flex items-center w-full gap-2 px-2 py-2 text-sm text-left transition-colors text-zinc-600 hover:text-black hover:bg-zinc-50 rounded-sm outline-none focus:bg-zinc-50"
            >
              <div className="flex items-center justify-center w-5 h-5 shrink-0 rounded-sm bg-zinc-50 border border-dashed border-zinc-300">
                <Plus className="w-3 h-3 text-zinc-400 group-hover:text-black" />
              </div>
              <span className="font-medium">Create New Workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
