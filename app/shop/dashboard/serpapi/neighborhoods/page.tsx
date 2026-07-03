"use client";

import { useCallback, useEffect, useState } from "react";

interface NeighborhoodRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  zip: string | null;
  published: boolean;
  generatedAt: string | null;
  faqCount: number;
  serpapiQueriesUsed: number;
}

interface ListResponse {
  pages: NeighborhoodRow[];
}

export default function NeighborhoodsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const reload = useCallback(() => {
    fetch("/api/neighborhoods/list")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function generateAll(force = false) {
    if (force && !confirm("Force-regenerate all pages? Each one burns 1 SerpAPI query.")) {
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/neighborhoods/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      alert(
        force
          ? "Force-regenerate scheduled — refresh in ~2 min."
          : "Generation scheduled — refresh in ~2 min."
      );
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  }

  async function generateOne(slug: string) {
    setGenerating(true);
    try {
      const res = await fetch("/api/neighborhoods/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, force: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      alert(json.ok ? `Generated ${slug}` : `Failed: ${json.error}`);
      reload();
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  }

  const totalQueries = (data?.pages ?? []).reduce(
    (acc, p) => acc + (p.serpapiQueriesUsed ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Neighborhood pages</h1>
          <p className="mt-1 text-sm text-white/40">
            Programmatic SEO landing pages for each KC-metro neighborhood. One
            SerpAPI google call per page harvests People Also Ask + Knowledge
            Graph and persists them as FAQ schema markup.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => generateAll(false)}
            disabled={generating}
            className="shop-btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            {generating ? "Working…" : "Generate missing"}
          </button>
          <button
            onClick={() => generateAll(true)}
            disabled={generating}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:bg-white/5"
          >
            Force regen all
          </button>
        </div>
      </div>

      <div className="text-xs text-white/50">
        Total SerpAPI queries used so far: {totalQueries}
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      {data && data.pages.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
          No pages seeded yet. Click <strong>Generate missing</strong> to seed
          all KC-metro neighborhoods.
        </div>
      )}

      {data && data.pages.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-white/50">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">State</th>
                <th className="py-2 pr-3">FAQ</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Generated</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.pages.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-2 pr-3">
                    <a
                      href={`/real-estate-agent/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:underline"
                    >
                      {p.name}
                    </a>
                    <div className="text-xs text-white/40">/{p.slug}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-white/60">{p.state}</td>
                  <td className="py-2 pr-3 text-xs text-white/60">
                    {p.faqCount}
                  </td>
                  <td className="py-2 pr-3">
                    {p.published ? (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                        live
                      </span>
                    ) : (
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">
                        draft
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs text-white/50">
                    {p.generatedAt
                      ? new Date(p.generatedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => generateOne(p.slug)}
                      disabled={generating}
                      className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/70 hover:bg-white/10"
                    >
                      Regenerate
                    </button>
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
