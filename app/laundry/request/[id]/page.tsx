import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyReceipt, publicOperators } from "@/lib/laundry/store";
import { ReceiptActions } from "@/components/laundry/receipt-actions";
import { RequestForm } from "@/components/laundry/request-form";
export const metadata = {
  title: "Your rental request",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params,
    { token = "" } = await searchParams;
  if (!verifyReceipt(id, token)) notFound();
  const lead = await prisma.laundryLead.findUnique({
    where: { id },
    include: { operator: true, review: true },
  });
  if (!lead) notFound();
  const reroute = ["declined", "waitlisted", "expired"].includes(lead.status);
  return (
    <div className="wrap page">
      <p className="eyebrow">Your private request</p>
      <h1>
        {lead.status === "booked"
          ? "Your delivery is booked."
          : lead.status === "delivered"
            ? "Welcome to laundry at home."
            : "Your request is saved."}
      </h1>
      <div className="stack" style={{ maxWidth: 850 }}>
        <div className="card">
          <span className="badge">{lead.status.toUpperCase()}</span>
          <p>
            {lead.name} · {lead.address} · {lead.zip}
          </p>
          <p>
            {lead.operator?.name || "No operator assigned"}
            <br />
            Preferred day: {lead.preferredDate}
            {lead.deliveryDate && (
              <>
                <br />
                Confirmed day: <strong>{lead.deliveryDate}</strong>
              </>
            )}
          </p>
          {!["booked", "delivered"].includes(lead.status) && (
            <p className="muted">
              A saved request is not a confirmed delivery.
            </p>
          )}
          {lead.agreementText && (
            <>
              <a
                className="button ghost"
                href={`/api/laundry/receipt?id=${id}&token=${token}`}
              >
                Download signed agreement
              </a>
              <details>
                <summary>Read signed agreement</summary>
                <pre className="agreement">
                  {lead.agreementText}
                  {`\n\nSigned by ${lead.signedName} on ${lead.signedAt?.toISOString()}`}
                </pre>
              </details>
            </>
          )}
          <ReceiptActions
            id={id}
            token={token}
            status={lead.status}
            reviewed={!!lead.review}
          />
        </div>
        {reroute && (
          <>
            <h2>Choose another local operator.</h2>
            <p>
              Your information will only go to the operator whose agreement you
              sign.
            </p>
            <RequestForm
              operators={await publicOperators(lead.zip)}
              existing={{ id, token, name: lead.name, unit: lead.unit }}
            />
          </>
        )}
      </div>
    </div>
  );
}
