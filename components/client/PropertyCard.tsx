"use client";

/* eslint-disable @next/next/no-img-element */

export interface ListingData {
  id: string;
  mlsId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  daysOnMarket: number | null;
  photoUrl: string | null;
  buyScore: number;
  propertyType: string | null;
}

export function PropertyCard({ listing }: { listing: ListingData }) {
  const priceStr = listing.listPrice
    ? `$${listing.listPrice.toLocaleString()}`
    : "Price TBD";

  const scoreDotColor =
    listing.buyScore >= 70
      ? "var(--cl-positive)"
      : listing.buyScore >= 40
        ? "var(--cl-accent)"
        : "var(--cl-negative)";

  return (
    <div className="cl-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="cl-property-photo">
        {listing.photoUrl ? (
          <img src={listing.photoUrl} alt={listing.address} loading="lazy" />
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
        {listing.daysOnMarket !== null && (
          <div className="cl-dom-badge">{listing.daysOnMarket} DOM</div>
        )}
      </div>
      <div style={{ padding: "1rem" }}>
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            color: "var(--cl-text)",
          }}
        >
          {priceStr}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginTop: "6px",
            fontSize: "0.85rem",
            color: "var(--cl-text-muted)",
          }}
        >
          {listing.beds !== null && <span>{listing.beds} bd</span>}
          {listing.baths !== null && <span>{listing.baths} ba</span>}
          {listing.sqft !== null && (
            <span>{listing.sqft.toLocaleString()} sqft</span>
          )}
        </div>
        <div
          style={{
            marginTop: "6px",
            fontSize: "0.8rem",
            color: "var(--cl-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            className="cl-score-dot"
            style={{ background: scoreDotColor }}
            title={`Buy Score: ${listing.buyScore}`}
          />
          {listing.address}
          {listing.city && `, ${listing.city}`}
        </div>
      </div>
    </div>
  );
}
