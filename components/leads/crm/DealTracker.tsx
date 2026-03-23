"use client";

import { useState, useMemo, useCallback } from "react";
import type { CrmDeal } from "@/lib/crm-types";

interface DealTrackerProps {
  initialDeals: CrmDeal[];
}

const DEAL_STAGES = [
  { id: "prospect", label: "Prospect", color: "bg-blue-500" },
  { id: "active", label: "Active", color: "bg-yellow-500" },
  { id: "pending", label: "Pending", color: "bg-orange-500" },
  { id: "under_contract", label: "Under Contract", color: "bg-purple-500" },
  { id: "closing", label: "Closing", color: "bg-indigo-500" },
  { id: "closed", label: "Closed", color: "bg-emerald-500" },
  { id: "lost", label: "Lost", color: "bg-red-500" },
];

const STAGE_BADGE: Record<string, string> = {
  prospect: "bg-blue-500/20 text-blue-300",
  active: "bg-yellow-500/20 text-yellow-300",
  pending: "bg-orange-500/20 text-orange-300",
  under_contract: "bg-purple-500/20 text-purple-300",
  closing: "bg-indigo-500/20 text-indigo-300",
  closed: "bg-emerald-500/20 text-emerald-300",
  lost: "bg-red-500/20 text-red-300",
};

function formatCurrency(val: number | null): string {
  if (val == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DealTracker({ initialDeals }: DealTrackerProps) {
  const [deals, setDeals] = useState<CrmDeal[]>(initialDeals);
  const [view, setView] = useState<"table" | "board">("table");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CrmDeal>>({});
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const activeDeals = deals.filter(
      (d) => d.stage !== "lost" && d.stage !== "closed"
    );
    const totalPipeline = activeDeals.reduce(
      (sum, d) => sum + (d.salePrice ?? 0),
      0
    );
    const expectedRevenue = activeDeals.reduce(
      (sum, d) => sum + (d.expectedRevenue ?? 0),
      0
    );
    return {
      total: deals.length,
      active: activeDeals.length,
      totalPipeline,
      expectedRevenue,
    };
  }, [deals]);

  // Stage distribution for bar
  const stageDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const deal of deals) {
      counts[deal.stage] = (counts[deal.stage] || 0) + 1;
    }
    return DEAL_STAGES.map((s) => ({
      ...s,
      count: counts[s.id] || 0,
      pct: deals.length > 0 ? ((counts[s.id] || 0) / deals.length) * 100 : 0,
    }));
  }, [deals]);

  const startEdit = useCallback((deal: CrmDeal) => {
    setEditingId(deal.id);
    setEditForm({
      title: deal.title,
      stage: deal.stage,
      type: deal.type,
      salePrice: deal.salePrice,
      expectedRevenue: deal.expectedRevenue,
      closingDate: deal.closingDate,
    });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/crm/deals/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated: CrmDeal = await res.json();
        setDeals((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
        setEditingId(null);
        setEditForm({});
      }
    } catch (err) {
      console.error("Deal save error:", err);
    } finally {
      setSaving(false);
    }
  }, [editingId, editForm]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm({});
  }, []);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            Total Deals
          </p>
          <p className="text-lg font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            Active
          </p>
          <p className="text-lg font-bold text-white">{stats.active}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            Pipeline Value
          </p>
          <p className="text-lg font-bold text-white">
            {formatCurrency(stats.totalPipeline)}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">
            Expected Revenue
          </p>
          <p className="text-lg font-bold text-emerald-300">
            {formatCurrency(stats.expectedRevenue)}
          </p>
        </div>
      </div>

      {/* Stage distribution bar */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
          Stage Distribution
        </p>
        <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
          {stageDistribution
            .filter((s) => s.pct > 0)
            .map((s) => (
              <div
                key={s.id}
                className={`${s.color} transition-all duration-300`}
                style={{ width: `${s.pct}%` }}
                title={`${s.label}: ${s.count}`}
              />
            ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {stageDistribution
            .filter((s) => s.count > 0)
            .map((s) => (
              <span
                key={s.id}
                className="text-[10px] text-white/40 flex items-center gap-1"
              >
                <span className={`w-2 h-2 rounded-full ${s.color}`} />
                {s.label} ({s.count})
              </span>
            ))}
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView("table")}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
            view === "table"
              ? "bg-white/10 text-white"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          Table
        </button>
        <button
          onClick={() => setView("board")}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
            view === "board"
              ? "bg-white/10 text-white"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          Board
        </button>
      </div>

      {/* Table view */}
      {view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-left">
                <th className="py-2 px-3 font-medium">Title</th>
                <th className="py-2 px-3 font-medium">Stage</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium text-right">
                  Sale Price
                </th>
                <th className="py-2 px-3 font-medium text-right">
                  Expected Rev
                </th>
                <th className="py-2 px-3 font-medium">Closing</th>
                <th className="py-2 px-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-white/20"
                  >
                    No deals yet
                  </td>
                </tr>
              )}
              {deals.map((deal) => {
                const isEditing = editingId === deal.id;

                if (isEditing) {
                  return (
                    <tr
                      key={deal.id}
                      className="border-b border-white/5 bg-white/5"
                    >
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={editForm.title || ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          className="w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={editForm.stage || ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              stage: e.target.value,
                            }))
                          }
                          className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none [color-scheme:dark]"
                        >
                          {DEAL_STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={editForm.type || ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              type: e.target.value,
                            }))
                          }
                          className="w-20 text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={editForm.salePrice ?? ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              salePrice: e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            }))
                          }
                          className="w-24 text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={editForm.expectedRevenue ?? ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              expectedRevenue: e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            }))
                          }
                          className="w-24 text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={
                            editForm.closingDate
                              ? editForm.closingDate.slice(0, 10)
                              : ""
                          }
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              closingDate: e.target.value || null,
                            }))
                          }
                          className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white focus:outline-none [color-scheme:dark]"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                          >
                            {saving ? "..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded hover:bg-white/15 transition-colors"
                          >
                            X
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={deal.id}
                    onClick={() => startEdit(deal)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-white/80 font-medium">
                      {deal.title}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${STAGE_BADGE[deal.stage] || "bg-white/10 text-white/50"}`}
                      >
                        {DEAL_STAGES.find((s) => s.id === deal.stage)?.label ||
                          deal.stage}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white/50">{deal.type}</td>
                    <td className="py-2 px-3 text-white/70 text-right">
                      {formatCurrency(deal.salePrice)}
                    </td>
                    <td className="py-2 px-3 text-emerald-300/70 text-right">
                      {formatCurrency(deal.expectedRevenue)}
                    </td>
                    <td className="py-2 px-3 text-white/40">
                      {formatDate(deal.closingDate)}
                    </td>
                    <td className="py-2 px-3"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Board view */}
      {view === "board" && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {DEAL_STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage.id);
            return (
              <div
                key={stage.id}
                className="min-w-[240px] w-[240px] shrink-0 rounded-xl border border-white/10 bg-[#0a0914]"
              >
                <div className="p-3 border-b border-white/10 flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${stage.color}`}
                  />
                  <span className="text-xs font-medium text-white/70">
                    {stage.label}
                  </span>
                  <span className="text-[10px] text-white/30 ml-auto">
                    {stageDeals.length}
                  </span>
                </div>
                <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                  {stageDeals.length === 0 && (
                    <p className="text-center text-white/20 text-[10px] py-4">
                      No deals
                    </p>
                  )}
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      onClick={() => startEdit(deal)}
                      className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors"
                    >
                      <p className="text-xs font-medium text-white/80 truncate">
                        {deal.title}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-white/40">
                          {deal.type}
                        </span>
                        <span className="text-[10px] text-white/60 font-medium">
                          {formatCurrency(deal.salePrice)}
                        </span>
                      </div>
                      {deal.closingDate && (
                        <p className="text-[10px] text-white/30 mt-1">
                          Close: {formatDate(deal.closingDate)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline edit modal for board view */}
      {editingId && view === "board" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0a0914] border border-white/10 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Edit Deal</h3>
              <button
                onClick={cancelEdit}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                X
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={editForm.title || ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-white/20 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">
                    Stage
                  </label>
                  <select
                    value={editForm.stage || ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        stage: e.target.value,
                      }))
                    }
                    className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none mt-1 [color-scheme:dark]"
                  >
                    {DEAL_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">
                    Type
                  </label>
                  <input
                    type="text"
                    value={editForm.type || ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        type: e.target.value,
                      }))
                    }
                    className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">
                    Sale Price
                  </label>
                  <input
                    type="number"
                    value={editForm.salePrice ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        salePrice: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      }))
                    }
                    className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider">
                    Expected Revenue
                  </label>
                  <input
                    type="number"
                    value={editForm.expectedRevenue ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        expectedRevenue: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      }))
                    }
                    className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider">
                  Closing Date
                </label>
                <input
                  type="date"
                  value={
                    editForm.closingDate
                      ? editForm.closingDate.slice(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      closingDate: e.target.value || null,
                    }))
                  }
                  className="w-full text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none mt-1 [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={cancelEdit}
                className="text-xs bg-white/10 text-white/50 px-4 py-2 rounded-lg hover:bg-white/15 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="text-xs bg-blue-500/20 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
