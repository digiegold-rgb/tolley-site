import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { formatShowTime, canPromote } from "@/lib/live/campaign";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const id = params.get("show");
  const show = id ? await prisma.liveShow.findUnique({ where: { id } }) : null;
  const current = show && canPromote(show) ? show : null;
  if (params.get("format") === "cover") return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#f5f1e7", color: "#17251c", padding: "70px 100px", justifyContent: "space-between", alignItems: "center", fontFamily: "sans-serif" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 25 }}><span style={{ fontSize: 30, letterSpacing: 7 }}>TREASURE HAULS</span><span style={{ fontSize: 72, fontWeight: 800 }}>Come for the show.</span><span style={{ fontSize: 72, fontWeight: 800, color: "#c3451f" }}>Stay for the steals.</span><span style={{ fontSize: 28 }}>Jared + Ruthann · tolley.io/live</span></div>
    <div style={{ display: "flex", flexDirection: "column", background: "#daca54", padding: "40px", gap: 18 }}><span style={{ fontSize: 150, fontWeight: 900 }}>8:31</span><span style={{ fontSize: 28 }}>PM CENTRAL · MOST EVENINGS</span><span style={{ fontSize: 24 }}>Check our confirmed schedule</span></div>
  </div>, { width: 1640, height: 624, headers: { "Cache-Control": "no-store" } });
  const story = params.get("format") === "story";
  return new ImageResponse(<div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#f5f1e7", color: "#17251c", padding: "90px", justifyContent: "space-between", fontFamily: "sans-serif" }}>
    <div style={{ display: "flex", fontSize: 30, letterSpacing: 7 }}>TREASURE HAULS · WHATNOT</div>
    <div style={{ display: "flex", flexDirection: "column" }}><div style={{ fontSize: 210, fontWeight: 900, letterSpacing: -14 }}>8:31</div><div style={{ fontSize: 40, letterSpacing: 9 }}>PM CENTRAL</div></div>
    <div style={{ display: "flex", flexDirection: "column", fontSize: 94, fontWeight: 800, lineHeight: 1.05, letterSpacing: -4 }}><span>Come for</span><span>the show.</span><span style={{ color: "#c3451f" }}>Stay for</span><span style={{ color: "#c3451f" }}>the steals.</span></div>
    <div style={{ display: "flex", flexDirection: "column", padding: "30px", background: "#daca54", fontSize: 30, gap: 15 }}><span>{current ? current.title : "Jared + Ruthann + a table full of surprises"}</span><span>{current ? formatShowTime(current.startsAt) : "Most evenings · Check confirmed dates"}</span></div>
    <div style={{ fontSize: 32 }}>tolley.io/live · @treasure_hauls</div>
  </div>, { width: 1080, height: story ? 1920 : 1350, headers: { "Cache-Control": "no-store" } });
}
