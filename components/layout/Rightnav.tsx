"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CodeInterventionModal } from "@/components/modals/code-intervention-modal";

// Derive the approval type from the query return
type Approval = NonNullable<ReturnType<typeof useQuery<typeof api.approvals.getPending>>>[number];

export function Rightnav() {
  const [activeTab, setActiveTab] = useState<"inbox" | "logs">("inbox");

  return (
    <aside className="flex h-full w-80 flex-col border-l border-zinc-200 bg-white">
      {/* Tabs / Header */}
      <div className="flex border-b border-zinc-200 p-2">
        <div className="flex w-full rounded-sm bg-zinc-100 p-1">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm py-1.5 text-xs font-semibold ${
              activeTab === "inbox" ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-black"
            }`}
          >
            Inbox
            <InboxCount />
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-sm py-1.5 text-xs font-semibold ${
              activeTab === "logs" ? "bg-white text-black shadow-sm" : "text-zinc-500 hover:text-black"
            }`}
          >
            Logs
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto w-full">
        {activeTab === "inbox" ? <InboxView /> : <LogsView />}
      </div>
    </aside>
  );
}

// Live badge count to avoid re-rendering the whole nav
function InboxCount() {
  const approvals = useQuery(api.approvals.getPending);
  const count = approvals?.length ?? 0;
  if (count === 0) return null;
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] text-white">
      {count}
    </span>
  );
}

function InboxView() {
  const approvals = useQuery(api.approvals.getPending);
  const workspaces = useQuery(api.workspaces.get);
  const processMutation = useMutation(api.approvals.process);

  const workspaceId = workspaces?.[0]?._id as Id<"workspaces"> | undefined;
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  const handleProcess = async (taskId: Id<"approval_queue">, newStatus: "Approved" | "Denied") => {
    if (!workspaceId) return;
    await processMutation({ taskId, newStatus, workspaceId, actorId: "human_admin" });
  };

  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        {/* Loading skeleton */}
        {approvals === undefined && (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-sm border border-zinc-100 p-4 animate-pulse">
              <div className="h-3 w-16 rounded-sm bg-zinc-200" />
              <div className="h-4 w-48 rounded-sm bg-zinc-200" />
              <div className="h-3 w-full rounded-sm bg-zinc-100" />
              <div className="flex gap-2">
                <div className="flex-1 h-7 rounded-sm bg-zinc-100" />
                <div className="flex-1 h-7 rounded-sm bg-zinc-200" />
              </div>
            </div>
          ))
        )}

        {/* Live approval cards */}
        {approvals?.map((app) => (
          <ApprovalCard
            key={app._id}
            data={app}
            onClick={() => setSelectedApproval(app)}
            onApprove={(e) => { e.stopPropagation(); handleProcess(app._id, "Approved"); }}
            onDeny={(e) => { e.stopPropagation(); handleProcess(app._id, "Denied"); }}
          />
        ))}

        {/* Empty state */}
        {approvals !== undefined && approvals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400 gap-2">
            <p className="text-sm font-medium">Inbox clear.</p>
            <p className="text-xs">No pending approvals.</p>
          </div>
        )}
      </div>

      {selectedApproval && (
        <CodeInterventionModal
          title={selectedApproval.title}
          agentName={selectedApproval.agentName}
          agentRole={selectedApproval.agentRole}
          justification={selectedApproval.justification}
          proposedPayload={selectedApproval.proposedPayload}
          onApprove={() => handleProcess(selectedApproval._id, "Approved")}
          onDeny={() => handleProcess(selectedApproval._id, "Denied")}
          onClose={() => setSelectedApproval(null)}
        />
      )}
    </>
  );
}

function ApprovalCard({
  data,
  onClick,
  onApprove,
  onDeny,
}: {
  data: Approval;
  onClick: () => void;
  onApprove: (e: React.MouseEvent) => void;
  onDeny: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex flex-col gap-3 rounded-sm border border-zinc-200 bg-white p-4 shadow-sm hover:border-black transition-colors cursor-pointer group"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black border border-zinc-200">
            L{data.agentName ? "3" : "2"} Gate
          </span>
          <span className="text-[10px] font-mono font-medium text-zinc-400">{data.agentName}</span>
        </div>
        <h4 className="text-sm font-semibold text-black group-hover:underline underline-offset-2 leading-tight mt-1">
          {data.title}
        </h4>
      </div>

      <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
        {data.description}
      </p>

      {/* Inline Actions */}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={onDeny}
          className="flex-1 rounded-sm border border-zinc-200 bg-transparent py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-black transition-all active:scale-95"
        >
          Deny
        </button>
        <button
          onClick={onApprove}
          className="flex-1 rounded-sm bg-black py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-all active:scale-95"
        >
          Approve
        </button>
      </div>
    </div>
  );
}

function LogsView() {
  const history = useQuery(api.intelligence.getHistory);

  return (
    <div className="flex flex-col gap-2 p-4 font-mono text-sm text-zinc-600">
      {history === undefined && (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1 border-b border-zinc-100 pb-2 animate-pulse">
            <div className="h-2 w-16 rounded-sm bg-zinc-200" />
            <div className="h-3 w-full rounded-sm bg-zinc-100" />
          </div>
        ))
      )}

      {history?.map((log) => (
        <div key={log._id} className="flex flex-col gap-0.5 border-b border-zinc-100 pb-2 last:border-0 hover:bg-zinc-50 p-1 rounded-sm">
          <span className="text-[10px] text-zinc-400">
            {new Date(log.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="break-words text-xs">&gt; {log.displayLabel}</span>
        </div>
      ))}

      {history !== undefined && history.length === 0 && (
        <div className="text-xs text-zinc-400 py-4">No events logged yet.</div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-400"></span>
        </span>
        Awaiting events...
      </div>
    </div>
  );
}
