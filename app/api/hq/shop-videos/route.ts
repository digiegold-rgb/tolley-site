import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { shopVideoGate } from "@/lib/shop-video/auth";
import { createBatch, dashboard, dispatchQueued, jobAction, recoverJob, refreshJobs, saveCommission, saveProduct, ShopVideoError, verifyAccount } from "@/lib/shop-video/store";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=120;
function error(e:unknown) {
  if (e instanceof SyntaxError) return NextResponse.json({error:"Invalid JSON request"},{status:400});
  if (e instanceof z.ZodError) return NextResponse.json({error:e.issues.map(i=>i.message).join("; ")},{status:400});
  if (e instanceof ShopVideoError) return NextResponse.json({error:e.message},{status:e.status});
  // No SQL, credentials, provider request payloads or input bytes in responses.
  console.error("[shop-video] request failed",e instanceof Error?e.name:"UnknownError");
  return NextResponse.json({error:"Shop Video Batch could not complete this request. Check the service setup and try refreshing."},{status:503});
}
export async function GET(req:NextRequest) {
  const denied=await shopVideoGate(req); if (denied) return denied;
  try { return NextResponse.json(await dashboard(),{headers:{"Cache-Control":"private, no-store"}}); } catch(e) { return error(e); }
}
export async function POST(req:NextRequest) {
  const denied=await shopVideoGate(req); if (denied) return denied;
  try {
    const raw=await req.text(); if (raw.length>32000) throw new ShopVideoError("Request too large",413);
    const body=z.object({kind:z.enum(["product","account","batch","refresh","job","commission"]),data:z.unknown(),id:z.string().optional()}).parse(JSON.parse(raw));
    let result;
    switch(body.kind) {
      case "product": result=await saveProduct(body.data); break;
      case "account": result=await verifyAccount(body.data); break;
      case "batch": result=await createBatch(body.data); await dispatchQueued(result.id); break;
      case "refresh": await refreshJobs(); break;
      case "job": if (!body.id) throw new ShopVideoError("Video ID is required"); result=z.object({action:z.string()}).parse(body.data).action==="recover"?await recoverJob(body.id):await jobAction(body.id,body.data); break;
      case "commission": result=await saveCommission(body.data); break;
    }
    return NextResponse.json({ok:true,result});
  } catch(e) { return error(e); }
}
