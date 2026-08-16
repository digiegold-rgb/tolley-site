import Link from "next/link";
import { lookbook, SLOT_ORDER, SLOT_META, wardrobeCounts, catalogUpdated } from "@/lib/fit/catalog";
import { recentFits, LANE_LABEL } from "@/lib/fit/recent";
import FitPieceCard from "@/components/fit/FitPieceCard";
import FitDisclosure from "@/components/fit/FitDisclosure";

export const revalidate = 300;

export default async function FitIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ utm_source?: string }>;
}) {
  const sp = await searchParams;
  const src = sp.utm_source || "shop";
  const [closet, recent] = await Promise.all([Promise.resolve(lookbook(src)), recentFits(30)]);
  const total = Object.values(closet).reduce((n, a) => n + a.length, 0);

  return (
    <div>
      <section className="rounded-3xl border border-pink-400/25 bg-gradient-to-br from-pink-500/15 via-fuchsia-500/5 to-transparent p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-pink-300/85">Like the fit?</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight">Everything Ruthann wears, shoppable.</h1>
        <p className="mt-2 max-w-xl text-sm text-white/65">
          She never repeats an outfit — {wardrobeCounts.silhouettes} silhouettes × {wardrobeCounts.colors} colours ×{" "}
          {wardrobeCounts.footwear} shoes, plus {wardrobeCounts.jewelry} jewelry sets and {wardrobeCounts.hair} hairstyles.
          Every video&rsquo;s caption links its exact look. Tap a piece to shop it on Amazon.
        </p>
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">Her latest looks</h2>
          <p className="text-sm text-white/55">Saw her in a video? Find it here.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {recent.map((f) => (
              <Link
                key={`${f.code}-${f.date}`}
                href={`/fit/${encodeURIComponent(f.code)}?utm_source=${encodeURIComponent(src)}`}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:border-pink-400/50"
              >
                {f.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.thumb} alt={f.outfit || f.title} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center text-4xl">👗</div>
                )}
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{f.outfit || f.title}</p>
                  <p className="mt-1 text-[11px] text-white/50">
                    {LANE_LABEL[f.lane] || f.lane} · {f.date}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-bold">The whole closet</h2>
        <p className="text-sm text-white/55">{total} pieces{catalogUpdated ? ` · updated ${catalogUpdated}` : ""}</p>
        {SLOT_ORDER.map((slot) =>
          closet[slot].length ? (
            <div key={slot} className="mt-6">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
                {SLOT_META[slot].emoji} {SLOT_META[slot].label}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {closet[slot].map((it) => (
                  <FitPieceCard key={it.pieceId} item={it} />
                ))}
              </div>
            </div>
          ) : null,
        )}
      </section>

      <FitDisclosure />
    </div>
  );
}
