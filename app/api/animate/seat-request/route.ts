/**
 * POST /api/animate/seat-request — public "Request a seat" on /animate.
 *
 * Persists a LeadAction (animate / invite-request), emails Jared, and sends
 * ONE operator SMS to +19132833826. Never texts the requester. Never uses
 * the Wash & Dry A2P messaging service.
 */
import { NextRequest } from "next/server";

import { handleSeatRequest } from "@/lib/animate/seat-request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleSeatRequest(request);
}
