"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  CalendarClock,
  Loader2,
  PauseCircle,
  Plus,
  Trash2,
} from "lucide-react";

function formatScheduleTime(item: Doc<"scheduleItems">) {
  const cadence = item.cadence === "daily"
    ? "Every day"
    : item.cadence === "weekdays"
      ? "Weekdays"
      : item.cadence === "weekly"
        ? "Weekly"
        : "Once";

  return `${cadence} at ${new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(item.startAt))}`;
}

function startAtFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 6, minutes || 0, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date.getTime();
}

export default function SchedulesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SchedulesPageContent />
    </Suspense>
  );
}

function SchedulesPageContent() {
  const schedules = useQuery(api.automations.list) as Doc<"scheduleItems">[] | undefined;
  const createSchedule = useMutation(api.automations.create);
  const stopSchedule = useMutation(api.automations.pause);
  const deleteSchedule = useMutation(api.automations.remove);

  const [title, setTitle] = useState("Send me priorities");
  const [prompt, setPrompt] = useState("Send me my priorities for the day.");
  const [time, setTime] = useState("06:00");
  const [cadence, setCadence] = useState<"daily" | "weekdays" | "weekly">("daily");
  const [status, setStatus] = useState<string | null>(null);

  const saveSchedule = async () => {
    if (!title.trim() || !prompt.trim()) return;
    await createSchedule({
      title: title.trim(),
      prompt: prompt.trim(),
      startAt: startAtFromTime(time),
      cadence,
    });
    setStatus("Schedule saved.");
  };

  const stop = async (scheduleId: Id<"scheduleItems">) => {
    await stopSchedule({ automationId: scheduleId });
    setStatus("Schedule stopped.");
  };

  const remove = async (scheduleId: Id<"scheduleItems">) => {
    await deleteSchedule({ automationId: scheduleId });
    setStatus("Schedule deleted.");
  };

  if (!schedules) return <PageLoader />;

  return (
    <div className="min-h-full px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Library
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
              Schedules
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              Manage recurring requests like morning priorities, weekly summaries, and follow-ups.
            </p>
          </div>
          {status && <p className="text-xs font-medium text-text-secondary">{status}</p>}
        </header>

        <section className="rounded-lg border border-black/[0.06] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Plus size={16} />
            <h2 className="text-sm font-semibold text-text-primary">Add Schedule</h2>
          </div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Send me priorities"
            className="h-10 w-full rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
          />
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="What should FounderOS send or prepare?"
            className="mt-2 min-h-24 w-full resize-none rounded-lg border border-black/[0.07] bg-surface px-3 py-2 text-sm leading-6 outline-none focus:border-black/20 focus:bg-white"
          />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
            <select
              value={cadence}
              onChange={(event) => setCadence(event.target.value as "daily" | "weekdays" | "weekly")}
              className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
              aria-label="Schedule frequency"
            >
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="h-10 rounded-lg border border-black/[0.07] bg-surface px-3 text-sm outline-none focus:border-black/20 focus:bg-white"
              aria-label="Schedule time"
            />
          </div>
          <button
            onClick={() => void saveSchedule()}
            disabled={!title.trim() || !prompt.trim()}
            className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <CalendarClock size={15} />
            Save schedule
          </button>
        </section>

        <section className="overflow-hidden rounded-lg border border-black/[0.06] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/[0.05] px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Active Schedules</h2>
            <span className="text-xs text-text-muted">{schedules.length}</span>
          </div>
          {schedules.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarClock size={18} className="mx-auto text-text-muted" />
              <p className="mt-3 text-sm font-semibold text-text-primary">No schedules yet</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                Add a recurring request above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {schedules.map((item) => (
                <div key={item._id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface/70">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-surface">
                    <CalendarClock size={16} className="text-text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{formatScheduleTime(item)}</p>
                    {item.prompt && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{item.prompt}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void stop(item._id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-black/[0.04] hover:text-text-primary"
                    aria-label="Stop schedule"
                  >
                    <PauseCircle size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(item._id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete schedule"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 size={18} className="animate-spin text-text-muted" />
    </div>
  );
}
