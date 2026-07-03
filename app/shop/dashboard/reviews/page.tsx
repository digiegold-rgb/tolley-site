"use client";

import { useCallback, useEffect, useState } from "react";

interface GbpEntry {
  key: string;
  label: string;
  configured: boolean;
}

interface ReviewRequest {
  id: string;
  phone: string | null;
  email: string | null;
  recipientName: string | null;
  gbpKey: string;
  shortCode: string;
  status: string;
  channel: string;
  sentAt: string | null;
  clickedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ListResponse {
  requests: ReviewRequest[];
  counts: Record<string, number>;
  gbps: GbpEntry[];
}

export default function ReviewsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [gbpKey, setGbpKey] = useState("your_kc_homes");
  const [posting, setPosting] = useState(false);
  const [sending, setSending] = useState(false);

  const reload = useCallback(() => {
    fetch("/api/reviews/list")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /**
   * Parse the bulk paste into recipient rows. Each line is one of:
   *   <phone>
   *   <phone>, <name>
   *   <name>, <phone>
   * We're permissive — anything that looks like a digit cluster is the phone.
   */
  function parseBulk(text: string) {
    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((line) => {
      const phoneMatch = line.match(/(\+?\d[\d\s\-().]{8,})/);
      const phone = phoneMatch ? phoneMatch[1].trim() : "";
      const remaining = line.replace(phone, "").replace(/[,;]/g, " ").trim();
      return {
        phone,
        name: remaining || undefined,
      };
    });
  }

  async function queue() {
    const recipients = parseBulk(bulkText);
    if (recipients.length === 0) {
      alert("No recipients parsed from the box");
      return;
    }
    setPosting(true);
    try {
      const res = await fetch("/api/reviews/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gbpKey,
          channel: "sms",
          recipients,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      alert(
        `Queued ${json.queued} requests${
          json.errors?.length ? `, ${json.errors.length} skipped` : ""
        }`
      );
      setBulkText("");
      reload();
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPosting(false);
    }
  }

  async function sendAll() {
    if (!confirm("Send all queued review requests via SMS?")) return;
    setSending(true);
    try {
      const res = await fetch("/api/reviews/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      alert(`Scheduled ${json.scheduled} sends — refresh in ~30s`);
      reload();
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Review requests</h1>
        <p className="mt-1 text-sm text-white/40">
          Send Google review-request SMS to past clients. Each recipient gets a
          unique short link so we can track who clicked.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white/85">Queue a batch</h2>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-white/60">
            <div className="mb-1">Business (GBP)</div>
            <select
              value={gbpKey}
              onChange={(e) => setGbpKey(e.target.value)}
              className="shop-input rounded-lg px-3 py-2 text-sm"
            >
              {data?.gbps.map((g) => (
                <option key={g.key} value={g.key} disabled={!g.configured}>
                  {g.label}
                  {!g.configured ? " (no review URL configured)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mb-2 text-xs text-white/50">
          Paste one recipient per line — phone optionally with name. Examples:
        </p>
        <pre className="mb-2 rounded bg-black/30 p-2 text-[0.7rem] text-white/40">
          (816) 555-1234, Jane Doe{"\n"}
          +18165557890{"\n"}
          Bob Smith, 8165552233
        </pre>
        <textarea
          rows={6}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          className="shop-input w-full rounded-lg p-3 font-mono text-xs"
          placeholder="(816) 555-1234, Jane Doe&#10;+18165557890"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={queue}
            disabled={posting || !bulkText.trim()}
            className="shop-btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            {posting ? "Queueing…" : "Queue requests"}
          </button>
          <button
            onClick={sendAll}
            disabled={sending || !data?.counts.queued}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-200 disabled:opacity-50 hover:bg-emerald-500/30"
          >
            {sending
              ? "Sending…"
              : `Send all queued (${data?.counts.queued ?? 0})`}
          </button>
        </div>
      </div>

      {data?.counts && (
        <div className="flex gap-4 text-xs text-white/60">
          {Object.entries(data.counts).map(([k, n]) => (
            <span key={k}>
              <span className="text-white/40">{k}:</span> {n}
            </span>
          ))}
        </div>
      )}

      {error && <div className="text-sm text-red-400">{error}</div>}

      {data && data.requests.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-white/50">
              <tr>
                <th className="py-2 pr-3">Recipient</th>
                <th className="py-2 pr-3">GBP</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Sent</th>
                <th className="py-2 pr-3">Clicked</th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="py-2 pr-3">
                    <div className="text-white">
                      {r.recipientName ?? "—"}
                    </div>
                    <div className="text-xs text-white/40">
                      {r.phone ?? r.email ?? ""}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-white/60">
                    {r.gbpKey}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        r.status === "sent"
                          ? "bg-blue-500/20 text-blue-300"
                          : r.status === "clicked"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : r.status === "failed"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-white/50">
                    {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-white/50">
                    {r.clickedAt
                      ? new Date(r.clickedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
