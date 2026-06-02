"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Brain, Loader2, Pencil, Plus, RefreshCcw, Save, Trash2, X } from "lucide-react";

type MemoryType = Doc<"memoryEntries">["type"];
type MemorySensitivity = Doc<"memoryEntries">["sensitivity"];

const typeOptions: Array<{ value: MemoryType; label: string }> = [
  { value: "founder_preference", label: "Working preference" },
  { value: "business_fact", label: "Business fact" },
  { value: "decision", label: "Decision" },
  { value: "recurring_workflow", label: "Recurring workflow" },
  { value: "person", label: "Person" },
  { value: "company", label: "Company" },
  { value: "product", label: "Product" },
  { value: "reusable_context", label: "Reusable context" },
];

const sensitivityLabels: Record<MemorySensitivity, string> = {
  public: "Shareable",
  internal: "Internal",
  confidential: "Private",
  sensitive: "Sensitive",
};

function typeLabel(type: MemoryType) {
  return typeOptions.find((option) => option.value === type)?.label ?? type.replace(/_/g, " ");
}

export function RememberedDetailsSettings() {
  const settings = useQuery(api.memory.getSettings);
  const details = useQuery(api.memory.listRememberedDetails, {});
  const updateSettings = useMutation(api.memory.updateSettings);
  const rememberDetail = useMutation(api.memory.rememberDetail);
  const updateDetail = useMutation(api.memory.updateDetail);
  const deleteDetail = useMutation(api.memory.deleteDetail);
  const rescanWorkspace = useMutation(api.memory.rescanWorkspace);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"memoryEntries"> | null>(null);
  const [type, setType] = useState<MemoryType>("business_fact");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [sensitivity, setSensitivity] = useState<MemorySensitivity>("internal");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const resetEditor = () => {
    setAdding(false);
    setEditingId(null);
    setType("business_fact");
    setLabel("");
    setValue("");
    setSensitivity("internal");
  };

  const startEditing = (detail: Doc<"memoryEntries">) => {
    setAdding(false);
    setEditingId(detail._id);
    setType(detail.type);
    setLabel(detail.label);
    setValue(detail.value);
    setSensitivity(detail.sensitivity);
    setMessage("");
  };

  const saveDetail = async () => {
    if (!label.trim() || !value.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      if (editingId) {
        await updateDetail({
          memoryId: editingId,
          type,
          label: label.trim(),
          value: value.trim(),
          sensitivity,
        });
        setMessage("Remembered detail updated.");
      } else {
        await rememberDetail({
          type,
          label: label.trim(),
          value: value.trim(),
          sensitivity,
        });
        setMessage("Detail remembered.");
      }
      resetEditor();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save that detail.");
    } finally {
      setSaving(false);
    }
  };

  const removeDetail = async (memoryId: Id<"memoryEntries">) => {
    await deleteDetail({ memoryId });
    if (editingId === memoryId) resetEditor();
    setMessage("Remembered detail deleted.");
  };

  const refreshFromLibrary = async () => {
    setRefreshing(true);
    setMessage("");
    try {
      const queued = await rescanWorkspace({});
      setMessage(`Refreshing from ${queued.itemCount} Library items and ${queued.runCount} completed tasks.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh remembered details.");
    } finally {
      setRefreshing(false);
    }
  };

  if (settings === undefined || details === undefined) {
    return (
      <div className="mt-12 flex max-w-2xl items-center gap-2 rounded-lg border border-black/[0.06] bg-white p-5 shadow-sm">
        <Loader2 size={15} className="animate-spin text-text-muted" />
        <p className="text-sm text-text-secondary">Opening remembered details</p>
      </div>
    );
  }

  return (
    <section className="mt-12 max-w-2xl">
      <div className="rounded-lg border border-black/[0.06] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Brain size={16} />
              <h2 className="text-sm font-semibold text-text-primary">Remembered details</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              FounderOS keeps useful business details in mind for future work. Secrets are never saved here.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-text-secondary">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => void updateSettings({ enabled: event.target.checked })}
              className="h-4 w-4 rounded border-black/20"
            />
            Use remembered details
          </label>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-black/[0.06] pt-4">
          <p className="text-xs leading-5 text-text-muted">
            You can review, correct, or remove any detail. Sensitive details stay out of automatic task context.
          </p>
          <div className="ml-4 flex shrink-0 gap-2">
            <button type="button" onClick={() => void refreshFromLibrary()} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-text-secondary disabled:opacity-40">
              {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                resetEditor();
                setAdding(true);
                setMessage("");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"
            >
              <Plus size={13} />
              Add detail
            </button>
          </div>
        </div>

        {(adding || editingId) && (
          <div className="mt-4 space-y-3 rounded-lg border border-black/[0.06] bg-surface p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={type}
                onChange={(event) => setType(event.target.value as MemoryType)}
                className="h-10 rounded-lg border border-black/[0.07] bg-white px-3 text-sm outline-none"
                aria-label="Detail type"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={sensitivity}
                onChange={(event) => setSensitivity(event.target.value as MemorySensitivity)}
                className="h-10 rounded-lg border border-black/[0.07] bg-white px-3 text-sm outline-none"
                aria-label="Detail privacy"
              >
                {Object.entries(sensitivityLabels).map(([key, text]) => (
                  <option key={key} value={key}>{text}</option>
                ))}
              </select>
            </div>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Short label, such as Writing style"
              className="h-10 w-full rounded-lg border border-black/[0.07] bg-white px-3 text-sm outline-none"
            />
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="What should FounderOS remember?"
              className="min-h-24 w-full resize-y rounded-lg border border-black/[0.07] bg-white px-3 py-2 text-sm leading-6 outline-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetEditor} className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-text-secondary">
                <X size={13} />
                Cancel
              </button>
              <button type="button" onClick={() => void saveDetail()} disabled={saving || !label.trim() || !value.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-30">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
            </div>
          </div>
        )}

        {message && <p className="mt-3 text-xs font-medium text-text-secondary">{message}</p>}

        <div className="mt-4 divide-y divide-black/[0.05]">
          {details.length === 0 ? (
            <p className="py-4 text-sm text-text-secondary">Nothing remembered yet.</p>
          ) : details.map((detail) => (
            <div key={detail._id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">{detail.label}</p>
                  <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    {typeLabel(detail.type)}
                  </span>
                  <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    {sensitivityLabels[detail.sensitivity]}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-5 text-text-secondary">{detail.value}</p>
              </div>
              <button type="button" onClick={() => startEditing(detail)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface hover:text-text-primary" aria-label="Edit remembered detail">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => void removeDetail(detail._id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-red-600" aria-label="Delete remembered detail">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
