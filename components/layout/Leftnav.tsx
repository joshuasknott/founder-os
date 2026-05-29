"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Home,
  Library,
  ListTodo,
  MessageSquare,
  Plus,
  Settings,
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

export function Leftnav() {
  const pathname = usePathname();
  const recentWork = useQuery(api.directives.getRecentDirectives);
  const recentChats = useQuery(api.chat.getSessions);

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
          <p className="mt-0.5 text-xs font-medium text-text-muted">AI company workspace</p>
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 px-2 lg:flex-col lg:flex-nowrap lg:px-0">
        <NavItem href="/" icon={Home} label="Home" pathname={pathname} />
        <NavItem href="/library" icon={Library} label="Library" pathname={pathname} />
        <div className="lg:hidden">
          <NavItem href="/settings" icon={Settings} label="Settings" pathname={pathname} />
        </div>
      </div>

      <div className="mt-6 hidden min-h-0 flex-1 flex-col lg:flex">
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
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.href}
                  className="group rounded-lg border border-transparent px-3 py-2 hover:border-black/[0.05] hover:bg-black/[0.025]"
                >
                  <div className="flex items-start gap-2">
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
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-auto hidden border-t border-black/[0.05] pt-4 lg:block">
        <NavItem href="/settings" icon={Settings} label="Settings" pathname={pathname} />
      </div>
    </nav>
  );
}
