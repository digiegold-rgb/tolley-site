import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { isAdminEmail } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { mlsSweepSchema } from "@/lib/leads/mls-research";
import { ingestMlsSweep } from "@/lib/leads/mls-ingest";

export const maxDuration = 60;
export async function POST(req: NextRequest) {
  if (!secretEquals(req.headers.get("x-sync-secret"), process.env.SYNC_SECRET)) return NextResponse.json({error:"Unauthorized"},{status:401});
  const id = process.env.LEADS_DESK_SUBSCRIBER_ID;
  if (!id) return NextResponse.json({error:"Owner workspace not configured"},{status:503});
  const sub = await prisma.leadSubscriber.findUnique({where:{id},include:{user:{select:{email:true}}}});
  if (!sub || sub.status !== "active" || !isAdminEmail(sub.user.email)) return NextResponse.json({error:"Active owner workspace required"},{status:403});
  const input = mlsSweepSchema.safeParse(await req.json().catch(()=>null));
  if (!input.success) return NextResponse.json({error:"Invalid MLS sweep"},{status:400});
  try { return NextResponse.json(await ingestMlsSweep(sub.id,input.data)); }
  catch { return NextResponse.json({error:"Could not save fresh MLS research; safe to retry"},{status:422}); }
}
