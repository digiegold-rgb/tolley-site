// /sales/portal — the operator's dashboard. Auth-split like /animate: signed-out
// visitors get a sign-in prompt; signed-in operators get their storefront cards
// (status, share link, sales, copy editor, buyout request).
//
// Claim handshake: arriving with ?claim=<slug> from the signup flow links the
// (unclaimed) Operator to this user and stamps termsAcceptedAt — the checkbox
// on the signup form is what got them here, so reaching this route is consent.

import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { themeForKey } from "@/lib/demo-site";
import { parseOfferings } from "@/lib/launchpad";
import {
  PortalCard,
  type PortalStorefront,
  type PortalSale,
} from "@/components/launchpad/portal-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Launchpad Portal | Tolley.io",
  description: "Manage your Launchpad storefront, track sales, and request a buyout.",
  robots: { index: false, follow: false },
};

async function claimIfPending(userId: string, claimSlug: string | undefined) {
  if (!claimSlug || !/^[a-z0-9-]{1,80}$/.test(claimSlug)) return;
  const op = await prisma.operator.findUnique({
    where: { slug: claimSlug },
    select: { id: true, userId: true },
  });
  if (!op) return;
  // Only bind an UNCLAIMED operator; first legitimate claimer wins.
  if (op.userId === null) {
    await prisma.operator.update({
      where: { id: op.id },
      data: { userId, termsAcceptedAt: new Date() },
    });
  }
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;

  if (!session?.user?.id) {
    const claim = typeof sp.claim === "string" ? sp.claim : "";
    const signupHref = claim
      ? `/signup?claim=${encodeURIComponent(claim)}`
      : "/signup?callbackUrl=/sales/portal";
    const loginHref = `/login?callbackUrl=${encodeURIComponent(
      claim ? `/sales/portal?claim=${claim}` : "/sales/portal",
    )}`;
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: "#141518", color: "#f4f2ee" }}
      >
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em]" style={{ color: "#ff8842" }}>
          The Launchpad
        </p>
        <h1 className="mt-3 text-3xl font-extrabold">Your operator portal</h1>
        <p className="mt-3 max-w-md text-sm" style={{ color: "#a7a49d" }}>
          {claim
            ? "Create your login to take ownership of your storefront and track your sales."
            : "Sign in to manage your storefront, track sales, and request a buyout."}
        </p>
        <div className="mt-7 flex gap-3">
          <Link href={signupHref} className="rounded-full px-6 py-3 text-sm font-bold" style={{ backgroundColor: "#ff6a13", color: "#141518" }}>
            {claim ? "Claim my storefront" : "Create account"}
          </Link>
          <Link href={loginHref} className="rounded-full px-6 py-3 text-sm font-semibold" style={{ backgroundColor: "#26282d", color: "#f4f2ee" }}>
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const userId = session.user.id;
  await claimIfPending(userId, typeof sp.claim === "string" ? sp.claim : undefined);

  const operators = await prisma.operator.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      slug: true,
      status: true,
      storefront: {
        select: {
          slug: true,
          businessName: true,
          category: true,
          tagline: true,
          about: true,
          city: true,
          phone: true,
          offerings: true,
          sellingEnabled: true,
          sales: {
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              offeringName: true,
              amountCents: true,
              kind: true,
              buyerName: true,
              buyerEmail: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const cards = operators
    .filter((op) => op.storefront)
    .map((op) => {
      const sf = op.storefront!;
      const storefront: PortalStorefront = {
        slug: sf.slug,
        businessName: sf.businessName,
        categoryLabel: themeForKey(sf.category).label,
        status: op.status,
        sellingEnabled: sf.sellingEnabled,
        tagline: sf.tagline ?? "",
        about: sf.about ?? "",
        city: sf.city ?? "",
        phone: sf.phone ?? "",
        offerings: parseOfferings(sf.offerings),
      };
      const sales: PortalSale[] = sf.sales.map((s) => ({
        id: s.id,
        offeringName: s.offeringName,
        amountCents: s.amountCents,
        kind: s.kind,
        buyerName: s.buyerName,
        buyerEmail: s.buyerEmail,
        createdAt: s.createdAt.toISOString(),
      }));
      return { storefront, sales };
    });

  return (
    <main className="min-h-screen px-5 py-12 sm:px-8" style={{ backgroundColor: "#141518", color: "#f4f2ee" }}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em]" style={{ color: "#ff8842" }}>
              The Launchpad · Operator Portal
            </p>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              {session.user.email ? session.user.email : "Welcome back"}
            </h1>
          </div>
          <Link href="/sales/terms" className="text-sm underline underline-offset-2" style={{ color: "#a7a49d" }}>
            Operator terms
          </Link>
        </div>

        {cards.length === 0 ? (
          <div
            className="mt-10 rounded-2xl p-8 text-center"
            style={{ backgroundColor: "#1c1e22", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <p className="text-lg font-bold">No storefront linked to this account yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "#a7a49d" }}>
              If you just submitted a Work Order, open the claim link Jared sent you.
              Otherwise, start a business on The Launchpad.
            </p>
            <Link href="/sales" className="mt-6 inline-block rounded-full px-6 py-3 text-sm font-bold" style={{ backgroundColor: "#ff6a13", color: "#141518" }}>
              Start on The Launchpad →
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {cards.map((c) => (
              <PortalCard key={c.storefront.slug} storefront={c.storefront} sales={c.sales} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
