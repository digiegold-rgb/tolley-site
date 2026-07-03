"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

type Brief = {
  id: string;
  slug: string;
  title: string;
  body: string;
  severity: string;
  readAt: string | null;
  createdAt: string;
};

const SEVERITY_META: Record<
  string,
  { label: string; dot: string; ring: string }
> = {
  alert: { label: "Alert", dot: "bg-red-400", ring: "border-red-400/40" },
  action: { label: "Action", dot: "bg-amber-400", ring: "border-amber-400/40" },
  info: { label: "Info", dot: "bg-violet-400", ring: "border-violet-400/30" },
};

// Map routine slugs to the surface they feed, for one-click deep links.
const SLUG_LINK: Record<string, { href: string; label: string }> = {
  "lead-followups": { href: "/leads", label: "Open Leads" },
  "wd-churn": { href: "/wd/admin", label: "Open W/D Admin" },
  "shop-reprice": { href: "/shop", label: "Open Shop" },
  "stripe-health": { href: "/credit", label: "Open Credit" },
  "stripe-exceptions": { href: "/credit", label: "Open Credit" },
  "market-pulse": { href: "/client", label: "Open Client Portal" },
  "crazybins-deal": { href: "/crazybins", label: "Open Crazybins" },
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RoutineInbox({ initialBriefs }: { initialBriefs: Brief[] }) {
  const [briefs, setBriefs] = useState<Brief[]>(initialBriefs);
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const list = filter === "unread" ? briefs.filter((b) => !b.readAt) : briefs;
    // alerts first, then actions, then info; newest within each.
    const rank: Record<string, number> = { alert: 0, action: 1, info: 2 };
    return [...list].sort(
      (a, b) =>
        (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) ||
        +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  }, [briefs, filter]);

  async function markRead(id: string, read: boolean) {
    setBusy(id);
    setBriefs((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, readAt: read ? new Date().toISOString() : null } : b,
      ),
    );
    try {
      await fetch("/api/routines/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read }),
      });
    } catch {
      /* optimistic; ignore */
    } finally {
      setBusy(null);
    }
  }

  async function markAllRead() {
    setBriefs((prev) =>
      prev.map((b) => (b.readAt ? b : { ...b, readAt: new Date().toISOString() })),
    );
    try {
      await fetch("/api/routines/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch {
      /* ignore */
    }
  }

  const unreadCount = briefs.filter((b) => !b.readAt).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("unread")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            filter === "unread"
              ? "bg-white/90 text-black"
              : "border border-white/20 text-white/70 hover:text-white"
          }`}
        >
          Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            filter === "all"
              ? "bg-white/90 text-black"
              : "border border-white/20 text-white/70 hover:text-white"
          }`}
        >
          All
        </button>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="ml-auto rounded-full border border-white/20 px-3 py-1 text-xs text-white/60 hover:text-white"
          >
            Mark all read
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-8 text-center text-sm text-white/55">
          {filter === "unread"
            ? "No unread briefs. Your routines are all caught up."
            : "No briefs yet. Scheduled routines will post here as they run."}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((b) => {
            const meta = SEVERITY_META[b.severity] ?? SEVERITY_META.info;
            const link = SLUG_LINK[b.slug];
            const isRead = !!b.readAt;
            return (
              <li
                key={b.id}
                className={`rounded-2xl border bg-[rgba(10,9,18,0.55)] p-5 backdrop-blur-xl transition ${meta.ring} ${
                  isRead ? "opacity-55" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-white/95">{b.title}</h3>
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[0.6rem] tracking-wide text-white/55 uppercase">
                        {meta.label}
                      </span>
                      <span className="font-mono text-[0.6rem] text-white/40">{b.slug}</span>
                      <span className="ml-auto text-[0.65rem] text-white/40">
                        {timeAgo(b.createdAt)}
                      </span>
                    </div>
                    <div className="prose prose-invert prose-sm mt-2 max-w-none text-sm text-white/80 prose-headings:text-white/90 prose-strong:text-white prose-a:text-violet-300">
                      <ReactMarkdown>{b.body}</ReactMarkdown>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      {link && (
                        <a
                          href={link.href}
                          className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-200 hover:bg-violet-500/30"
                        >
                          {link.label} →
                        </a>
                      )}
                      <button
                        onClick={() => markRead(b.id, !isRead)}
                        disabled={busy === b.id}
                        className="text-xs text-white/50 hover:text-white disabled:opacity-40"
                      >
                        {isRead ? "Mark unread" : "Mark read"}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
