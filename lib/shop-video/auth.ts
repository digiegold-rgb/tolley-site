import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";

export async function shopVideoGate(req?: NextRequest) {
  // No sync-secret, shop PIN, collaborator or worker bypass for spend/earnings.
  if (!(await validateWdAdmin()).authed) return NextResponse.json({error:"Owner sign-in required"},{status:401});
  if (req && req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    // Next's middleware normalizes loopback request URLs to localhost. The
    // incoming Host retains the browser's actual hostname (and Vercel domain).
    const expected=new URL(req.nextUrl.origin);
    expected.host=req.headers.get("host")||expected.host;
    if (origin && origin !== expected.origin) return NextResponse.json({error:"Invalid request origin"},{status:403});
  }
  return null;
}
