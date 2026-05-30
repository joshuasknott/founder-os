"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import {
  CalendarClock,
  BriefcaseBusiness,
  Bookmark,
  Home,
  Library,
  ListTodo,
  MessageSquare,
  PauseCircle,
  Plus,
  Pin,
  Settings,
  Trash2,
  LogOut,
  type LucideIcon,
} from "lucide-react";

type NavItemProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  pathname: string | null;
};

type RecentItem = {
  id: string;
  title: string;
  href: string;
  kind: "Chat" | "Task";
  timestamp: number;
  status?: string;
};

type PinnedView = {
  _id: Id<"savedViews">;
  title: string;
  scope: "library" | "work" | "schedules" | "workspace";
  query?: string;
  filters?: unknown;
};

function NavItem({ href, icon: Icon, label, pathname }: NavItemProps) {
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));

  return (
    <Link
      href={href}
      className={`mx-1 flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 lg:mx-3 lg:gap-3 lg:px-3.5 ${
        isActive
          ? "border-black/10 bg-white text-text-primary shadow-sm"
          : "border-transparent text-text-secondary hover:bg-black/[0.035] hover:text-text-primary"
      }`}
    >
      <Icon size={16} className={isActive ? "text-text-primary" : "text-text-muted"} />
      <span>{label}</span>
    </Link>
  );
}

function statusLabel(status?: string) {
  if (!status) return "";
  const labels: Record<string, string> = {
    pending_spec: "Preparing",
    needs_clarification: "Needs answer",
    awaiting_approval: "Waiting",
    in_progress: "In progress",
    blocked: "Paused",
    completed: "Completed",
    failed: "Needs attention",
  };

  return labels[status] ?? status.replace(/_/g, " ");
}

function canStopTask(status?: string) {
  return Boolean(status && !["completed", "aborted_by_principal"].includes(status));
}

function displayTitle(title: string) {
  return title
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/\ban Library item\b/gi, "a Library item")
    .replace(/\ban Library items\b/gi, "Library items")
    .replace(/\boperator(s)?\b/gi, "worker$1")
    .replace(/\brouting\b/gi, "planning")
    .replace(/\bcommand center\b/gi, "workspace")
    .trim();
}

function hrefForSavedView(view: PinnedView) {
  const params = new URLSearchParams();
  params.set("view", view._id);
  if (view.query) params.set("q", view.query);
  const filters = view.filters && typeof view.filters === "object" && !Array.isArray(view.filters)
    ? (view.filters as { activeView?: string; kind?: string; source?: string })
    : {};
  if (filters.activeView) params.set("libraryView", filters.activeView);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.source) params.set("source", filters.source);

  if (view.scope === "work") return `/work?${params.toString()}`;
  if (view.scope === "schedules") return `/schedules?${params.toString()}`;
  if (view.scope === "workspace") return `/?${params.toString()}`;
  return `/library?${params.toString()}`;
}

export function Leftnav() {
  const pathname = usePathname();
  const recentWork = useQuery(api.directives.getRecentDirectives);
  const recentChats = useQuery(api.chat.getSessions);
  const pinnedViews = useQuery(api.items.listSavedViews, { pinnedOnly: true }) as PinnedView[] | undefined;
  const stopTask = useMutation(api.directives.stopDirective);
  const deleteTask = useMutation(api.directives.deleteDirective);
  const deleteChat = useMutation(api.chat.deleteSession);
  const currentUser = useQuery(api.users.current);
  const workspaces = useQuery(api.workspaces.get);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const accountReady = currentUser !== undefined && workspaces !== undefined;
  const workspaceName = workspaces?.[0]?.name ?? "FounderOS";
  const user = {
    name: currentUser?.name ?? "Founder",
    email: currentUser?.email ?? "",
    avatarUrl: currentUser?.avatarUrl,
    businessName: workspaceName,
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const recents: RecentItem[] | undefined =
    recentWork === undefined || recentChats === undefined
      ? undefined
      : [
          ...recentChats.map((chat) => ({
            id: chat._id,
            title: chat.title,
            href: `/?session=${chat._id}`,
            kind: "Chat" as const,
            timestamp: chat.lastMessageAt,
          })),
          ...recentWork.map((work) => {
            const sessionId = work.sessionId as Id<"chatSessions"> | undefined;
            return {
              id: work._id,
              title: work.title,
              href: sessionId ? `/?session=${sessionId}&task=${work._id}` : `/?task=${work._id}`,
              kind: "Task" as const,
              timestamp: work._creationTime,
              status: work.status,
            };
          }),
        ]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 12);

  return (
    <nav className="z-20 flex w-full shrink-0 flex-col border-b border-black/[0.06] bg-white py-3 lg:h-full lg:w-64 lg:border-b-0 lg:border-r lg:py-6">
      <div className="mb-3 px-4 lg:mb-7 lg:px-6">
        <Link href="/" className="block" aria-label="FounderOS Home">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">FounderOS</h1>
          <p className="mt-0.5 text-xs font-medium text-text-muted">AI business workspace</p>
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 px-2 lg:flex-col lg:flex-nowrap lg:px-0">
        <NavItem href="/" icon={Home} label="Home" pathname={pathname} />
        <NavItem href="/work" icon={BriefcaseBusiness} label="Work" pathname={pathname} />
        <NavItem href="/library" icon={Library} label="Library" pathname={pathname} />
        <NavItem href="/workflows" icon={Bookmark} label="Workflows" pathname={pathname} />
        <NavItem href="/schedules" icon={CalendarClock} label="Schedules" pathname={pathname} />
        <div className="lg:hidden">
          <NavItem href="/settings" icon={Settings} label="Settings" pathname={pathname} />
        </div>
      </div>

      <div className="mt-6 hidden min-h-0 flex-1 flex-col lg:flex">
        {pinnedViews && pinnedViews.length > 0 && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between px-6">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                Pinned Views
              </h2>
            </div>
            <div className="flex flex-col gap-1 px-3">
              {pinnedViews.slice(0, 6).map((view) => (
                <Link
                  key={view._id}
                  href={hrefForSavedView(view)}
                  className="group flex items-start gap-2 rounded-lg border border-transparent px-3 py-2 hover:border-black/[0.05] hover:bg-black/[0.025]"
                >
                  <Pin size={14} className="mt-0.5 shrink-0 text-text-muted group-hover:text-text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text-secondary group-hover:text-text-primary">
                      {displayTitle(view.title)}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-text-muted">
                      Saved query
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="mb-2 flex items-center justify-between px-6">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Recent
          </h2>
          <Link
            href="/"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-text-muted hover:bg-black/[0.035] hover:text-text-primary"
            aria-label="New chat"
          >
            <Plus size={14} />
          </Link>
        </div>
        <div className="flex flex-col gap-1 overflow-y-auto px-3">
          {recents === undefined ? (
            <div className="space-y-2 px-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-8 rounded-lg bg-black/[0.035]" />
              ))}
            </div>
          ) : recents.length === 0 ? (
            <p className="px-3 py-2 text-xs leading-5 text-text-muted">
              Chats and tasks you start from Home will appear here.
            </p>
          ) : (
            recents.map((item) => {
              const Icon = item.kind === "Chat" ? MessageSquare : ListTodo;
              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="group flex items-start gap-1 rounded-lg border border-transparent px-3 py-2 hover:border-black/[0.05] hover:bg-black/[0.025]"
                >
                  <Link href={item.href} className="flex min-w-0 flex-1 items-start gap-2">
                    <Icon
                      size={14}
                      className="mt-0.5 shrink-0 text-text-muted group-hover:text-text-primary"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-text-secondary group-hover:text-text-primary">
                        {displayTitle(item.title)}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-text-muted">
                        {item.kind}
                        {item.status ? ` - ${statusLabel(item.status)}` : ""}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    {item.kind === "Task" && canStopTask(item.status) && (
                      <button
                        type="button"
                        onClick={() => void stopTask({ directiveId: item.id as Id<"directives"> })}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-black/[0.05] hover:text-text-primary"
                        aria-label="Stop task"
                      >
                        <PauseCircle size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (item.kind === "Chat") {
                          void deleteChat({ sessionId: item.id as Id<"chatSessions"> });
                        } else {
                          void deleteTask({ directiveId: item.id as Id<"directives"> });
                        }
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-red-50 hover:text-red-600"
                      aria-label={item.kind === "Chat" ? "Delete chat" : "Delete task"}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-auto hidden border-t border-black/[0.05] pt-4 lg:block px-3">
        {accountReady ? (
          <div className="relative" ref={popoverRef}>
            {/* Profile Popover */}
            {popoverOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-black/[0.06] bg-white p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="px-1 py-1.5">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Account</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary truncate">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-text-muted truncate">
                    {user.email}
                  </p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold mt-3">Business</p>
                  <p className="mt-1 text-xs font-semibold text-text-primary truncate">
                    {user.businessName || "FounderOS"}
                  </p>
                </div>
                <div className="h-px bg-black/[0.06] my-2" />
                <button
                  type="button"
                  onClick={async () => {
                    setPopoverOpen(false);
                    try {
                      await authClient.signOut();
                    } catch (e) {
                      console.error("Sign out error", e);
                    }
                    window.location.reload();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 transition duration-150"
                >
                  <LogOut size={13} />
                  <span>Sign out</span>
                </button>
              </div>
            )}

            {/* Profile & Settings row */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPopoverOpen(!popoverOpen)}
                className="flex items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition hover:bg-black/[0.03] active:scale-[0.98] outline-none group min-w-0 flex-1 mr-2"
                aria-label="User menu"
              >
                <div className="h-10 w-10 rounded-full border border-black/[0.08] overflow-hidden bg-zinc-100 flex items-center justify-center shrink-0">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || "U")}`;
                      }}
                    />
                  ) : (
                    <span className="text-sm font-bold text-text-muted">
                      {(user.name || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text-primary group-hover:text-black leading-tight">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-text-muted mt-0.5 font-medium">
                    {user.businessName || "FounderOS"}
                  </p>
                </div>
              </button>

              <Link
                href="/settings"
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-text-muted transition hover:bg-black/[0.035] hover:text-text-primary shrink-0 ${
                  pathname === "/settings"
                    ? "border-black/10 bg-white text-text-primary shadow-sm"
                    : "border-transparent"
                }`}
                title="Settings"
              >
                <Settings size={17} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-2.5 flex-1 mr-2">
              <div className="h-10 w-10 rounded-full bg-black/[0.04] animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 w-20 bg-black/[0.04] rounded animate-pulse" />
                <div className="h-2.5 w-16 bg-black/[0.04] rounded animate-pulse" />
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-black/[0.04] animate-pulse" />
          </div>
        )}
      </div>
    </nav>
  );
}
