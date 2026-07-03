"use client";

import { useState, useEffect, useMemo } from "react";

interface Showing {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  address: string;
  clientName: string;
  type: ShowingType;
  notes: string;
  duration: number; // minutes
  status: "upcoming" | "completed" | "canceled";
  feedback?: string;
}

type ShowingType = "Buyer Tour" | "Listing Appointment" | "Open House" | "Inspection" | "Closing" | "Other";

const SHOWING_TYPES: ShowingType[] = ["Buyer Tour", "Listing Appointment", "Open House", "Inspection", "Closing", "Other"];

const TYPE_COLORS: Record<ShowingType, string> = {
  "Buyer Tour": "bg-blue-500/20 border-blue-500/30 text-blue-400",
  "Listing Appointment": "bg-orange-500/20 border-orange-500/30 text-orange-400",
  "Open House": "bg-purple-500/20 border-purple-500/30 text-purple-400",
  "Inspection": "bg-yellow-500/20 border-yellow-500/30 text-yellow-400",
  "Closing": "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
  "Other": "bg-white/10 border-white/20 text-white/60",
};

const TYPE_BLOCK_COLORS: Record<ShowingType, string> = {
  "Buyer Tour": "bg-blue-500/30 border-l-blue-400",
  "Listing Appointment": "bg-orange-500/30 border-l-orange-400",
  "Open House": "bg-purple-500/30 border-l-purple-400",
  "Inspection": "bg-yellow-500/30 border-l-yellow-400",
  "Closing": "bg-emerald-500/30 border-l-emerald-400",
  "Other": "bg-white/10 border-l-white/40",
};

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 20; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 20) slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

export default function ShowingsCalendar() {
  const [showings, setShowings] = useState<Showing[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("t-agent-showings") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("t-agent-showings", JSON.stringify(showings));
  }, [showings]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("10:00");
  const [formAddress, setFormAddress] = useState("");
  const [formClient, setFormClient] = useState("");
  const [formType, setFormType] = useState<ShowingType>("Buyer Tour");
  const [formNotes, setFormNotes] = useState("");
  const [formDuration, setFormDuration] = useState(60);

  const monday = useMemo(() => {
    const now = new Date();
    const mon = getMonday(now);
    mon.setDate(mon.getDate() + weekOffset * 7);
    return mon;
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [monday]);

  const sunday = weekDays[6];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayISO = formatDateISO(today);

  // Stats
  const stats = useMemo(() => {
    const weekStart = formatDateISO(monday);
    const weekEnd = formatDateISO(sunday);
    const next7Start = formatDateISO(today);
    const next7End = new Date(today);
    next7End.setDate(next7End.getDate() + 7);
    const next7EndISO = formatDateISO(next7End);

    const thisWeek = showings.filter((s) => s.date >= weekStart && s.date <= weekEnd);
    const completed = thisWeek.filter((s) => s.status === "completed").length;
    const canceled = thisWeek.filter((s) => s.status === "canceled").length;
    const upcoming = showings.filter((s) => s.date >= next7Start && s.date <= next7EndISO && s.status === "upcoming").length;

    return { thisWeek: thisWeek.length, completed, canceled, upcoming };
  }, [showings, monday, sunday, today]);

  // Upcoming list (next 7 days)
  const upcomingList = useMemo(() => {
    const next7End = new Date(today);
    next7End.setDate(next7End.getDate() + 7);
    const endISO = formatDateISO(next7End);

    return showings
      .filter((s) => s.date >= todayISO && s.date <= endISO && s.status === "upcoming")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [showings, todayISO]);

  function resetForm() {
    setFormDate("");
    setFormTime("10:00");
    setFormAddress("");
    setFormClient("");
    setFormType("Buyer Tour");
    setFormNotes("");
    setFormDuration(60);
    setEditId(null);
  }

  function saveShowing() {
    if (!formDate || !formAddress.trim() || !formClient.trim()) return;

    if (editId) {
      setShowings((prev) =>
        prev.map((s) =>
          s.id === editId
            ? { ...s, date: formDate, time: formTime, address: formAddress.trim(), clientName: formClient.trim(), type: formType, notes: formNotes, duration: formDuration }
            : s
        )
      );
    } else {
      const newShowing: Showing = {
        id: Date.now().toString(36),
        date: formDate,
        time: formTime,
        address: formAddress.trim(),
        clientName: formClient.trim(),
        type: formType,
        notes: formNotes,
        duration: formDuration,
        status: "upcoming",
      };
      setShowings((prev) => [...prev, newShowing]);
    }
    resetForm();
    setShowForm(false);
  }

  function startEdit(s: Showing) {
    setEditId(s.id);
    setFormDate(s.date);
    setFormTime(s.time);
    setFormAddress(s.address);
    setFormClient(s.clientName);
    setFormType(s.type);
    setFormNotes(s.notes);
    setFormDuration(s.duration);
    setShowForm(true);
  }

  function markComplete(id: string) {
    setFeedbackId(id);
    setFeedbackText("");
  }

  function submitFeedback() {
    if (!feedbackId) return;
    setShowings((prev) =>
      prev.map((s) => (s.id === feedbackId ? { ...s, status: "completed" as const, feedback: feedbackText } : s))
    );
    setFeedbackId(null);
    setFeedbackText("");
  }

  function cancelShowing(id: string) {
    setShowings((prev) => prev.map((s) => (s.id === id ? { ...s, status: "canceled" as const } : s)));
  }

  function deleteShowing(id: string) {
    setShowings((prev) => prev.filter((s) => s.id !== id));
  }

  function getShowingsForDay(dateISO: string): Showing[] {
    return showings
      .filter((s) => s.date === dateISO && s.status !== "canceled")
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  return (
    <section className="px-6 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <section>
          <h1 className="text-2xl font-bold text-white">Showings Calendar</h1>
          <p className="text-white/40 text-sm mt-1">Manage appointments, tours, and open houses</p>
        </section>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? "Cancel" : "+ Add Showing"}
        </button>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "This Week", value: stats.thisWeek },
          { label: "Completed", value: stats.completed },
          { label: "Canceled", value: stats.canceled },
          { label: "Upcoming (7d)", value: stats.upcoming },
        ].map((s) => (
          <article key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className="text-white text-lg font-semibold">{s.value}</p>
            <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
          </article>
        ))}
      </section>

      {/* Add/Edit form */}
      {showForm && (
        <section className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm">{editId ? "Edit Showing" : "Add Showing"}</h3>

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-white/40 text-xs font-medium">Date</span>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
              />
            </label>

            <label className="block">
              <span className="text-white/40 text-xs font-medium">Time</span>
              <select
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 [&>option]:bg-zinc-900"
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {formatTime12(t)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-white/40 text-xs font-medium">Type</span>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ShowingType)}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 [&>option]:bg-zinc-900"
              >
                {SHOWING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-white/40 text-xs font-medium">Property Address</span>
              <input
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="1204 S Liberty St, Independence, MO"
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
              />
            </label>

            <label className="block">
              <span className="text-white/40 text-xs font-medium">Client / Contact Name</span>
              <input
                value={formClient}
                onChange={(e) => setFormClient(e.target.value)}
                placeholder="John Smith"
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
              />
            </label>
          </section>

          <label className="block">
            <span className="text-white/40 text-xs font-medium">Notes</span>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={2}
              placeholder="Any special instructions or notes..."
              className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 resize-none"
            />
          </label>

          <fieldset>
            <legend className="text-white/40 text-xs font-medium mb-2">Duration</legend>
            <section className="flex gap-3">
              {[
                { label: "30 min", value: 30 },
                { label: "1 hr", value: 60 },
                { label: "2 hr", value: 120 },
              ].map((d) => (
                <label
                  key={d.value}
                  className={`px-4 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                    formDuration === d.value
                      ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/[0.08]"
                  }`}
                >
                  <input
                    type="radio"
                    name="duration"
                    checked={formDuration === d.value}
                    onChange={() => setFormDuration(d.value)}
                    className="sr-only"
                  />
                  {d.label}
                </label>
              ))}
            </section>
          </fieldset>

          <button
            onClick={saveShowing}
            disabled={!formDate || !formAddress.trim() || !formClient.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {editId ? "Update Showing" : "Save Showing"}
          </button>
        </section>
      )}

      {/* Feedback modal */}
      {feedbackId && (
        <section className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <section className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-white font-semibold">Complete Showing</h3>
            <label className="block">
              <span className="text-white/40 text-xs font-medium">Feedback / Notes</span>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={4}
                placeholder="How did it go? Client interested? Follow-up needed?"
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 resize-none"
              />
            </label>
            <section className="flex gap-3 justify-end">
              <button
                onClick={() => setFeedbackId(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Mark Complete
              </button>
            </section>
          </section>
        </section>
      )}

      {/* Weekly calendar */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-4">
        <header className="flex items-center justify-between mb-4">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors border border-white/10"
          >
            Prev
          </button>
          <p className="text-white font-medium text-sm">
            {formatDateShort(monday)} — {formatDateShort(sunday)}
          </p>
          <section className="flex gap-2">
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/40 text-xs rounded-lg transition-colors border border-white/10"
              >
                Today
              </button>
            )}
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-sm rounded-lg transition-colors border border-white/10"
            >
              Next
            </button>
          </section>
        </header>

        <section className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const iso = formatDateISO(day);
            const isToday = iso === todayISO;
            const dayShowings = getShowingsForDay(iso);
            const dayName = day.toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = day.getDate();

            return (
              <section
                key={iso}
                className={`min-h-[140px] rounded-lg border p-2 ${
                  isToday ? "border-blue-500/40 bg-blue-500/5" : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <p className={`text-xs font-medium mb-1.5 ${isToday ? "text-blue-400" : "text-white/40"}`}>
                  {dayName} <span className={isToday ? "text-blue-300" : "text-white/60"}>{dayNum}</span>
                </p>
                <section className="space-y-1">
                  {dayShowings.map((s) => (
                    <section
                      key={s.id}
                      className={`border-l-2 rounded-r px-1.5 py-1 cursor-default ${TYPE_BLOCK_COLORS[s.type]}`}
                      title={`${formatTime12(s.time)} - ${s.address} (${s.clientName})`}
                    >
                      <p className="text-[10px] text-white/70 font-medium">{formatTime12(s.time)}</p>
                      <p className="text-[10px] text-white/50 truncate">{s.address}</p>
                      <p className="text-[10px] text-white/30 truncate">{s.clientName}</p>
                    </section>
                  ))}
                </section>
              </section>
            );
          })}
        </section>
      </section>

      {/* Upcoming list */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Upcoming (Next 7 Days)</h2>
        {upcomingList.length > 0 ? (
          <section className="space-y-2">
            {upcomingList.map((s) => {
              const d = new Date(s.date + "T00:00:00");
              const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const durLabel = s.duration === 30 ? "30 min" : s.duration === 60 ? "1 hr" : "2 hr";

              return (
                <article key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 flex-wrap">
                  <section className="flex-1 min-w-0 flex items-center gap-4 flex-wrap">
                    <p className="text-white/60 text-sm font-medium w-28 shrink-0">{dayLabel}</p>
                    <p className="text-white text-sm font-medium w-20 shrink-0">{formatTime12(s.time)}</p>
                    <p className="text-white text-sm truncate flex-1 min-w-[120px]">{s.address}</p>
                    <p className="text-white/50 text-sm w-32 shrink-0 truncate">{s.clientName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 ${TYPE_COLORS[s.type]}`}>
                      {s.type}
                    </span>
                    <p className="text-white/30 text-xs shrink-0">{durLabel}</p>
                  </section>
                  <section className="flex gap-2 shrink-0">
                    <button
                      onClick={() => markComplete(s.id)}
                      className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium rounded-lg transition-colors border border-emerald-500/20"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => cancelShowing(s.id)}
                      className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors border border-red-500/20"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => startEdit(s)}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/50 text-xs font-medium rounded-lg transition-colors border border-white/10"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteShowing(s.id)}
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/30 text-xs font-medium rounded-lg transition-colors border border-white/10"
                    >
                      Delete
                    </button>
                  </section>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <p className="text-white/40 text-sm">No upcoming showings in the next 7 days.</p>
          </section>
        )}
      </section>
    </section>
  );
}
