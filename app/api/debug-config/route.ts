import { NextResponse } from "next/server";

import { AGENT_URL } from "@/lib/agent-proxy";

export async function GET() {
  return NextResponse.json({
    agentUrl: AGENT_URL,
  });
}
