/**
 * /v — admin gallery of every generated B2B lead video. Gated by the same
 * PIN cookie as /hq (validateWdAdmin); strangers get bounced to /hq to log
 * in. Individual watch pages at /v/[slug] stay public-by-link for prospects.
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lead Videos — Tolley Growth",
  robots: { index: false, follow: false },
};

export default async function VideoGalleryPage() {
  const { authed } = await validateWdAdmin();
  if (!authed) redirect("/hq");

  const leads = await prisma.growthLead.findMany({
    where: { videoAssetUrl: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      city: true,
      category: true,
      stage: true,
      rating: true,
      reviews: true,
      videoUrl: true,
      videoAssetUrl: true,
    },
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0c0d10", color: "#f2f0ea", padding: "40px 28px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontSize: 26, fontWeight: 750, margin: 0 }}>
            Lead videos <span style={{ color: "#8a877e", fontWeight: 500, fontSize: 16 }}>· {leads.length} rendered</span>
          </h1>
          <a href="/hq" style={{ color: "#7da2e8", fontSize: 14, textDecoration: "none" }}>← Back to /hq</a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20, marginTop: 28 }}>
          {leads.map((l) => (
            <div key={l.id} style={{ background: "#16171c", border: "1px solid #26272e", borderRadius: 10, overflow: "hidden" }}>
              <video
                src={l.videoAssetUrl ?? undefined}
                controls
                muted
                playsInline
                preload="metadata"
                style={{ width: "100%", aspectRatio: "16/9", background: "#000", display: "block" }}
              />
              <div style={{ padding: "12px 14px 14px" }}>
                <div style={{ fontWeight: 650, fontSize: 14.5 }}>{l.name}</div>
                <div style={{ color: "#8a877e", fontSize: 12, marginTop: 3 }}>
                  {[l.category, l.city].filter(Boolean).join(" · ")}
                  {l.rating ? ` · ${l.rating}★ (${l.reviews ?? 0})` : ""}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12.5 }}>
                  <span style={{ color: "#b5b1a4", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10.5, alignSelf: "center" }}>
                    {l.stage}
                  </span>
                  {l.videoUrl && (
                    <a href={l.videoUrl} target="_blank" rel="noreferrer" style={{ color: "#7da2e8", textDecoration: "none" }}>
                      Watch page →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {leads.length === 0 && (
          <p style={{ color: "#8a877e", marginTop: 40 }}>
            No videos rendered yet — run <code>scripts/generate-lead-videos.ts</code>.
          </p>
        )}
      </div>
    </div>
  );
}
