"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Result = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  genres?: string[];
  status: number; // 5=available 4=partial 3=processing 2=pending 0/1=none
};

const STATUS: Record<number, { label: string; color: string }> = {
  5: { label: "On Plex", color: "#22c55e" },
  4: { label: "Partial", color: "#84cc16" },
  3: { label: "Downloading", color: "#38bdf8" },
  2: { label: "Requested", color: "#f59e0b" },
};

const CURRENT_YEAR = 2026;
const YEARS = Array.from({ length: CURRENT_YEAR - 1950 + 1 }, (_, i) => CURRENT_YEAR - i);

type Rank = "notable" | "rated" | "boxoffice";
const RANKS: { key: Rank; label: string }[] = [
  { key: "notable", label: "Most Notable" },
  { key: "rated", label: "Top Rated" },
  { key: "boxoffice", label: "Box Office" },
];

// ── Shared card used by both Search and Top-by-Year ────────────────────────
function MediaCard({
  m,
  busy,
  onRequest,
}: {
  m: Result;
  busy: boolean;
  onRequest: (m: Result, quality?: "4k") => void;
}) {
  const st = STATUS[m.status];
  const [want4k, setWant4k] = useState(false);
  const can4k = m.mediaType === "movie" && m.status < 2;
  return (
    <div
      style={{
        borderRadius: 14,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "2 / 3",
          background: m.poster
            ? `center/cover no-repeat url(${m.poster})`
            : "linear-gradient(135deg,#241a12,#15100c)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            padding: "3px 7px",
            borderRadius: 6,
            background: m.mediaType === "tv" ? "rgba(99,102,241,0.9)" : "rgba(234,88,12,0.9)",
          }}
        >
          {m.mediaType === "tv" ? "TV" : "Movie"}
        </span>
        {st && (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 7px",
              borderRadius: 6,
              background: "rgba(0,0,0,0.6)",
              color: st.color,
              border: `1px solid ${st.color}`,
            }}
          >
            {st.label}
          </span>
        )}
        {!m.poster && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              opacity: 0.4,
            }}
          >
            🎞️
          </div>
        )}
      </div>
      <div style={{ padding: "10px 11px 12px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25, flex: 1 }}>{m.title}</div>
          {can4k && (
            <span
              onClick={() => setWant4k((v) => !v)}
              title="Request in 4K instead of 1080p (grabs only if a 4K release exists)"
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: 0.5,
                padding: "2px 6px",
                borderRadius: 5,
                cursor: "pointer",
                userSelect: "none",
                flexShrink: 0,
                marginTop: 1,
                border: want4k ? "1px solid #a78bfa" : "1px solid rgba(255,255,255,0.18)",
                background: want4k ? "rgba(139,92,246,0.25)" : "rgba(0,0,0,0.3)",
                color: want4k ? "#c4b5fd" : "rgba(255,255,255,0.45)",
              }}
            >
              4K
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>
          {m.year || "—"}
          {m.rating ? ` · ★ ${m.rating.toFixed(1)}` : ""}
        </div>
        {m.genres && m.genres.length > 0 && (
          <div style={{ fontSize: 11, color: "rgba(245,158,11,0.7)", margin: "3px 0 10px" }}>
            {m.genres.join(" · ")}
          </div>
        )}
        <div style={{ marginTop: "auto" }}>
          {m.status >= 4 ? (
            <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "#22c55e", padding: "9px 0" }}>
              ✓ In Plex
            </div>
          ) : m.status === 2 || m.status === 3 ? (
            <div style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "#f59e0b", padding: "9px 0" }}>
              ⏳ {m.status === 3 ? "Downloading" : "Requested"}
            </div>
          ) : (
            <button
              onClick={() => onRequest(m, want4k ? "4k" : undefined)}
              disabled={busy}
              style={{
                width: "100%",
                padding: "9px 0",
                borderRadius: 10,
                border: "none",
                background: busy
                  ? "#7a4a2a"
                  : want4k
                    ? "linear-gradient(90deg,#8b5cf6,#6366f1)"
                    : "linear-gradient(90deg,#f59e0b,#ea580c)",
                color: "white",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: busy ? "default" : "pointer",
              }}
            >
              {busy ? "Requesting…" : want4k ? "Request 4K" : "Request"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: 18,
  marginTop: 10,
};

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "7px 14px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    border: active ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(245,158,11,0.15)" : "rgba(0,0,0,0.3)",
    color: active ? "#f59e0b" : "rgba(255,255,255,0.6)",
  };
}

export function TvClient() {
  const [tab, setTab] = useState<"search" | "browse">("search");
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // browse state
  const [year, setYear] = useState(CURRENT_YEAR - 1);
  const [browseType, setBrowseType] = useState<"movie" | "tv">("movie");
  const [rank, setRank] = useState<Rank>("notable");
  const [browse, setBrowse] = useState<Result[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState("");

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/tv/search?query=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Search failed");
        setResults([]);
      } else {
        setResults(data.results || []);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(query), 420);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, runSearch]);

  const runBrowse = useCallback(async (y: number, t: "movie" | "tv", rk: Rank) => {
    setBrowseLoading(true);
    setBrowseError("");
    try {
      const r = await fetch(`/api/tv/discover?type=${t}&year=${y}&rank=${rk}`);
      const data = await r.json();
      if (!r.ok) {
        setBrowseError(data.error || "Load failed");
        setBrowse([]);
      } else {
        setBrowse(data.results || []);
      }
    } catch (e: any) {
      setBrowseError(String(e?.message || e));
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  // Box Office is movies-only — fall back to Notable if TV is picked.
  const effectiveRank: Rank = browseType === "tv" && rank === "boxoffice" ? "notable" : rank;
  useEffect(() => {
    if (tab === "browse") runBrowse(year, browseType, effectiveRank);
  }, [tab, year, browseType, effectiveRank, runBrowse]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function request(m: Result, quality?: "4k") {
    setPending((p) => ({ ...p, [m.id]: true }));
    const markRequested = () => {
      const upd = (rs: Result[]) => rs.map((x) => (x.id === m.id ? { ...x, status: 2 } : x));
      setResults(upd);
      setBrowse(upd);
    };
    try {
      const r = await fetch("/api/tv/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType: m.mediaType, mediaId: m.id, quality }),
      });
      const data = await r.json();
      if (r.ok) {
        markRequested();
        setToast({
          msg: quality === "4k"
            ? `Requested “${m.title}” in 4K — grabs when a 4K release is found`
            : `Requested “${m.title}” — downloading to Plex`,
          ok: true,
        });
      } else if (r.status === 409) {
        markRequested();
        setToast({ msg: `“${m.title}” was already requested`, ok: true });
      } else {
        setToast({ msg: data.error || "Request failed", ok: false });
      }
    } catch (e: any) {
      setToast({ msg: String(e?.message || e), ok: false });
    } finally {
      setPending((p) => ({ ...p, [m.id]: false }));
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(1100px 520px at 50% -8%, #2a1206 0%, #120a07 52%, #07050a 100%)",
        color: "white",
        fontFamily: "system-ui, -apple-system, sans-serif",
        paddingBottom: 80,
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backdropFilter: "blur(14px)",
          background: "rgba(7,5,10,0.72)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 20px",
        }}
      >
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>🍿</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.3 }}>Tolley TV</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>
                Request a title → auto-downloads behind VPN → lands in Plex
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div onClick={() => setTab("search")} style={pill(tab === "search")}>
              🔎 Search
            </div>
            <div onClick={() => setTab("browse")} style={pill(tab === "browse")}>
              🏆 Top by Year
            </div>
          </div>

          {tab === "search" ? (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any movie or TV show…"
              autoFocus
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
                fontSize: 16,
                outline: "none",
              }}
            />
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "white",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y} style={{ background: "#120a07" }}>
                    {y}
                  </option>
                ))}
              </select>
              <div onClick={() => setBrowseType("movie")} style={pill(browseType === "movie")}>
                Movies
              </div>
              <div onClick={() => setBrowseType("tv")} style={pill(browseType === "tv")}>
                TV
              </div>
              <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />
              {RANKS.filter((r) => !(r.key === "boxoffice" && browseType === "tv")).map((r) => (
                <div key={r.key} onClick={() => setRank(r.key)} style={pill(effectiveRank === r.key)}>
                  {r.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "22px 20px 0" }}>
        {tab === "search" ? (
          <>
            {loading && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Searching…</p>}
            {error && <p style={{ color: "#f87171", fontSize: 14 }}>⚠️ {error}</p>}
            {!loading && !error && query.trim() && results.length === 0 && (
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>No results for “{query}”.</p>
            )}
            {!query.trim() && !loading && (
              <div style={{ textAlign: "center", padding: "70px 0", color: "rgba(255,255,255,0.35)" }}>
                <div style={{ fontSize: 52, marginBottom: 10 }}>🎬</div>
                <p style={{ fontSize: 15 }}>Start typing to find something to watch.</p>
              </div>
            )}
            <div style={GRID}>
              {results.map((m) => (
                <MediaCard key={`${m.mediaType}-${m.id}`} m={m} busy={!!pending[m.id]} onRequest={request} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
              Top 20 {browseType === "tv" ? "TV shows" : "movies"} of {year}
            </div>
            {browseLoading && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Loading…</p>}
            {browseError && <p style={{ color: "#f87171", fontSize: 14 }}>⚠️ {browseError}</p>}
            {!browseLoading && !browseError && browse.length === 0 && (
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Nothing found for {year}.</p>
            )}
            <div style={GRID}>
              {browse.map((m, i) => (
                <div key={`${m.mediaType}-${m.id}`} style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      top: -6,
                      left: -6,
                      zIndex: 5,
                      fontSize: 12,
                      fontWeight: 800,
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg,#f59e0b,#ea580c)",
                      color: "white",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <MediaCard m={m} busy={!!pending[m.id]} onRequest={request} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            padding: "12px 18px",
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 600,
            color: "white",
            background: toast.ok ? "rgba(22,101,52,0.95)" : "rgba(127,29,29,0.95)",
            border: `1px solid ${toast.ok ? "#22c55e" : "#f87171"}`,
            boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
            maxWidth: "90vw",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
