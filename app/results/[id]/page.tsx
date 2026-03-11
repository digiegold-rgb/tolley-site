import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { AnswerRenderer } from "@/components/portal/answer-renderer";
import { prisma } from "@/lib/prisma";
import type { ListingCard } from "@/types/chat";

type ResultPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");

function normalizeCards(value: unknown): ListingCard[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        address:
          typeof record.address === "string" && record.address.trim()
            ? record.address.trim()
            : "Listing",
        type: typeof record.type === "string" ? record.type : "listing",
        price: typeof record.price === "number" ? record.price : null,
        beds: typeof record.beds === "number" ? record.beds : null,
        baths: typeof record.baths === "number" ? record.baths : null,
        sqft: typeof record.sqft === "number" ? record.sqft : null,
        summaryBullets: Array.isArray(record.summaryBullets)
          ? record.summaryBullets.filter((x): x is string => typeof x === "string")
          : [],
        link: typeof record.link === "string" ? record.link : undefined,
        source: typeof record.source === "string" ? record.source : undefined,
      };
    });
}

function formatStats(card: ListingCard) {
  const items: string[] = [];
  if (typeof card.beds === "number") {
    items.push(`${card.beds} bd`);
  }
  if (typeof card.baths === "number") {
    items.push(`${card.baths} ba`);
  }
  if (typeof card.sqft === "number") {
    items.push(`${numberFormatter.format(card.sqft)} sqft`);
  }

  return items.join(" | ");
}

export default async function ResultPage({ params }: ResultPageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/results/${id}`)}`);
  }
  const savedResult = await prisma.savedResult.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!savedResult) {
    notFound();
  }

  const content =
    savedResult.contentJson && typeof savedResult.contentJson === "object"
      ? (savedResult.contentJson as Record<string, unknown>)
      : {};

  const answer =
    typeof content.answer === "string" && content.answer.trim()
      ? content.answer
      : savedResult.contentText;
  const cards = normalizeCards(content.cards);
  const followUps = Array.isArray(content.followUps)
    ? content.followUps.filter((x): x is string => typeof x === "string")
    : [];

  return (
    <main className="portal-shell ambient-noise relative min-h-screen overflow-hidden px-5 py-8 sm:px-8">
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <section className="relative z-20 mx-auto w-full max-w-4xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
              t-agent saved result
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white/95">{savedResult.title}</h1>
            <p className="mt-1 text-sm text-white/70">
              Query: <span className="text-white/86">{savedResult.query}</span>
            </p>
            <p className="mt-1 text-xs text-white/56">
              Saved {new Date(savedResult.createdAt).toLocaleString()}
            </p>
          </div>
          <Link
            href="/leads/dashboard"
            className="rounded-full border border-white/20 bg-white/[0.05] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white/88 uppercase transition hover:bg-white/[0.1]"
          >
            Back to Dashboard
          </Link>
        </header>

        <article className="results-panel rounded-3xl p-5 sm:p-7">
          <h2 className="text-sm font-semibold tracking-[0.12em] text-violet-100/84 uppercase">
            Summary
          </h2>
          <div className="mt-3">
            <AnswerRenderer text={answer} />
          </div>

          {cards.length ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold tracking-[0.12em] text-violet-100/84 uppercase">
                Listings
              </h3>
              <div className="mt-3 grid gap-3">
                {cards.map((card, index) => (
                  <article
                    key={`${card.address}-${index}`}
                    className="rounded-2xl border border-white/14 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-white/93">
                          {card.address}
                        </h4>
                        <p className="mt-1 text-sm font-medium text-violet-100/90">
                          {typeof card.price === "number"
                            ? moneyFormatter.format(card.price)
                            : "Price on request"}
                        </p>
                        {formatStats(card) ? (
                          <p className="mt-1 text-xs tracking-[0.08em] text-white/62 uppercase">
                            {formatStats(card)}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full border border-white/16 px-2.5 py-1 text-[0.62rem] tracking-[0.11em] text-white/68 uppercase">
                        {card.source || "listing"}
                      </span>
                    </div>

                    {card.summaryBullets?.length ? (
                      <ul className="mt-3 space-y-1.5 text-sm text-white/78">
                        {card.summaryBullets.map((bullet, bulletIndex) => (
                          <li key={`${bullet}-${bulletIndex}`} className="flex gap-2.5">
                            <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-200/75" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {followUps.length ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold tracking-[0.12em] text-violet-100/84 uppercase">
                Suggested Follow-ups
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm text-white/80">
                {followUps.map((followUp, index) => (
                  <li key={`${followUp}-${index}`} className="flex gap-2.5">
                    <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-200/75" />
                    <span>{followUp}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
