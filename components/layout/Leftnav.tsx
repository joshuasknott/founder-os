"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BrainCircuit, Users, Settings, MessageSquare } from "lucide-react";

export function Leftnav() {
  const pathname = usePathname();

  const NavItem = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => {
    const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-none ${
          isActive
            ? "border-l-4 border-black bg-zinc-100 font-semibold text-black"
            : "border-l-4 border-transparent font-medium text-zinc-600 hover:bg-zinc-100 hover:text-black"
        }`}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <nav className="flex h-full w-64 flex-col border-r border-zinc-200 bg-white sm:bg-zinc-50 py-4">
      {/* Header */}
      <div className="mb-8 px-4 flex items-center">
        <h1 className="text-lg font-bold tracking-tight text-black">FounderOS</h1>
      </div>

      {/* Zone 1 (Top) */}
      <div className="flex flex-col gap-1">
        <NavItem href="/" icon={<LayoutDashboard size={18} />} label="Boardroom" />
        <NavItem href="/intelligence" icon={<BrainCircuit size={18} />} label="Intelligence" />
        <NavItem href="/team" icon={<Users size={18} />} label="Team" />
      </div>

      {/* Zone 2 (Middle) */}
      <div className="flex-1 flex flex-col overflow-y-auto mt-6">
        <div className="px-5 mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Recent Sessions</h2>
        </div>
        <div className="flex flex-col gap-1 px-3">
          <Link href="#" className="flex items-center gap-2 px-2 py-1 text-sm text-zinc-600 truncate hover:text-black hover:bg-zinc-100 rounded transition-colors group">
            <MessageSquare size={14} className="opacity-50 shrink-0 group-hover:opacity-100 transition-opacity" />
            <span className="truncate">Database Migration Plan</span>
          </Link>
          <Link href="#" className="flex items-center gap-2 px-2 py-1 text-sm text-zinc-600 truncate hover:text-black hover:bg-zinc-100 rounded transition-colors group">
            <MessageSquare size={14} className="opacity-50 shrink-0 group-hover:opacity-100 transition-opacity" />
            <span className="truncate">Q3 Marketing Strategy</span>
          </Link>
          <Link href="#" className="flex items-center gap-2 px-2 py-1 text-sm text-zinc-600 truncate hover:text-black hover:bg-zinc-100 rounded transition-colors group">
            <MessageSquare size={14} className="opacity-50 shrink-0 group-hover:opacity-100 transition-opacity" />
            <span className="truncate">Frontend Architecture Audit</span>
          </Link>
        </div>
      </div>

      {/* Zone 3 (Bottom) */}
      <div className="mt-auto pt-4 flex flex-col">
        <NavItem href="/settings" icon={<Settings size={18} />} label="Settings" />
      </div>
    </nav>
  );
}
