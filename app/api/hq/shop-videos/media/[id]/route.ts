import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopVideoGate } from "@/lib/shop-video/auth";
import { readVideo } from "@/lib/shop-video/cloud";
import { videoRange } from "@/lib/shop-video/core";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const denied=await shopVideoGate(req); if (denied) return denied;
  const {id}=await params;
  const job=await prisma.shopVideoJob.findUnique({where:{id},select:{outputSize:true}});
  if (!job?.outputSize) return NextResponse.json({error:"Video not ready"},{status:404});
  let range;
  try { range=videoRange(req.headers.get("range"),job.outputSize); }
  catch { return new NextResponse(null,{status:416,headers:{"Content-Range":`bytes */${job.outputSize}`}}); }
  try {
    const bytes=await readVideo(id,range.start,range.end);
    if (bytes.length!==range.end-range.start+1) throw new Error("Incomplete video");
    return new NextResponse(new Uint8Array(bytes),{status:range.partial?206:200,headers:{
      "Content-Type":"video/mp4","Content-Length":String(bytes.length),"Accept-Ranges":"bytes","Cache-Control":"private, no-store",
      "X-Content-Type-Options":"nosniff",...(range.partial?{"Content-Range":`bytes ${range.start}-${range.end}/${job.outputSize}`} : {}),
      ...(req.nextUrl.searchParams.has("download")?{"Content-Disposition":`attachment; filename="shop-video-${id}.mp4"`}:{}),
    }});
  } catch { return NextResponse.json({error:"Cloud video storage is temporarily unavailable"},{status:503}); }
}
