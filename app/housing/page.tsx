import type { Metadata } from "next";
import { AskJaredForm } from "@/components/housing/ask-jared-form";
import { MoreFromTolley } from "@/components/shared/more-from-tolley";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "KC Housing Daily — Kansas City Market Pulse | Tolley.io",
  description:
    "Fresh daily Kansas City housing-market update: mortgage rates, KC metro prices, Independence hyperlocal stats, and a straight answer about your home from a local agent.",
};

type StatCard = { label: string; value: string; delta: string };
type Pulse = {
  date: string;
  brief: {
    headline: string;
    national_bullets: string[];
    local_bullets: string[];
    take: string;
    stat_card: StatCard[];
  };
  links?: { youtube_url?: string | null };
};

async function getPulse(): Promise<{ pulse: Pulse | null; statcardUrl: string | null }> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://tolley.io";
    const res = await fetch(`${base}/api/housing/pulse`, { next: { revalidate: 300 } });
    const data = await res.json();
    return data?.ready
      ? { pulse: data.pulse as Pulse, statcardUrl: data.statcardUrl ?? null }
      : { pulse: null, statcardUrl: null };
  } catch {
    return { pulse: null, statcardUrl: null };
  }
}

function ytEmbedUrl(url: string): string | null {
  const m = url.match(/(?:shorts\/|watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export default async function HousingPage() {
  const { pulse, statcardUrl } = await getPulse();
  const valuationUrl = process.env.NEXT_PUBLIC_HOUSING_VALUATION_URL || "";
  const embed = pulse?.links?.youtube_url ? ytEmbedUrl(pulse.links.youtube_url) : null;
  const dateLabel = pulse
    ? new Date(`${pulse.date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      {/* Masthead */}
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          KC Housing Daily
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {pulse ? pulse.brief.headline : "The Kansas City market, explained daily."}
        </h1>
        <p className="mt-3 text-sm opacity-70">
          {dateLabel ?? "First market pulse drops tomorrow morning."} · Jared Tolley · Your KC
          Homes · Independence, MO
        </p>
      </header>

      {/* Video / stat card */}
      {embed ? (
        <div className="mx-auto mt-8 aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-2xl border border-zinc-200 shadow-lg dark:border-zinc-800">
          <iframe
            src={embed}
            title="Today's KC housing market update"
            className="h-full w-full"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : statcardUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={statcardUrl}
          alt="Today's KC housing market stats"
          className="mx-auto mt-8 w-full max-w-[360px] rounded-2xl border border-zinc-200 shadow-lg dark:border-zinc-800"
        />
      ) : null}

      {/* Stat tiles */}
      {pulse?.brief.stat_card?.length ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {pulse.brief.stat_card.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-zinc-200 p-4 text-center dark:border-zinc-800"
            >
              <p className="text-xs uppercase tracking-wide opacity-60">{s.label}</p>
              <p className="mt-1 text-2xl font-bold">{s.value}</p>
              <p className="mt-0.5 text-xs opacity-70">{s.delta}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Bullets */}
      {pulse ? (
        <section className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
              National
            </h2>
            <ul className="mt-3 space-y-2.5 text-[0.95rem] leading-relaxed">
              {pulse.brief.national_bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-blue-600">▸</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-60">
              Kansas City &amp; Independence
            </h2>
            <ul className="mt-3 space-y-2.5 text-[0.95rem] leading-relaxed">
              {pulse.brief.local_bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-emerald-600">▸</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <section className="mt-10 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm opacity-70 dark:border-zinc-700">
          Every weekday morning this page updates with fresh mortgage rates, KC metro prices,
          and hyperlocal Independence numbers — plus a 60-second video brief. Check back
          tomorrow, or ask Jared a question right now below.
        </section>
      )}

      {/* The take */}
      {pulse ? (
        <blockquote className="mt-10 rounded-2xl bg-zinc-50 p-6 dark:bg-zinc-900">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-60">The take</p>
          <p className="mt-2 text-lg leading-relaxed">{pulse.brief.take}</p>
        </blockquote>
      ) : null}

      {/* Lead form */}
      <section id="ask" className="mt-12 rounded-2xl border border-zinc-200 p-6 sm:p-8 dark:border-zinc-800">
        <h2 className="text-2xl font-bold">Ask Jared about YOUR home</h2>
        <p className="mt-1.5 text-sm opacity-70">
          The numbers above are the market. Your house is specific — ask and get a real answer
          from a licensed KC agent.
        </p>
        <div className="mt-6">
          <AskJaredForm />
        </div>
        {valuationUrl ? (
          <p className="mt-5 text-center text-sm">
            Want an instant estimate instead?{" "}
            <a
              href={valuationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 underline underline-offset-2"
            >
              Get a free home valuation →
            </a>
          </p>
        ) : null}
      </section>

      <div className="mt-14">
        <MoreFromTolley currentSubsite="housing" />
      </div>

      <p className="mt-10 text-center text-xs opacity-50">
        This daily engine is a tolley.io build — want one for your business?{" "}
        <a href="/pricing" className="underline underline-offset-2">
          See plans
        </a>
      </p>
    </main>
  );
}
