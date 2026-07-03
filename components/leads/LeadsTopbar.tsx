"use client";

import Link from "next/link";
import { KeyHint } from "@/components/ui/KeyHint";
import { useCommandPalette } from "@/components/ui/CommandPalette";

/**
 * Persistent T-Agent top bar. Renders a command-palette trigger (search-
 * styled), current tier/SMS usage pill, and a user menu.
 *
 * Phase 2: palette opens even if no commands are registered — that wiring
 * lands in Phase 8. Clicking the search box just opens the palette shell.
 */
export default function LeadsTopbar({
  tier,
  smsUsed,
  smsLimit,
  userEmail,
  lastSyncAt,
  totalListings,
}: {
  tier?: string | null;
  smsUsed?: number;
  smsLimit?: number;
  userEmail?: string | null;
  lastSyncAt?: string | null;
  totalListings?: number;
}) {
  const palette = useCommandPalette();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-[#06050a]/80 px-5 backdrop-blur">
      <button
        onClick={() => palette.open()}
        className="flex h-9 min-w-[20rem] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-left text-sm text-white/40 transition-colors hover:border-white/20 hover:bg-white/10"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 truncate">Search or run a command…</span>
        <KeyHint keys={["Cmd", "K"]} />
      </button>

      {lastSyncAt && (
        <div className="hidden items-center gap-2 text-xs text-white/30 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/60" />
          <span>
            Synced {formatRelative(lastSyncAt)}
            {totalListings != null && ` · ${totalListings.toLocaleString()} listings`}
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {smsLimit != null && smsUsed != null && (
          <div
            title="SMS usage this month"
            className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50 md:inline-flex"
          >
            {smsUsed}/{smsLimit} SMS
          </div>
        )}

        {tier && (
          <div className="hidden rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-purple-300 sm:inline-flex">
            {tier}
          </div>
        )}

        {userEmail ? (
          <Link
            href="/leads/settings"
            className="hidden max-w-[14rem] truncate text-xs text-white/40 hover:text-white/70 md:inline-block"
          >
            {userEmail}
          </Link>
        ) : (
          <Link
            href="/login?callbackUrl=/leads"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
