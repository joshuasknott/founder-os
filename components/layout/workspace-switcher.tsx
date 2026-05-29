"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function WorkspaceSwitcher() {
  const workspaces = useQuery(api.workspaces.get);
  const activeWorkspace = workspaces?.[0];

  if (workspaces === undefined) {
    return (
      <div className="flex w-full max-w-[240px] items-center gap-2 px-3 py-2">
        <div className="h-8 flex-1 rounded-lg bg-zinc-100 animate-pulse" />
      </div>
    );
  }

  if (!activeWorkspace) return null;

  return (
    <div className="w-full max-w-[240px] rounded-lg border border-black/[0.06] bg-white px-3 py-2">
      <span className="block truncate text-sm font-semibold leading-tight text-text-primary">
        {activeWorkspace.name}
      </span>
      <span className="text-xs leading-tight text-text-muted">One business</span>
    </div>
  );
}
