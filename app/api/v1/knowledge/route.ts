import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { principal, body, endpoint, json } from "@/lib/company/auth";
import { knowledge } from "@/lib/company/store";
import { fingerprint } from "@/lib/company/policy";
export const runtime = "nodejs";
export async function GET(req: NextRequest) { return endpoint(async () => { const p = req.headers.has("authorization") ? await principal(req, "knowledge:read") : null; return json({ items: await knowledge(p?.userId || null, req.nextUrl.searchParams.get("q") || "") }); }); }
export async function POST(req: NextRequest) { return endpoint(async () => {
 const p = await principal(req, "knowledge:write");
 const v = z.object({ title: z.string().min(1).max(200), content: z.string().min(1).max(20000), reference: z.string().min(1).max(100) }).strict().parse(await body(req));
 const row = await prisma.companyKnowledge.upsert({ where: { sourceKey: `customer:${p.userId}:${v.reference}` }, create: { sourceKey: `customer:${p.userId}:${v.reference}`, userId: p.userId, audience: "customer", title: v.title, body: v.content, sources: [], contentHash: fingerprint(v.content), status: "verified", evidence: { method: "customer_supplied", factualVerification: "not_independently_verified" } }, update: { title: v.title, body: v.content, contentHash: fingerprint(v.content), status: "verified", evidence: { method: "customer_supplied", factualVerification: "not_independently_verified" } } });
 return json({ id: row.id, audience: "customer", factualVerification: "not_independently_verified" }, 201);
}); }
export async function DELETE(req: NextRequest) { return endpoint(async () => {
 const p = await principal(req, "knowledge:write"); const id = req.nextUrl.searchParams.get("id") || "";
 await prisma.companyKnowledge.updateMany({ where: { id, userId: p.userId, audience: "customer" }, data: { status: "retracted", body: "", sources: [], evidence: { retracted: true } } }); return json({ ok: true });
}); }
