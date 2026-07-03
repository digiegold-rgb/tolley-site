import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/client/public
 *
 * Public read of the Client Portal. Capability + portal description only.
 * No user-private invoices, contracts, or service history.
 */
export async function GET() {
  return NextResponse.json(
    {
      product: "Tolley.io Client Portal",
      url: "https://www.tolley.io/client",
      summary:
        "Account dashboard for Tolley.io customers — view invoices, contracts, service history, and pay outstanding balances.",
      capabilities: [
        "Invoice viewing + Stripe ACH/card payment",
        "Contract download (rentals, leases)",
        "Service history (delivery, install, maintenance)",
        "Support ticket + chat",
        "Recurring billing self-management",
      ],
      schemas: {
        Invoice: { number: "string", issueDate: "ISO date", dueDate: "ISO date", status: "string", amount: "number" },
        Contract: { id: "string", type: "string", startDate: "ISO date", endDate: "ISO date" },
      },
      cta: {
        login: "https://www.tolley.io/login",
        signup: "https://www.tolley.io/signup",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
