"use client";

import { useState, useMemo } from "react";

type DealLead = {
  ownerName: string | null;
  score: number;
  listing: {
    address: string;
    city: string | null;
    listPrice: number | null;
    photoUrls: string[];
  } | null;
} | null;

type Deal = {
  id: string;
  subscriberId: string;
  leadId: string | null;
  clientId: string | null;
  listingId: string | null;
  propertyAddress: string | null;
  title: string;
  type: string;
  stage: string;
  salePrice: number | null;
  commissionPct: number | null;
  commissionFlat: number | null;
  referralFeePct: number | null;
  expectedRevenue: number | null;
  actualRevenue: number | null;
  offerDate: string | null;
  contractDate: string | null;
  inspectionDate: string | null;
  appraisalDate: string | null;
  closingDate: string | null;
  closedDate: string | null;
  buyerName: string | null;
  sellerName: string | null;
  referredTo: string | null;
  referredFrom: string | null;
  lenderName: string | null;
  titleCompany: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  Lead: DealLead;
};

const STAGES = [
  "All",
  "prospect",
  "offer",
  "contract",
  "inspection",
  "appraisal",
  "closing",
  "closed",
  "lost",
] as const;

type Stage = (typeof STAGES)[number];

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  offer: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  contract: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  inspection: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  appraisal: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  closing: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  closed: "bg-green-500/20 text-green-300 border-green-500/30",
  lost: "bg-red-500/20 text-red-300 border-red-500/30",
};

const DATE_FIELDS = [
  { key: "offerDate" as const, label: "Offer" },
  { key: "contractDate" as const, label: "Contract" },
  { key: "inspectionDate" as const, label: "Inspection" },
  { key: "appraisalDate" as const, label: "Appraisal" },
  { key: "closingDate" as const, label: "Closing" },
  { key: "closedDate" as const, label: "Closed" },
];

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "-";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysSince(d: string | null): number | null {
  if (!d) return null;
  const diff = Date.now() - new Date(d).getTime();
  return Math.floor(diff / 86400000);
}

function getCommission(deal: Deal): string {
  if (deal.commissionPct && deal.salePrice) {
    return fmtPrice((deal.salePrice * deal.commissionPct) / 100);
  }
  if (deal.commissionFlat) return fmtPrice(deal.commissionFlat);
  return "-";
}

function getAddress(deal: Deal): string {
  if (deal.Lead?.listing?.address) return deal.Lead.listing.address;
  if (deal.propertyAddress) return deal.propertyAddress;
  return deal.title;
}

function getLatestDate(deal: Deal): string | null {
  const dates = [
    deal.closedDate,
    deal.closingDate,
    deal.appraisalDate,
    deal.inspectionDate,
    deal.contractDate,
    deal.offerDate,
  ];
  for (const d of dates) {
    if (d) return d;
  }
  return deal.createdAt;
}

const EMPTY_FORM = {
  title: "",
  propertyAddress: "",
  stage: "prospect",
  type: "referral",
  salePrice: "",
  commissionPct: "",
  commissionFlat: "",
  buyerName: "",
  sellerName: "",
  lenderName: "",
  titleCompany: "",
  notes: "",
  offerDate: "",
  contractDate: "",
  inspectionDate: "",
  appraisalDate: "",
  closingDate: "",
  closedDate: "",
};

export default function DealsTracker({ deals: initialDeals }: { deals: Deal[] }) {
  const [deals, setDeals] = useState(initialDeals);
  const [activeStage, setActiveStage] = useState<Stage>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (activeStage === "All") return deals;
    return deals.filter((d) => d.stage === activeStage);
  }, [deals, activeStage]);

  const stats = useMemo(() => {
    const active = deals.filter(
      (d) => d.stage !== "closed" && d.stage !== "lost"
    );
    const pipelineValue = active.reduce(
      (sum, d) => sum + (d.salePrice ?? 0),
      0
    );
    const expectedComm = active.reduce((sum, d) => {
      if (d.commissionPct && d.salePrice)
        return sum + (d.salePrice * d.commissionPct) / 100;
      if (d.commissionFlat) return sum + d.commissionFlat;
      return sum;
    }, 0);

    const perStage: Record<string, number> = {};
    for (const s of STAGES) {
      if (s === "All" || s === "closed" || s === "lost") continue;
      perStage[s] = deals.filter((d) => d.stage === s).length;
    }

    return { pipelineValue, expectedComm, perStage };
  }, [deals]);

  async function createDeal() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title || form.propertyAddress || "New Deal",
        propertyAddress: form.propertyAddress || undefined,
        stage: form.stage,
        type: form.type,
        salePrice: form.salePrice ? Number(form.salePrice) : undefined,
        commissionPct: form.commissionPct ? Number(form.commissionPct) : undefined,
        commissionFlat: form.commissionFlat ? Number(form.commissionFlat) : undefined,
        buyerName: form.buyerName || undefined,
        sellerName: form.sellerName || undefined,
        lenderName: form.lenderName || undefined,
        titleCompany: form.titleCompany || undefined,
        notes: form.notes || undefined,
      };
      for (const df of DATE_FIELDS) {
        const val = form[df.key as keyof typeof form];
        if (val) body[df.key] = new Date(val).toISOString();
      }

      const res = await fetch("/api/leads/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const newDeal = await res.json();
        setDeals((prev) => [newDeal, ...prev]);
        setForm(EMPTY_FORM);
        setShowNewForm(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateDeal(id: string) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(editForm)) {
        if (k === "salePrice" || k === "commissionPct" || k === "commissionFlat") {
          body[k] = v ? Number(v) : null;
        } else if (DATE_FIELDS.some((df) => df.key === k)) {
          body[k] = v ? new Date(v).toISOString() : null;
        } else {
          body[k] = v || null;
        }
      }

      const res = await fetch(`/api/leads/crm/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const updated = await res.json();
        setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
        setExpandedId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  function expandDeal(deal: Deal) {
    if (expandedId === deal.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(deal.id);
    setEditForm({
      stage: deal.stage,
      salePrice: deal.salePrice?.toString() ?? "",
      commissionPct: deal.commissionPct?.toString() ?? "",
      commissionFlat: deal.commissionFlat?.toString() ?? "",
      buyerName: deal.buyerName ?? "",
      sellerName: deal.sellerName ?? "",
      lenderName: deal.lenderName ?? "",
      titleCompany: deal.titleCompany ?? "",
      notes: deal.notes ?? "",
      offerDate: deal.offerDate?.slice(0, 10) ?? "",
      contractDate: deal.contractDate?.slice(0, 10) ?? "",
      inspectionDate: deal.inspectionDate?.slice(0, 10) ?? "",
      appraisalDate: deal.appraisalDate?.slice(0, 10) ?? "",
      closingDate: deal.closingDate?.slice(0, 10) ?? "",
      closedDate: deal.closedDate?.slice(0, 10) ?? "",
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs text-white/40">Pipeline Value</p>
          <p className="text-lg font-bold text-white">{fmtPrice(stats.pipelineValue)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs text-white/40">Expected Commission</p>
          <p className="text-lg font-bold text-white">{fmtPrice(stats.expectedComm)}</p>
        </div>
        {Object.entries(stats.perStage).map(([stage, count]) =>
          count > 0 ? (
            <div key={stage} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs text-white/40 capitalize">{stage}</p>
              <p className="text-lg font-bold text-white">{count}</p>
            </div>
          ) : null
        )}
      </div>

      {/* Stage tabs + New Deal */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1 flex-1">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setActiveStage(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                activeStage === s
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors border border-white/10"
        >
          {showNewForm ? "Cancel" : "+ New Deal"}
        </button>
      </div>

      {/* New deal form */}
      {showNewForm && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h3 className="text-white font-semibold">New Deal</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Property Address</label>
              <input
                value={form.propertyAddress}
                onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Stage</label>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                {STAGES.filter((s) => s !== "All").map((s) => (
                  <option key={s} value={s} className="bg-[#06050a]">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                {["referral", "buyer", "seller", "dual", "lease"].map((t) => (
                  <option key={t} value={t} className="bg-[#06050a]">{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Sale Price</label>
              <input
                type="number"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Commission %</label>
              <input
                type="number"
                step="0.1"
                value={form.commissionPct}
                onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Buyer Name</label>
              <input
                value={form.buyerName}
                onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Seller Name</label>
              <input
                value={form.sellerName}
                onChange={(e) => setForm({ ...form, sellerName: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
          <button
            onClick={createDeal}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors border border-white/10 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Deal"}
          </button>
        </div>
      )}

      {/* Deal cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((deal) => {
          const addr = getAddress(deal);
          const commission = getCommission(deal);
          const latest = getLatestDate(deal);
          const days = daysSince(latest);
          const isExpanded = expandedId === deal.id;

          return (
            <div
              key={deal.id}
              className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
            >
              {/* Card header */}
              <button
                onClick={() => expandDeal(deal)}
                className="w-full text-left p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{addr}</p>
                    {deal.Lead?.listing?.city && (
                      <p className="text-xs text-white/40 mt-0.5">
                        {deal.Lead.listing.city}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs border capitalize whitespace-nowrap ${
                      STAGE_COLORS[deal.stage] ?? "bg-white/10 text-white/60 border-white/10"
                    }`}
                  >
                    {deal.stage}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-white/40">Sale Price</p>
                    <p className="text-white">{fmtPrice(deal.salePrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40">Commission</p>
                    <p className="text-white">{commission}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
                  {deal.buyerName && <span>Buyer: {deal.buyerName}</span>}
                  {deal.sellerName && <span>Seller: {deal.sellerName}</span>}
                </div>

                <div className="mt-2 flex items-center gap-3 text-xs">
                  {DATE_FIELDS.filter((df) => deal[df.key]).map((df) => (
                    <span key={df.key} className="text-white/40">
                      {df.label}: {fmtDate(deal[df.key])}
                    </span>
                  ))}
                </div>

                {days !== null && (
                  <p className="mt-1 text-xs text-white/30">
                    {days === 0 ? "Updated today" : `${days}d since last update`}
                  </p>
                )}
              </button>

              {/* Expanded edit form */}
              {isExpanded && (
                <div className="border-t border-white/10 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Stage</label>
                      <select
                        value={editForm.stage ?? deal.stage}
                        onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      >
                        {STAGES.filter((s) => s !== "All").map((s) => (
                          <option key={s} value={s} className="bg-[#06050a]">{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Sale Price</label>
                      <input
                        type="number"
                        value={editForm.salePrice ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, salePrice: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Commission %</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editForm.commissionPct ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, commissionPct: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Flat Commission</label>
                      <input
                        type="number"
                        value={editForm.commissionFlat ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, commissionFlat: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Buyer</label>
                      <input
                        value={editForm.buyerName ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, buyerName: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Seller</label>
                      <input
                        value={editForm.sellerName ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, sellerName: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Lender</label>
                      <input
                        value={editForm.lenderName ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, lenderName: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Title Company</label>
                      <input
                        value={editForm.titleCompany ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, titleCompany: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {DATE_FIELDS.map((df) => (
                      <div key={df.key}>
                        <label className="block text-xs text-white/40 mb-1">{df.label}</label>
                        <input
                          type="date"
                          value={editForm[df.key] ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, [df.key]: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs text-white/40 mb-1">Notes</label>
                    <textarea
                      value={editForm.notes ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                  </div>

                  {deal.referredTo && (
                    <p className="text-xs text-white/40">Referred to: {deal.referredTo}</p>
                  )}
                  {deal.referredFrom && (
                    <p className="text-xs text-white/40">Referred from: {deal.referredFrom}</p>
                  )}

                  <button
                    onClick={() => updateDeal(deal.id)}
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors border border-white/10 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/40">
            No deals in this stage
          </div>
        )}
      </div>
    </div>
  );
}
