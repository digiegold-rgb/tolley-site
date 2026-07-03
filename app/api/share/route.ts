import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getSubsite } from "@/lib/subsites";
import { isAdminPath } from "@/lib/agent-manifest";
import crypto from "node:crypto";

export const runtime = "nodejs";

/**
 * POST /api/share
 *
 * Mint a share link. Public — agents and anonymous users can call this.
 * Body: { subsite: string; path?: string; title?: string; meta?: object }
 * Returns: { token, url }
 *
 * Refuses to mint links to admin paths (defense in depth).
 */
export async function POST(req: Request) {
  let body: { subsite?: string; path?: string; title?: string; meta?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const subsite = (body.subsite || "").trim();
  const path = (body.path || "/").trim();

  if (!subsite || !/^[a-z0-9-]+$/.test(subsite)) {
    return NextResponse.json({ error: "Invalid subsite" }, { status: 400 });
  }
  if (!path.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (isAdminPath(path)) {
    return NextResponse.json({ error: "Admin paths cannot be shared" }, { status: 403 });
  }
  // The subsite name must exist in our manifest registry.
  if (!getSubsite(subsite)) {
    return NextResponse.json({ error: "Unknown subsite" }, { status: 404 });
  }

  const session = await auth().catch(() => null);
  const createdById = session?.user?.id ?? null;

  const token = crypto.randomBytes(8).toString("base64url");
  const link = await prisma.shareLink.create({
    data: {
      token,
      subsite,
      path,
      title: body.title ?? null,
      createdById,
      meta: (body.meta as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
    },
  });

  return NextResponse.json({
    token: link.token,
    url: `/s/${link.token}`,
    fullUrl: `https://www.tolley.io/s/${link.token}`,
  });
}
