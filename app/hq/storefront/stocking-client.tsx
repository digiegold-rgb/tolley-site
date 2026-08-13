"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import "./storefront.css";

type SheetItem = {
  asin: string;
  title: string;
  price: number | null;
  rating: number | null;
  soldCount: number;
  ladder: string[] | null;
};

type SheetShelf = { shelf: string; review: boolean; items: SheetItem[] };

type SheetData = {
  generatedAt: string;
  total: number;
  shelfCount: number;
  totalValue: number;
  shelves: SheetShelf[];
};

// Shared with the standalone add-sheet so ticks carry over per device.
const KEY = "storefront-shelved-v1";

export default function StockingClient({ data }: { data: SheetData }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [hiding, setHiding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ title: string; text: string } | null>(null);
  const sheetTextRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      setDone(new Set(JSON.parse(localStorage.getItem(KEY) || "[]")));
    } catch {
      /* first visit */
    }
  }, []);

  useEffect(() => {
    if (sheet && sheetTextRef.current) {
      sheetTextRef.current.focus();
      sheetTextRef.current.select();
      try {
        document.execCommand("copy");
      } catch {
        /* user copies manually */
      }
    }
  }, [sheet]);

  function persist(next: Set<string>) {
    setDone(next);
    localStorage.setItem(KEY, JSON.stringify(Array.from(next)));
  }

  function toggle(asin: string) {
    const next = new Set(done);
    if (next.has(asin)) next.delete(asin);
    else next.add(asin);
    persist(next);
  }

  function copyList(id: string, title: string, asins: string[]) {
    const text = asins.join("\n");
    const flash = () => {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1400);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(flash, () => setSheet({ title, text }));
    } else {
      setSheet({ title, text });
    }
  }

  const needle = q.trim().toLowerCase();
  const visible = useMemo(() => {
    return data.shelves.map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (hiding && done.has(it.asin)) return false;
        if (!needle) return true;
        return (
          it.title.toLowerCase().includes(needle) || it.asin.toLowerCase().includes(needle)
        );
      }),
    }));
  }, [data.shelves, needle, hiding, done]);

  const shownAny = visible.some((s) => s.items.length > 0);
  const allAsins = useMemo(
    () => data.shelves.flatMap((s) => s.items.map((i) => i.asin)),
    [data.shelves]
  );

  return (
    <div className="sf-wrap">
      <header className="sf-header">
        <p className="sf-eyebrow">Stocking run · amazon.com/shop/digitaljared</p>
        <h1>{data.total} products to shelve</h1>
        <p className="sf-lede">
          Every item is <b>live on Amazon right now</b> and is the new equivalent of something
          that <b>already sold on your Marketplace</b>. Open a row, click{" "}
          <b>Add to List</b> on Amazon, tick the box here. Ticks save on this device.
        </p>
        <p className="sf-links">
          <a href="https://www.amazon.com/gp/registry/storefront" target="_blank" rel="noopener noreferrer">Idea Lists</a>
          <a href="https://www.amazon.com/shop/digitaljared" target="_blank" rel="noopener noreferrer">Your storefront</a>
          <a href="https://affiliate-program.amazon.com/influencers" target="_blank" rel="noopener noreferrer">Creator Hub</a>
          <a href="/hq">← back to HQ</a>
        </p>
      </header>

      <div className="sf-rail">
        <div className="sf-rail-top">
          <span className="sf-count">
            <b>{done.size}</b> / {data.total} shelved
          </span>
          <span className="sf-rail-note">
            {data.shelfCount} Idea Lists · ${data.totalValue.toLocaleString("en-US")} catalog
            value · list rebuilt {data.generatedAt.slice(0, 10)}
          </span>
        </div>
        <div className="sf-track">
          <div
            className="sf-fill"
            style={{ width: `${data.total ? (done.size / data.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="sf-tools">
        <input
          type="search"
          placeholder="Filter by product or ASIN…"
          aria-label="Filter products"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={() => setHiding((h) => !h)}>
          {hiding ? "Show all" : "Hide shelved"}
        </button>
        <button
          onClick={() => {
            if (confirm("Clear all ticks?")) persist(new Set());
          }}
        >
          Reset ticks
        </button>
        <button onClick={() => copyList("__all", `All ${allAsins.length} ASINs`, allAsins)}>
          {copied === "__all" ? `Copied ${allAsins.length}` : "Copy ALL ASINs"}
        </button>
      </div>

      {visible.map(
        (s) =>
          s.items.length > 0 && (
            <section key={s.shelf} className={s.review ? "sf-section sf-review" : "sf-section"}>
              <div className="sf-tag">
                <h2>{s.shelf}</h2>
                <span className="sf-n">{s.items.length}</span>
                <button
                  className="sf-copy"
                  onClick={() =>
                    copyList(
                      s.shelf,
                      `${s.shelf} ASINs`,
                      data.shelves.find((x) => x.shelf === s.shelf)!.items.map((i) => i.asin)
                    )
                  }
                >
                  {copied === s.shelf
                    ? `Copied ${data.shelves.find((x) => x.shelf === s.shelf)!.items.length}`
                    : "Copy ASINs"}
                </button>
              </div>
              {s.review && (
                <p className="sf-review-note">
                  Amazon category was missing or ambiguous for these — eyeball each one and pick
                  its shelf yourself; nothing here was guessed.
                </p>
              )}
              <ul className="sf-list">
                {s.items.map((it) => (
                  <li key={it.asin} className={done.has(it.asin) ? "sf-done" : undefined}>
                    <input
                      type="checkbox"
                      aria-label={`Mark ${it.asin} shelved`}
                      checked={done.has(it.asin)}
                      onChange={() => toggle(it.asin)}
                    />
                    <div className="sf-meta">
                      <span className="sf-name">
                        <a
                          href={`https://www.amazon.com/dp/${it.asin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {it.title}
                        </a>
                      </span>
                      <div className="sf-sub">
                        <span className="sf-asin">{it.asin}</span>
                        {it.price != null && <span className="sf-price">${it.price.toFixed(2)}</span>}
                        {it.rating != null && <span>★ {it.rating}</span>}
                        <span className="sf-chip">sold {it.soldCount}× on FB</span>
                        {it.ladder && <span className="sf-cat">{it.ladder.join(" › ")}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
      )}

      {!shownAny && <p className="sf-empty">Nothing matches that filter.</p>}

      <footer className="sf-footer">
        Share the storefront as{" "}
        <code>https://www.amazon.com/shop/digitaljared?tag=tolley-shop-20</code>. Dead and
        delisted ASINs were filtered out before this list was built. Refresh the list with{" "}
        <code>node scripts/storefront-shelves.mjs</code> + deploy.
      </footer>

      {sheet && (
        <div className="sf-sheet" onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div className="sf-sheet-box">
            <div className="sf-sheet-head">
              <strong>{sheet.title}</strong>
              <button
                onClick={() => {
                  sheetTextRef.current?.focus();
                  sheetTextRef.current?.select();
                  try {
                    document.execCommand("copy");
                  } catch {
                    /* manual copy */
                  }
                }}
              >
                Select all
              </button>
              <button onClick={() => setSheet(null)}>Close</button>
            </div>
            <p className="sf-sheet-hint">
              Clipboard was blocked. The list below is pre-selected — press{" "}
              <b>Ctrl/Cmd + C</b> to copy.
            </p>
            <textarea ref={sheetTextRef} readOnly spellCheck={false} value={sheet.text} />
          </div>
        </div>
      )}
    </div>
  );
}
