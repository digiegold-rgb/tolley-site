import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    product: "Tolley.io Video",
    url: "https://www.tolley.io/video",
    summary:
      "AI video generation and library — Wan2.2 + F5-TTS + ComfyUI pipeline, full-local DGX rendering, with cloud fallbacks.",
    pricing: { credits: { perCredit: 0.50, monthly: 19 }, currency: "USD" },
    capabilities: [
      "Text-to-video (Wan2.2 S2V)",
      "Voice synthesis (F5-TTS)",
      "Image-to-video animation",
      "Project workspace with timeline editor",
      "Cloud rendering fallback (Modal)",
      "5-platform auto-posting (YT/TT/FB/IG/Pinterest)",
    ],
    schemas: {
      VideoProject: {
        id: "string",
        title: "string",
        duration: "number",
        status: "draft | rendering | completed",
        scenes: "Scene[]",
      },
    },
    cta: {
      signup: "https://www.tolley.io/signup",
      vater: "https://www.tolley.io/vater",
    },
  });
}
