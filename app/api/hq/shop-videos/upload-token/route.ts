import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { shopVideoGate } from "@/lib/shop-video/auth";

export const runtime="nodejs";
export async function POST(req:NextRequest) {
  try {
    const body=await req.json() as HandleUploadBody;
    const response=await handleUpload({body,request:req,onBeforeGenerateToken:async pathname=>{
      if (await shopVideoGate(req)) throw new Error("Owner sign-in required");
      if (!/^shop-video-inputs\/[a-f0-9-]+\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i.test(pathname)) throw new Error("Invalid media path");
      return {allowedContentTypes:["image/jpeg","image/png","image/webp","video/mp4","video/quicktime","video/webm"],maximumSizeInBytes:60*1024*1024,addRandomSuffix:true};
    },onUploadCompleted:async()=>{}});
    return NextResponse.json(response);
  } catch { return NextResponse.json({error:"Product media upload failed"},{status:400}); }
}
