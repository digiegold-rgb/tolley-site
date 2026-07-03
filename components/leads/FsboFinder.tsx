"use client";

import { useState } from "react";

interface FsboLead {
  id: string;
  source: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  contactedAt: string | null;
  closedAt: string | null;
  listing?: {
    address: string | null;
    city: string | null;
    zip: string | null;
    listPrice: number | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    photoUrls: string[];
    daysOnMarket: number | null;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400",
  contacted: "bg-yellow-500/20 text-yellow-400",
  interested: "bg-orange-500/20 text-orange-400",
  referred: "bg-purple-500/20 text-purple-400",
  closed: "bg-emerald-500/20 text-emerald-400",
  dead: "bg-red-500/20 text-red-400",
};

const SOURCE_OPTIONS = ["Zillow", "Facebook Marketplace", "Yard Sign", "Craigslist", "Neighbor Referral", "Other"];

const FSBO_TIPS = [
  "90% of FSBO sellers eventually list with an agent",
  "FSBO homes sell for an average of 23% less than agent-listed homes",
  "Best time to contact: 2-3 weeks after listing when initial enthusiasm fades",
  "Lead with value — offer a free CMA, mention your buyer network",
  "Never criticize their decision to sell by themselves",
];

export default function FsboFinder({ leads }: { leads: FsboLead[] }) {
  const [allLeads, setAllLeads] = useState<FsboLead[]>(leads);
  const [showForm, setShowForm] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    address: "",
    city: "",
    zip: "",
    ownerName: "",
    phone: "",
    email: "",
    askingPrice: "",
    source: "Zillow",
    notes: "",
  });

  const contacted = allLeads.filter((l) => l.status !== "new").length;
  const converted = allLeads.filter((l) => l.status === "closed").length;
  const conversionRate = allLeads.length > 0 ? ((converted / allLeads.length) * 100).toFixed(1) : "0";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "fsbo_manual",
          ownerName: form.ownerName,
          ownerPhone: form.phone,
          ownerEmail: form.email,
          notes: `Address: ${form.address}, ${form.city} ${form.zip}\nAsking: ${form.askingPrice}\nSource: ${form.source}\n${form.notes}`,
        }),
      });
      if (res.ok) {
        const newLead = await res.json();
        setAllLeads((prev) => [newLead, ...prev]);
        setForm({ address: "", city: "", zip: "", ownerName: "", phone: "", email: "", askingPrice: "", source: "Zillow", notes: "" });
        setShowForm(false);
      }
    } catch {
      /* fail silently */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-white">FSBO Finder</h1>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total FSBO Leads", value: allLeads.length },
          { label: "Contacted", value: contacted },
          { label: "Converted", value: converted },
          { label: "Conversion Rate", value: `${conversionRate}%` },
        ].map((stat) => (
          <article key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-white/40 mt-1">{stat.label}</p>
          </article>
        ))}
      </section>

      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors"
      >
        {showForm ? "Cancel" : "+ Add FSBO Lead"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
          <section className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs text-white/40 mb-1 block">Address</span>
              <input
                required
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20"
                placeholder="123 Main St"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/40 mb-1 block">City</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20"
                placeholder="Independence"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/40 mb-1 block">Zip</span>
              <input
                value={form.zip}
                onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20"
                placeholder="64055"
              />
            </label>
          </section>
          <section className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs text-white/40 mb-1 block">Owner Name</span>
              <input
                required
                value={form.ownerName}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20"
                placeholder="John Smith"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/40 mb-1 block">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20"
                placeholder="(816) 555-1234"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/40 mb-1 block">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20"
                placeholder="owner@email.com"
              />
            </label>
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-white/40 mb-1 block">Asking Price</span>
              <input
                value={form.askingPrice}
                onChange={(e) => setForm((f) => ({ ...f, askingPrice: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20"
                placeholder="$250,000"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/40 mb-1 block">Source</span>
              <select
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s} className="bg-neutral-900">
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <label className="block">
            <span className="text-xs text-white/40 mb-1 block">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/20 resize-y"
              placeholder="Any additional notes about this FSBO..."
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {submitting ? "Adding..." : "Add FSBO Lead"}
          </button>
        </form>
      )}

      {allLeads.length === 0 ? (
        <article className="bg-white/5 border border-white/10 rounded-xl p-8 text-center space-y-3">
          <p className="text-4xl">🏡</p>
          <h3 className="text-white font-semibold text-lg">No FSBO leads yet</h3>
          <p className="text-white/40 text-sm max-w-md mx-auto">
            Start building your FSBO pipeline by adding your first lead. Check Zillow, Facebook Marketplace, yard signs, and Craigslist for FSBO listings in your area.
          </p>
        </article>
      ) : (
        <section className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-xs">
                <th className="text-left px-4 py-3 font-medium">Address</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Owner</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Price</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Source</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {allLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLead(selectedLead === lead.id ? null : lead.id)}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-white">
                    {lead.listing?.address || lead.notes?.split("\n")[0]?.replace("Address: ", "") || "—"}
                  </td>
                  <td className="px-4 py-3 text-white/60 hidden sm:table-cell">{lead.ownerName || "—"}</td>
                  <td className="px-4 py-3 text-white/60 hidden md:table-cell">
                    {lead.listing?.listPrice ? `$${lead.listing.listPrice.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-white/40 hidden md:table-cell">{lead.source}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] || "bg-white/10 text-white/60"}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40 text-xs hidden lg:table-cell">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedLead && (() => {
            const lead = allLeads.find((l) => l.id === selectedLead);
            if (!lead) return null;
            return (
              <article className="border-t border-white/10 p-5 space-y-3 bg-white/[0.02]">
                <h4 className="text-white font-semibold">Lead Details</h4>
                <section className="grid gap-3 sm:grid-cols-2 text-sm">
                  <p><span className="text-white/40">Owner:</span> <span className="text-white ml-2">{lead.ownerName || "—"}</span></p>
                  <p><span className="text-white/40">Phone:</span> <span className="text-white ml-2">{lead.ownerPhone || "—"}</span></p>
                  <p><span className="text-white/40">Email:</span> <span className="text-white ml-2">{lead.ownerEmail || "—"}</span></p>
                  <p><span className="text-white/40">Source:</span> <span className="text-white ml-2">{lead.source}</span></p>
                  <p><span className="text-white/40">Status:</span> <span className="text-white ml-2">{lead.status}</span></p>
                  <p><span className="text-white/40">Added:</span> <span className="text-white ml-2">{new Date(lead.createdAt).toLocaleString()}</span></p>
                </section>
                {lead.listing && (
                  <section className="grid gap-3 sm:grid-cols-3 text-sm mt-2">
                    <p><span className="text-white/40">City:</span> <span className="text-white ml-2">{lead.listing.city || "—"}</span></p>
                    <p><span className="text-white/40">Beds/Baths:</span> <span className="text-white ml-2">{lead.listing.beds ?? "—"} / {lead.listing.baths ?? "—"}</span></p>
                    <p><span className="text-white/40">Sqft:</span> <span className="text-white ml-2">{lead.listing.sqft?.toLocaleString() || "—"}</span></p>
                  </section>
                )}
                {lead.notes && (
                  <p className="text-sm text-white/60 whitespace-pre-wrap bg-white/5 rounded-lg p-3">{lead.notes}</p>
                )}
              </article>
            );
          })()}
        </section>
      )}

      <article className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTips(!showTips)}
          className="w-full flex items-center justify-between px-5 py-4 text-white font-semibold text-sm hover:bg-white/5 transition-colors"
        >
          FSBO Tips
          <span className="text-white/40 text-xs">{showTips ? "Hide" : "Show"}</span>
        </button>
        {showTips && (
          <ul className="px-5 pb-5 space-y-2.5">
            {FSBO_TIPS.map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-blue-400 mt-0.5 shrink-0">*</span>
                <span className="text-white/60">{tip}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
