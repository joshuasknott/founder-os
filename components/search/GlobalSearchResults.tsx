"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  FileClock,
  FileText,
  Lightbulb,
  MessageSquareText,
  Shapes,
  type LucideIcon,
} from "lucide-react";

export type GlobalSearchResult = {
  id: string;
  groupId: string;
  title: string;
  excerpt: string;
  label: string;
  href?: string;
  targetType: string;
  targetId: string;
  itemId?: string;
  updatedAt: number;
};

export type GlobalSearchGroup = {
  id: string;
  label: string;
  results: GlobalSearchResult[];
};

export type GlobalSearchData = {
  query: string;
  totalCount: number;
  groups: GlobalSearchGroup[];
};

const groupIcons: Record<string, LucideIcon> = {
  library: FileText,
  versions: FileClock,
  chats: MessageSquareText,
  tasks: BriefcaseBusiness,
  work: BriefcaseBusiness,
  facts: BookOpen,
  entities: Shapes,
};

function cleanDisplayText(value: string) {
  return value
    .replace(/\bRAG\b|\bAI Router\b|\bTOOL_INVOCATION\b/gi, "")
    .replace(/\bartifact(s)?\b/gi, "Library item$1")
    .replace(/\boperator(s)?\b/gi, "worker$1")
    .replace(/\s+/g, " ")
    .trim();
}

function ResultShell({
  result,
  children,
}: {
  result: GlobalSearchResult;
  children: ReactNode;
}) {
  if (!result.href) {
    return <div className="rounded-lg px-2 py-2">{children}</div>;
  }

  return (
    <Link href={result.href} className="block rounded-lg px-2 py-2 transition hover:bg-surface">
      {children}
    </Link>
  );
}

export function GlobalSearchResults({
  data,
  compact = false,
  maxPerGroup = 4,
}: {
  data?: GlobalSearchData | null;
  compact?: boolean;
  maxPerGroup?: number;
}) {
  if (!data) return null;

  return (
    <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Lightbulb size={15} className="shrink-0 text-text-muted" />
          <h2 className="truncate text-sm font-semibold text-text-primary">
            {data.totalCount ? "Found in FounderOS" : "No workspace matches"}
          </h2>
        </div>
        <span className="shrink-0 text-xs text-text-muted">{data.totalCount}</span>
      </div>

      {data.groups.length === 0 ? (
        <p className="text-sm leading-6 text-text-secondary">Try a person, company, task, phrase, or saved item title.</p>
      ) : (
        <div className={compact ? "space-y-3" : "grid gap-4 lg:grid-cols-2"}>
          {data.groups.map((group) => {
            const Icon = groupIcons[group.id] ?? FileText;
            const results = group.results.slice(0, maxPerGroup);
            return (
              <div key={group.id} className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2 px-2">
                  <Icon size={14} className="text-text-muted" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">{group.label}</h3>
                </div>
                <div className="space-y-1">
                  {results.map((result) => (
                    <ResultShell key={result.id} result={result}>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-semibold text-text-primary">{cleanDisplayText(result.title)}</p>
                          <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                            {cleanDisplayText(result.label)}
                          </span>
                        </div>
                        {result.excerpt && (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-text-secondary">
                            {cleanDisplayText(result.excerpt)}
                          </p>
                        )}
                      </div>
                    </ResultShell>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
