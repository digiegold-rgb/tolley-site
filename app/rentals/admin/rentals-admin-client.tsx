"use client";

import { useEffect, useState } from "react";
import { RENTAL_ITEMS } from "@/lib/rental";

interface Booking {
  id: string;
  customerName: string;
  phone: string;
  item: string;
  startDate: string;
  endDate: string;
  notes: string;
  returned: boolean;
  createdAt: string;
}

const ITEM_NAMES = RENTAL_ITEMS.map((r) => r.name);

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function RentalsAdminClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    item: ITEM_NAMES[0] ?? "",
    startDate: dateStr(today),
    endDate: dateStr(today),
    notes: "",
  });

  async function loadBookings() {
    try {
      const res = await fetch("/api/rentals/bookings");
      if (!res.ok) { setError("Failed to load bookings."); return; }
      const data = await res.json();
      setBookings(data);
    } catch {
      setError("Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBookings(); }, []);

  async function markReturned(id: string) {
    await fetch(`/api/rentals/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returned: true }),
    });
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, returned: true } : b));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/rentals/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setError("Failed to save booking."); return; }
      const newBooking = await res.json();
      setBookings((prev) => [...prev, newBooking]);
      setForm({ customerName: "", phone: "", item: ITEM_NAMES[0] ?? "", startDate: dateStr(today), endDate: dateStr(today), notes: "" });
    } finally {
      setSaving(false);
    }
  }

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDow = getFirstDayOfWeek(calYear, calMonth);
  const monthName = new Date(calYear, calMonth, 1).toLocaleString("default", { month: "long" });

  const activeDays = new Set<number>();
  for (const b of bookings) {
    if (b.returned) continue;
    const start = new Date(b.startDate + "T00:00:00");
    const end = new Date(b.endDate + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        activeDays.add(d.getDate());
      }
    }
  }

  const activeBookings = bookings.filter((b) => !b.returned);
  const pastBookings = bookings.filter((b) => b.returned);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Calendar */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
            className="rounded-lg px-3 py-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            ‹
          </button>
          <h2 className="text-lg font-semibold text-white">{monthName} {calYear}</h2>
          <button
            onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
            className="rounded-lg px-3 py-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="py-1 font-semibold text-white/40">{d}</div>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate();
            const hasBooking = activeDays.has(day);
            return (
              <div
                key={day}
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                  isToday ? "bg-blue-600 text-white" :
                  hasBooking ? "bg-emerald-600/30 text-emerald-300 ring-1 ring-emerald-500/40" :
                  "text-white/60 hover:bg-white/5"
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-white/40">
          <span className="inline-block h-3 w-3 rounded bg-emerald-600/30 ring-1 ring-emerald-500/40 mr-1 align-middle" />
          Days with active rentals
        </p>
      </section>

      {/* Active Rentals */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <h2 className="mb-4 text-lg font-semibold text-white">Active Rentals</h2>
        {loading ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : activeBookings.length === 0 ? (
          <p className="text-sm text-white/40">No active rentals.</p>
        ) : (
          <div className="space-y-3">
            {activeBookings.map((b) => (
              <div key={b.id} className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">{b.customerName}</p>
                  <p className="text-sm text-white/60">{b.item} — {b.startDate} → {b.endDate}</p>
                  {b.phone && <p className="text-xs text-white/40">{b.phone}</p>}
                  {b.notes && <p className="text-xs text-white/40 italic">{b.notes}</p>}
                </div>
                <button
                  onClick={() => markReturned(b.id)}
                  className="shrink-0 rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 transition-colors"
                >
                  Mark Returned
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add Booking Form */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <h2 className="mb-4 text-lg font-semibold text-white">Add New Booking</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/60">Customer Name *</label>
            <input
              required
              value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-blue-500 focus:outline-none"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/60">Phone</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-blue-500 focus:outline-none"
              placeholder="(816) 555-0100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/60">Item Rented *</label>
            <select
              required
              value={form.item}
              onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {ITEM_NAMES.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/60">Start Date *</label>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-white/60">Expected Return Date *</label>
            <input
              type="date"
              required
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-white/60">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-blue-500 focus:outline-none"
              placeholder="Delivery address, deposit amount, special instructions…"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Add Booking"}
            </button>
          </div>
        </form>
      </section>

      {/* Past Rentals */}
      {pastBookings.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold text-white/60">Returned Rentals</h2>
          <div className="space-y-2">
            {pastBookings.map((b) => (
              <div key={b.id} className="flex flex-col gap-1 rounded-xl border border-white/5 bg-white/3 px-4 py-3 opacity-60 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white/70">{b.customerName}</p>
                  <p className="text-xs text-white/40">{b.item} — {b.startDate} → {b.endDate}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-white/50">Returned</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
