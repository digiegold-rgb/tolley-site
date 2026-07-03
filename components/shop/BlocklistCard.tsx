"use client";

import { useEffect, useState } from "react";

type MatchType = "contains" | "exact" | "fbListingId" | "regex";

interface BlocklistEntry {
  id: string;
  pattern: string;
  matchType: MatchType;
  reason: string | null;
  createdAt: string;
}

const MATCH_TYPE_LABEL: Record<MatchType, string> = {
  contains: "Contains",
  exact: "Exact title",
  fbListingId: "FB listing ID",
  regex: "Regex",
};

const MATCH_TYPE_HINT: Record<MatchType, string> = {
  contains: "Block any item whose title contains this text (case-insensitive). Best for keywords like 'broken' or 'damaged'.",
  exact: "Block items whose title matches exactly (case-insensitive).",
  fbListingId: "Block one specific FB Marketplace listing by its ID.",
  regex: "Block any title matching this regular expression (case-insensitive). E.g. ` \\d{6}$` catches dev test items with a timestamp suffix.",
};

export function BlocklistCard() {
  const [entries, setEntries] = useState<BlocklistEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("contains");
  const [reason, setReason] = useState("");
  const [archiveExisting, setArchiveExisting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/shop/admin/blocklist");
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {}
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!pattern.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/shop/admin/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: pattern.trim(),
          matchType,
          reason: reason.trim() || undefined,
          archiveExisting,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setPattern("");
      setReason("");
      setArchiveExisting(false);
      setMsg({
        kind: "ok",
        text: archiveExisting
          ? `Added. Archived ${data.archivedCount ?? 0} existing match${
              (data.archivedCount ?? 0) === 1 ? "" : "es"
            }.`
          : "Added to blocklist. Future FB syncs will skip matching items.",
      });
      await refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed to add" });
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: string) {
    if (!confirm("Remove this ban? Future FB syncs will start importing matching items again.")) {
      return;
    }
    try {
      const res = await fetch(`/api/shop/admin/blocklist?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Remove failed" });
    }
  }

  return (
    <div className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-4">
      <div>
        <p className="text-sm font-semibold text-rose-200">🚫 Blocklist — ban from FB sync</p>
        <p className="mt-0.5 text-xs text-white/50">
          Items matching any rule below are skipped on every FB Marketplace sync.
          Use this to permanently filter out things you never want listed.
        </p>
      </div>

      <form onSubmit={addEntry} className="mt-3 space-y-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder={
              matchType === "fbListingId"
                ? "FB listing ID (numeric)"
                : matchType === "exact"
                  ? "Exact item title"
                  : matchType === "regex"
                    ? "Regex (e.g. ' \\d{6}$' for timestamped tests)"
                    : "Keyword or phrase to ban"
            }
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-rose-400/50 focus:outline-none"
            required
          />
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value as MatchType)}
            className="rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-white focus:border-rose-400/50 focus:outline-none"
          >
            <option value="contains">Contains</option>
            <option value="exact">Exact title</option>
            <option value="fbListingId">FB listing ID</option>
            <option value="regex">Regex</option>
          </select>
        </div>
        <p className="text-[0.7rem] text-white/40">{MATCH_TYPE_HINT[matchType]}</p>

        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why? (optional, just a note for you)"
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-rose-400/50 focus:outline-none"
        />

        <label className="flex items-center gap-2 text-xs text-white/55">
          <input
            type="checkbox"
            checked={archiveExisting}
            onChange={(e) => setArchiveExisting(e.target.checked)}
            className="h-3.5 w-3.5 accent-rose-400"
          />
          Also archive any existing products that match this rule right now
        </label>

        <button
          type="submit"
          disabled={busy || !pattern.trim()}
          className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/30 disabled:opacity-40"
        >
          {busy ? "Adding…" : "Add to blocklist"}
        </button>
      </form>

      {msg && (
        <p
          className={`mt-2 text-xs ${
            msg.kind === "ok" ? "text-emerald-300" : "text-red-400"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-4 space-y-1.5">
        <p className="text-[0.7rem] uppercase tracking-wide text-white/40">
          Active bans {entries ? `(${entries.length})` : ""}
        </p>
        {entries === null ? (
          <p className="text-xs text-white/40">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-white/40">
            None yet. Future FB syncs will pull everything that's live on the seller dashboard.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-md border border-white/5 bg-black/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white/85">{e.pattern}</p>
                  <p className="text-[0.7rem] text-white/40">
                    {MATCH_TYPE_LABEL[e.matchType]}
                    {e.reason ? ` · ${e.reason}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => removeEntry(e.id)}
                  className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[0.7rem] text-white/55 hover:border-rose-400/50 hover:text-rose-300"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
