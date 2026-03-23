"use client";

import { useState } from "react";

interface MetroArea {
  name: string;
  state: string;
  listingCount: number;
  description: string;
  highlights: string[];
}

const KC_METRO_AREAS: MetroArea[] = [
  {
    name: "Kansas City",
    state: "MO",
    listingCount: 0,
    description: "The heart of the metro — diverse neighborhoods from River Market to Brookside, world-class BBQ, sports, and a booming tech scene.",
    highlights: ["Power & Light District", "Country Club Plaza", "Union Station", "Westport"],
  },
  {
    name: "Overland Park",
    state: "KS",
    listingCount: 0,
    description: "Top-rated Johnson County schools, corporate headquarters, and family-friendly suburbs. Consistently ranked among best places to live.",
    highlights: ["Top Schools", "Corporate HQ Hub", "Arboretum", "Town Center"],
  },
  {
    name: "Lee's Summit",
    state: "MO",
    listingCount: 0,
    description: "Fast-growing city with excellent schools, lakefront living at Lake Lotawana, and a charming downtown district.",
    highlights: ["Lake Lotawana", "Downtown District", "Summit Fair", "Great Schools"],
  },
  {
    name: "Independence",
    state: "MO",
    listingCount: 0,
    description: "Historic city — home of Harry S. Truman. Affordable housing, strong community, and rich heritage along the Santa Fe Trail.",
    highlights: ["Truman Library", "Square District", "Affordable Housing", "Historic Trails"],
  },
  {
    name: "Olathe",
    state: "KS",
    listingCount: 0,
    description: "One of the fastest-growing cities in Kansas. Great schools, parks, and easy access to KC metro jobs.",
    highlights: ["Top Schools", "Ernie Miller Park", "Great Plains Mall", "Growing Economy"],
  },
  {
    name: "Blue Springs",
    state: "MO",
    listingCount: 0,
    description: "Family-oriented community east of KC with beautiful parks, good schools, and proximity to Lake Jacomo.",
    highlights: ["Lake Jacomo", "Burr Oak Woods", "Family Friendly", "Affordable"],
  },
  {
    name: "Liberty",
    state: "MO",
    listingCount: 0,
    description: "Historic Northland city with a vibrant downtown square, Liberty University, and strong housing appreciation.",
    highlights: ["Historic Square", "William Jewell", "Northland Hub", "Growing Market"],
  },
  {
    name: "Shawnee",
    state: "KS",
    listingCount: 0,
    description: "Johnson County suburb with excellent recreation, Shawnee Mission Park, and easy highway access to downtown KC.",
    highlights: ["Shawnee Mission Park", "Wonderful Trails", "Good Schools", "Central Location"],
  },
  {
    name: "Lenexa",
    state: "KS",
    listingCount: 0,
    description: "Growing tech corridor with City Center development, great dining scene, and family-oriented neighborhoods.",
    highlights: ["City Center", "Tech Corridor", "Great Parks", "Farmers Market"],
  },
  {
    name: "Gladstone",
    state: "MO",
    listingCount: 0,
    description: "Northland community with affordable homes, quick downtown access, and improving infrastructure.",
    highlights: ["Affordable", "Near Airport", "Oak Grove Park", "Northland Access"],
  },
  {
    name: "Raytown",
    state: "MO",
    listingCount: 0,
    description: "Central location between downtown KC and eastern suburbs. Established neighborhoods with renovation potential.",
    highlights: ["Central Location", "Renovation Opportunity", "Diverse Community", "Affordable Entry"],
  },
  {
    name: "Leawood",
    state: "KS",
    listingCount: 0,
    description: "Premier luxury suburb with upscale shopping, dining, and some of the highest home values in the metro.",
    highlights: ["Park Place", "Luxury Homes", "Town Center Plaza", "Top Schools"],
  },
];

export function MetroExplorer({ listingsByCity }: { listingsByCity: Record<string, number> }) {
  const [expanded, setExpanded] = useState(false);

  const areas = KC_METRO_AREAS.map((a) => ({
    ...a,
    listingCount: listingsByCity[a.name.toLowerCase()] || listingsByCity[a.name] || 0,
  }));

  const displayed = expanded ? areas : areas.slice(0, 6);

  return (
    <div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--cl-text)", marginBottom: "0.5rem" }}>
        KC Metro Explorer
      </h2>
      <p style={{ fontSize: "0.85rem", color: "var(--cl-text-muted)", marginBottom: "1.25rem" }}>
        12 metro areas across Missouri & Kansas — live listing counts, local highlights, and neighborhood intel
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
        {displayed.map((area) => (
          <div key={area.name} className="cl-card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div>
                <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--cl-text)" }}>
                  {area.name}
                </span>
                <span style={{ marginLeft: "6px", fontSize: "0.7rem", color: "var(--cl-text-light)", fontWeight: 500 }}>
                  {area.state}
                </span>
              </div>
              {area.listingCount > 0 && (
                <span style={{
                  padding: "3px 10px",
                  borderRadius: "999px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  background: "rgba(201, 168, 76, 0.12)",
                  color: "var(--cl-gold-light)",
                  border: "1px solid rgba(201, 168, 76, 0.2)",
                }}>
                  {area.listingCount} listings
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--cl-text-muted)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
              {area.description}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {area.highlights.map((h) => (
                <span
                  key={h}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--cl-text-light)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {areas.length > 6 && (
        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: "none",
              border: "1px solid var(--cl-border)",
              color: "var(--cl-gold)",
              padding: "8px 24px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {expanded ? "Show Less" : `Show All ${areas.length} Areas`}
          </button>
        </div>
      )}
    </div>
  );
}
