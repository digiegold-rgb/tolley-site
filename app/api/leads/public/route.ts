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
      url: "https://www.tolley.io/leads",
      summary:
        "AI-driven motivated-seller lead pipeline for real estate agents — weekly digests, scoring, dossier synthesis, MLS-grid integration.",
      pricing: {
        starter: { monthly: 49, includes: "100 leads/mo, weekly digest" },
        pro: { monthly: 149, includes: "500 leads/mo, daily digest, dossier synthesis, SMS auto-responder" },
        team: { monthly: 499, includes: "Unlimited leads, multi-agent, custom integrations" },
      },
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
