import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { money, UNIT_NAMES, BASE, type Prices } from "@/lib/laundry/config";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const op = await prisma.laundryOperator.findFirst({
    where: { slug, status: "approved" },
  });
  return {
    title: op ? `${op.name} — ${op.city}, ${op.state}` : "Operator not found",
    alternates: { canonical: `${BASE}/laundry/operators/${slug}` },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const op = await prisma.laundryOperator.findFirst({
    where: { slug, status: "approved" },
  });
  if (!op) notFound();
  const reviews = await prisma.laundryReview.findMany({
    where: {
      status: "published",
      lead: { operatorId: op.id, status: "delivered" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="wrap page">
      <p className="eyebrow">
        {op.city}, {op.state} ·{" "}
        {op.anchor ? "Affiliated KC anchor" : "Independent operator"}
      </p>
      <h1>{op.name}</h1>
      <div className="profile">
        <div className="stack">
          <div className="card">
            <h2>Meet your local operator.</h2>
            <p>{op.description}</p>
            <p className="muted">
              Rental provider: {op.legalName}
              <br />
              {op.address}
              <br />
              <a href={`tel:${op.phone}`}>{op.phone}</a>
            </p>
            {op.anchor && (
              <p className="tiny">
                Wash & Dry is affiliated with this marketplace and receives KC
                leads at no charge.
              </p>
            )}
          </div>
          <div className="card">
            <h3>Service area</h3>
            <p>
              {op.zips.length
                ? "Serves the following ZIP codes:"
                : `Within approximately ${op.radiusMiles} miles of ${op.zip}. Street address coverage is confirmed by the operator.`}
            </p>
            <p className="coverage muted">{op.zips.join(" · ")}</p>
          </div>
          <div className="card">
            <h3>Rental terms</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{op.rentalTerms}</p>
          </div>
        </div>
        <aside className="stack" style={{ alignContent: "start" }}>
          <div className="card">
            <h3>Clear prices. Local service.</h3>
            {Object.entries(op.prices as Prices).map(([unit, cents]) => (
              <p key={unit}>
                {UNIT_NAMES[unit]}{" "}
                <strong style={{ float: "right" }}>{money(cents!)}/mo</strong>
              </p>
            ))}
            <p>
              Delivery{" "}
              <strong style={{ float: "right" }}>
                {money(op.deliveryFeeCents)}
              </strong>
            </p>
            <Link
              className="button"
              href={`/laundry/request?operator=${op.id}`}
            >
              Request a rental ↗
            </Link>
            <p className="tiny">
              Your preferred date is confirmed by the operator. No renter
              payment is collected here.
            </p>
          </div>
          <div className="card">
            <h3>Verified-booking reviews</h3>
            {reviews.length ? (
              reviews.map((r) => (
                <div key={r.id}>
                  <p>
                    <strong>
                      {r.rating}/5 · {r.displayName}
                    </strong>
                  </p>
                  <p>{r.body}</p>
                </div>
              ))
            ) : (
              <p className="muted">
                No reviews yet. Renters can review their operator after
                delivery.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
