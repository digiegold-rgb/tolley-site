/**
 * Compatibility alias for POST /api/vater/invite-request.
 * The landing form now POSTs /api/animate/seat-request. This URL stays so
 * older clients still file the LeadAction and page Jared.
 */
import { NextRequest } from "next/server";

import { handleSeatRequest } from "@/lib/animate/seat-request";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleSeatRequest(request);
}
