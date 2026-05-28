"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Terminal, BookOpen, Settings, MessageSquare, Plus, Zap } from "lucide-react";

export function Leftnav() {
  const pathname = usePathname();
  const sessions = useQuery(api.chat.getSessions);

  const NavItem = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => {
    const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 mx-3 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-accent/8 text-accent font-semibold shadow-sm shadow-accent/5 border border-accent/10"
            : "text-text-secondary border border-transparent hover:bg-black/[0.02] hover:text-text-primary active:scale-[0.98]"
        }`}
      >
        <span className={`transition-transform duration-200 ${isActive ? "scale-105 text-accent" : "opacity-70 group-hover:opacity-100"}`}>
          {icon}
        </span>
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <nav className="flex h-full w-60 flex-col border-r border-black/[0.04] bg-white/45 backdrop-blur-2xl py-6 shrink-0 z-20">
      {/* Header / Logo */}
      <div className="mb-6 px-6">
        <h1 className="text-base font-bold tracking-tight text-text-primary antialiased">FounderOS</h1>
        <p className="text-[9px] font-semibold text-text-muted tracking-widest uppercase mt-0.5">Control Center</p>
      </div>

      {/* Primary Navigation */}
      <div className="flex flex-col gap-1">
        <NavItem href="/" icon={<Terminal size={16} />} label="Command" />
        <NavItem href="/context" icon={<BookOpen size={16} />} label="Context" />
      </div>

      {/* Recent Sessions */}
      <div className="flex-1 flex flex-col overflow-y-auto mt-6">
        <div className="px-6 mb-2 flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Sessions</h2>
        </div>
        <div className="flex flex-col gap-1 px-3">
          {sessions === undefined ? (
            // Loading skeleton
            <div className="flex flex-col gap-2 px-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-7 rounded-lg bg-black/[0.02] animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-text-muted">No sessions yet</p>
          ) : (
            sessions.map((session) => {
              const sessionHref = `/?session=${session._id}`;
              const isSessionActive = pathname === "/" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("session") === session._id;
              
              return (
                <Link
                  key={session._id}
                  href={sessionHref}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 group active:scale-[0.98] ${
                    isSessionActive
                      ? "bg-black/[0.03] text-text-primary font-medium"
                      : "text-text-secondary hover:text-text-primary hover:bg-black/[0.015]"
                  }`}
                >
                  <MessageSquare size={13} className={`shrink-0 transition-opacity ${
                    isSessionActive ? "text-accent opacity-90" : "opacity-40 group-hover:opacity-75"
                  }`} />
                  <span className="truncate text-xs">{session.title}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Settings Link */}
      <div className="mt-auto pt-4 flex flex-col gap-1 border-t border-black/[0.03]">
        <NavItem href="/settings" icon={<Settings size={16} />} label="Settings" />
      </div>
    </nav>
  );
}
