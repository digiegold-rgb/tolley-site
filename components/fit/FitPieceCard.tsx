import type { FitItem } from "@/lib/fit/catalog";
import { SLOT_META } from "@/lib/fit/catalog";

/** One shoppable piece — brand-forward, no Amazon price/image on purpose. */
export default function FitPieceCard({ item, note }: { item: FitItem; note?: string }) {
  const meta = SLOT_META[item.slot];
  const href = item.url || item.searchUrl;
  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener"
      className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-pink-400/50 hover:bg-pink-500/10"
    >
      <span className="text-2xl leading-none">{meta.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-pink-300/80">
          {meta.label}
        </span>
        <span className="mt-0.5 block text-base font-semibold text-white">{item.label}</span>
        <span className="mt-0.5 block text-sm text-white/60">
          {item.brand ? <>by <span className="text-white/85">{item.brand}</span></> : "similar on Amazon"}
          {note ? <> · {note}</> : null}
        </span>
      </span>
      <span className="shrink-0 self-center rounded-full bg-[#FF9900] px-3 py-1.5 text-xs font-bold text-black group-hover:bg-[#ffb13a]">
        {item.url ? "Shop on Amazon →" : "Find on Amazon →"}
      </span>
    </a>
  );
}
