// /v/[slug]/welcome — post-payment confirmation for the video offer.
//
// Stripe redirects here after a paid "Make it yours" checkout with
// ?session_id=…. We retrieve the session server-side and confirm it's PAID
// before showing the confirmation (mirrors /demo/[slug]/welcome, minus the
// intake form — video delivery starts with a text from Cordless instead).

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { DEMO_TOLLEY_PHONE, DEMO_TOLLEY_PHONE_TEL } from "@/lib/demo-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your video is confirmed",
  robots: { index: false, follow: false },
};

async function getLead(slug: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  return prisma.growthLead.findFirst({
    where: { videoUrl: `/v/${slug}` },
    select: { id: true, name: true },
  });
}

async function isSessionPaid(sessionId: string | undefined): Promise<boolean> {
  if (!sessionId || sessionId.length > 200) return false;
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.payment_status === "paid" || session.status === "complete";
  } catch (err) {
    console.error("[v/welcome] session retrieve failed", err);
    return false;
  }
}

export default async function VideoWelcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;

  const lead = await getLead(slug);
  if (!lead) notFound();

  const paid = await isSessionPaid(session_id);

  return (
    <div className="min-h-screen bg-[#0c0f14] px-4 py-14 text-white antialiased sm:py-20">
      <div className="mx-auto w-full max-w-xl">
        {paid ? (
          <div className="rounded-2xl border border-white/10 bg-[#101319] p-7 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
              🎬
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              You&apos;re in, {lead.name}.
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/65">
              Your video package is confirmed — $250 one-time + $99/mo. We&apos;ll
              text you within 1 business day to deliver your final cut and plan
              your next videos.
            </p>
            <p className="mt-6 text-xs text-white/45">
              Can&apos;t wait? Call or text{" "}
              <a
                href={DEMO_TOLLEY_PHONE_TEL}
                className="font-medium text-amber-400 underline underline-offset-2"
              >
                {DEMO_TOLLEY_PHONE}
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#101319] p-7 text-center shadow-2xl">
            <h1 className="text-2xl font-bold tracking-tight">Almost there</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/65">
              We couldn&apos;t confirm your payment yet. If you just paid, give
              it a moment and refresh. Otherwise, head back to your video to
              finish, or reach Cordless directly.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href={`/v/${slug}`}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/5"
              >
                Back to your video
              </a>
              <a
                href={DEMO_TOLLEY_PHONE_TEL}
                className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#1a1405] transition hover:bg-amber-300"
              >
                Call {DEMO_TOLLEY_PHONE}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
