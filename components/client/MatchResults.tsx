"use client";

import type { ListingData } from "./PropertyCard";

/* eslint-disable @next/next/no-img-element */
interface MatchedListing extends ListingData {
  fitScore: number;
}

export function MatchResults({ matches }: { matches: MatchedListing[] }) {
  if (!matches.length) {
    return (
      <div
        className="cl-card-static"
        style={{
          padding: "2rem",
          textAlign: "center",
          marginTop: "1.5rem",
          color: "var(--cl-text-muted)",
        }}
      >
        <p style={{ fontWeight: 600 }}>No exact matches found.</p>
        <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
          Try adjusting your preferences, or{" "}
          <a
            href="tel:913-283-3826"
            style={{ color: "var(--cl-primary)", fontWeight: 700 }}
          >
            call Jared
          </a>{" "}
          for a personalized search.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "1.25rem",
        marginTop: "1.5rem",
      }}
    >
      {matches.map((m) => (
        <div
          key={m.id}
          className="cl-card"
          style={{ padding: 0, overflow: "hidden", position: "relative" }}
        >
          {/* Fit score badge */}
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              zIndex: 2,
              background: "var(--cl-primary)",
              color: "white",
              borderRadius: "8px",
              padding: "4px 10px",
              fontSize: "0.75rem",
              fontWeight: 800,
            }}
          >
            {m.fitScore}% Match
          </div>

          <div className="cl-property-photo">
            {m.photoUrl ? (
              <img src={m.photoUrl} alt={m.address} loading="lazy" />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--cl-text-light)",
                  fontSize: "0.8rem",
                }}
              >
                No Photo
              </div>
            )}
          </div>

          <div style={{ padding: "1rem" }}>
            <div
              style={{
                fontSize: "1.15rem",
                fontWeight: 800,
                color: "var(--cl-text)",
              }}
            >
              {m.listPrice
                ? `$${m.listPrice.toLocaleString()}`
                : "Price TBD"}
            </div>
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "4px",
                fontSize: "0.85rem",
                color: "var(--cl-text-muted)",
              }}
            >
              {m.beds !== null && <span>{m.beds} bd</span>}
              {m.baths !== null && <span>{m.baths} ba</span>}
              {m.sqft !== null && (
                <span>{m.sqft.toLocaleString()} sqft</span>
              )}
            </div>
            <div
              style={{
                marginTop: "4px",
                fontSize: "0.8rem",
                color: "var(--cl-text-light)",
              }}
            >
              {m.address}
              {m.city && `, ${m.city}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
