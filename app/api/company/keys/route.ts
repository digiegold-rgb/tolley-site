import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createApiKey, countLiveApiKeys } from "@/lib/vater/api-keys";
import { body, endpoint, json } from "@/lib/company/auth";
import { COMPANY_SCOPES, CompanyError } from "@/lib/company/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function sessionUser() {
  const s = await auth(); if (!s?.user?.id || s.impersonatedBy) throw new CompanyError("login_required", 401);
  return s.user.id;
}
export async function GET() { return endpoint(async () => {
  const userId = await sessionUser();
  return json({ keys: await prisma.vaterApiKey.findMany({ where: { userId, revokedAt: null }, select: { id: true, name: true, prefix: true } }), grants: await prisma.companyKeyGrant.findMany({ where: { userId } }) });
}); }
export async function POST(req: NextRequest) { return endpoint(async () => {
  const userId = await sessionUser();
  if (req.headers.get("origin") !== req.nextUrl.origin) throw new CompanyError("origin_required", 403);
  const v = z.object({ keyId: z.string().max(150).optional(), name: z.string().min(1).max(80).default("Tolley agent"), scopes: z.array(z.enum(COMPANY_SCOPES)).max(4), monthlyLimitCents: z.number().int().min(0).max(1000000) }).strict().parse(await body(req));
  let keyId = v.keyId; let plaintext: string | undefined;
  if (!keyId) {
    if (await countLiveApiKeys(userId) >= 10) throw new CompanyError("key_limit", 409);
    const key = await createApiKey(userId, v.name, undefined, "company"); keyId = key.row.id; plaintext = key.plaintext;
  }
  const key = await prisma.vaterApiKey.findFirst({ where: { id: keyId, userId, revokedAt: null } });
  if (!key) throw new CompanyError("key_not_found", 404);
  await prisma.companyKeyGrant.upsert({ where: { keyId }, create: { keyId, userId, scopes: v.scopes, monthlyLimitCents: v.monthlyLimitCents }, update: { scopes: v.scopes, monthlyLimitCents: v.monthlyLimitCents } });
  return json({ keyId, ...(plaintext ? { key: plaintext } : {}), scopes: v.scopes, monthlyLimitCents: v.monthlyLimitCents });
}); }
