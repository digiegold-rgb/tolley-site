import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveFit } from "@/lib/fit/catalog";
import FitPieceCard from "@/components/fit/FitPieceCard";
import FitDisclosure from "@/components/fit/FitDisclosure";

export const revalidate = 3600;

type Params = Promise<{ code: string }>;
type Search = Promise<{ utm_source?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  const fit = resolveFit(code);
  if (!fit) return { title: "Shop Her Look | tolley.io/fit" };
  const t = `Her look: ${fit.outfit}`;
  return {
    title: `${t} | tolley.io/fit`,
    description: `Shop the fit — ${fit.outfit}${fit.footwear ? `, ${fit.footwear}` : ""}${fit.jewelry ? `, ${fit.jewelry}` : ""}. Brands + Amazon links.`,
    alternates: { canonical: `https://www.tolley.io/fit/${encodeURIComponent(code)}` },
    openGraph: { title: t, description: "Like the fit? Shop every piece.", url: `https://www.tolley.io/fit/${encodeURIComponent(code)}` },
  };
}

export default async function FitCodePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { code } = await params;
  const sp = await searchParams;
  const src = sp.utm_source || "shop";
  const fit = resolveFit(code, src);
  if (!fit) notFound();

  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const lines = [
    { k: "Wearing", v: cap(fit.outfit) },
    { k: "Shoes", v: cap(fit.footwear) },
    { k: "Jewelry", v: cap(fit.jewelry) },
    { k: "Hair", v: fit.hair ? cap(fit.hair.replace(/^(worn|pulled|in|tucked|half-up)/, (m) => m)) : "" },
    { k: "Accent", v: cap(fit.accent) },
  ].filter((l) => l.v);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-pink-300/85">Like the fit? Here it is.</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{cap(fit.outfit)}</h1>
      <dl className="mt-4 grid gap-1.5 text-sm">
        {lines.map((l) => (
          <div key={l.k} className="flex gap-3">
            <dt className="w-16 shrink-0 text-white/45">{l.k}</dt>
            <dd className="text-white/85">{l.v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-8 text-lg font-bold">Shop every piece</h2>
      <p className="text-sm text-white/55">
        Shown in <span className="text-white/80">{fit.color}</span> — most pieces come in a few colours; pick yours on Amazon.
      </p>
      <div className="mt-3 grid gap-2">
        {fit.items.map((it) => (
          <FitPieceCard key={it.pieceId} item={it} note={it.slot === "dress" || it.slot === "top" || it.slot === "bottom" ? `in ${fit.color}` : undefined} />
        ))}
        {fit.items.length === 0 && (
          <p className="rounded-xl border border-white/10 p-4 text-sm text-white/60">
            We&rsquo;re still matching this look — <Link href="/fit" className="underline">browse the closet</Link> meanwhile.
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href={`/fit?utm_source=${encodeURIComponent(src)}`} className="rounded-full border border-white/15 px-4 py-2 hover:border-pink-400/50">
          👗 All her looks
        </Link>
        <Link href="/shop" className="rounded-full border border-white/15 px-4 py-2 hover:border-pink-400/50">
          🛒 Treasure Haul finds
        </Link>
      </div>

      <FitDisclosure />
    </div>
  );
}
