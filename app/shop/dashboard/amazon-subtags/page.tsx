"use client";

import { useEffect, useState } from "react";

interface SubtagRow {
  source: string;
  description: string;
  tagId: string | null;
  verified: boolean;
  verifiedAt: string | null;
  notes: string | null;
  updatedAt: string | null;
}

const TEST_ASIN = "B07VGRJDFY"; // Lodge 10.25" cast-iron skillet, evergreen ASIN

export default function AmazonSubtagsPage() {
  const [rows, setRows] = useState<SubtagRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/shop/amazon/subtags");
      if (!res.ok) throw new Error(`load ${res.status}`);
      const json = (await res.json()) as { sources: SubtagRow[] };
      setRows(json.sources);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    }
  }

  async function save(
    source: string,
    fields: { tagId?: string; verified?: boolean; notes?: string },
  ) {
    setSavingFor(source);
    try {
      const res = await fetch("/api/shop/amazon/subtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, ...fields }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || `save ${res.status}`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "save failed");
    } finally {
      setSavingFor(null);
    }
  }

  if (error) {
    return (
      <div className="rounded border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }
  if (!rows) {
    return <div className="text-sm text-white/40">Loading…</div>;
  }

  const verifiedCount = rows.filter((r) => r.verified).length;
  const totalCount = rows.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Amazon Subtags</h1>
        <p className="mt-1 text-sm text-white/60">
          Map each traffic source to a registered Amazon Associates Tracking ID
          so revenue attribution lands in the right report. Unverified rows
          fall back to the master tag (
          <code className="rounded bg-white/10 px-1 py-0.5 text-[0.7rem]">
            tolley-shop-20
          </code>
          ) — clicks still earn, just without per-channel granularity.
        </p>
      </div>

      <div className="rounded border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
        <strong>Step 1 — register first:</strong> open{" "}
        <a
          className="underline"
          target="_blank"
          rel="noreferrer noopener"
          href="https://affiliate-program.amazon.com/home/manage/account/tracking-ids"
        >
          Associates Central → Manage Tracking IDs
        </a>{" "}
        and create the IDs you want to use (e.g.{" "}
        <code className="rounded bg-white/10 px-1">tolley-tt-20</code>).
        Amazon does <em>not</em> auto-create tags — unregistered values silently drop attribution.
        Once registered, paste the exact string below and tick &quot;verified&quot;.
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-white/60">
        {verifiedCount}/{totalCount} sources verified
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <Row
            key={r.source}
            row={r}
            saving={savingFor === r.source}
            onSave={(fields) => save(r.source, fields)}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  row,
  saving,
  onSave,
}: {
  row: SubtagRow;
  saving: boolean;
  onSave: (fields: { tagId?: string; verified?: boolean; notes?: string }) => void;
}) {
  const [draftTag, setDraftTag] = useState(row.tagId ?? "");
  const [draftNotes, setDraftNotes] = useState(row.notes ?? "");
  const dirty = draftTag !== (row.tagId ?? "") || draftNotes !== (row.notes ?? "");
  const previewUrl = draftTag
    ? `https://www.amazon.com/dp/${TEST_ASIN}?tag=${encodeURIComponent(draftTag)}`
    : null;

  return (
    <div
      className={`rounded border p-3 transition ${
        row.verified
          ? "border-emerald-400/30 bg-emerald-500/5"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-mono text-sm text-white">{row.source}</span>
          <span className="ml-2 text-xs text-white/50">{row.description}</span>
        </div>
        <div className="flex items-center gap-2 text-[0.7rem]">
          {row.verified ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-200">
              ✓ verified
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/50">
              not verified
            </span>
          )}
          {row.verifiedAt && (
            <span className="text-white/40">
              {new Date(row.verifiedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-white/40">
            Tracking ID
          </label>
          <input
            value={draftTag}
            onChange={(e) => setDraftTag(e.target.value)}
            placeholder="tolley-xx-20"
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-white placeholder:text-white/30"
          />
        </div>
        <div>
          <label className="text-[0.7rem] uppercase tracking-wide text-white/40">
            Notes
          </label>
          <input
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="optional"
            className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          disabled={saving || !dirty}
          onClick={() => onSave({ tagId: draftTag, notes: draftNotes, verified: row.verified })}
          className="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-100 hover:bg-purple-500/30 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded bg-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/15"
          >
            Test click → Amazon
          </a>
        )}
        <button
          disabled={saving || !draftTag.trim()}
          onClick={() =>
            onSave({ tagId: draftTag, notes: draftNotes, verified: !row.verified })
          }
          className={`rounded px-2 py-1 text-xs disabled:opacity-40 ${
            row.verified
              ? "bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
              : "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
          }`}
        >
          {row.verified ? "Mark unverified" : "Mark verified"}
        </button>
        {row.tagId && (
          <button
            disabled={saving}
            onClick={() => {
              if (!confirm(`Clear subtag for ${row.source}?`)) return;
              onSave({ tagId: "", notes: "", verified: false });
            }}
            className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-200 hover:bg-red-500/25 disabled:opacity-40"
          >
            Clear
          </button>
        )}
      </div>

      {previewUrl && (
        <p className="mt-2 break-all text-[0.65rem] text-white/40">
          Preview link: <code>{previewUrl}</code>
        </p>
      )}
    </div>
  );
}
