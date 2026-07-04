import { ImageResponse } from "next/og";

import { prisma } from "@/lib/prisma";
import { themeForKey } from "@/lib/demo-site";

export const alt = "A Launchpad storefront on Tolley.io";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let businessName = "Your Business";
  let label = "Local Business";
  let city = "";
  if (/^[a-z0-9-]{1,80}$/.test(slug)) {
    const sf = await prisma.storefront
      .findUnique({
        where: { slug },
        select: { businessName: true, category: true, city: true },
      })
      .catch(() => null);
    if (sf) {
      businessName = sf.businessName;
      label = themeForKey(sf.category).label;
      city = sf.city || "";
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#141518",
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 80% 0%, rgba(255,106,19,0.28), transparent 70%)",
          color: "#f4f2ee",
          padding: 80,
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#ff8842",
            fontSize: 22,
            display: "flex",
          }}
        >
          The Launchpad · Tolley.io
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: "sans-serif",
              fontWeight: 800,
              fontSize: 82,
              lineHeight: 1.03,
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            {businessName.slice(0, 44)}
          </div>
          <div
            style={{
              marginTop: 24,
              fontFamily: "sans-serif",
              fontSize: 34,
              color: "#a7a49d",
              display: "flex",
            }}
          >
            {label}
            {city ? ` · ${city}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ height: 4, width: 120, background: "#ff6a13", display: "flex" }} />
          <div
            style={{
              fontFamily: "sans-serif",
              fontSize: 24,
              fontWeight: 700,
              color: "#ff8842",
              display: "flex",
            }}
          >
            tolley.io/biz/{slug.slice(0, 32)}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
