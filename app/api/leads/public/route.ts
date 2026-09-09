import { LEADS_TIERS } from "@/lib/leads-subscription";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leads/public
 *
 * Public read of T-Agent Lead Pipeline. Product metadata + Lead schema.
 * No real lead data — those are user-private and stay behind auth.
 */
export async function GET() {
  return NextResponse.json(
    {
      product: "T-Agent Lead Pipeline",
      url: "https://www.tolley.io/agent",
      workspace: "https://www.tolley.io/leads/dashboard",
      summary:
        "AI-driven motivated-seller lead pipeline for real estate agents — weekly digests, scoring, dossier synthesis, MLS-grid integration.",
      pricing: Object.fromEntries(LEADS_TIERS.map(tier => [tier.id, {
        monthly: tier.price, currency: "USD", includes: tier.features.join(", "),
      }])),
      capabilities: [
        "MLS-grid IDX/VOW import",
        "Lead scoring with motivated-seller signals",
        "Dossier synthesis (parcel + owner + market)",
        "Weekly Monday digest service",
        "Pipeline stages with referral tracking",
        "SMS auto-responder",
      ],
      schemas: {
        Lead: {
          ownerName: "string?",
          ownerEmail: "string?",
          ownerPhone: "string?",
          source: "string",
          status: "string",
          score: "number",
          pipelineStage: "string",
          parcelId: "string?",
          listingId: "string?",
        },
      },
      cta: {
        pricing: "https://www.tolley.io/leads/pricing",
        onboard: "https://www.tolley.io/leads/onboard",
        signup: "https://www.tolley.io/signup?callbackUrl=%2Fleads%2Fdashboard",
        demo: "https://www.tolley.io/agent#demo",
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
