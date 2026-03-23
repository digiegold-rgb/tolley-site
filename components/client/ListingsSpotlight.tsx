"use client";

import { useState, useMemo, useCallback } from "react";
import { PropertyCard, type ListingData } from "./PropertyCard";
import { ListingsFilter, type FilterState } from "./ListingsFilter";

export function ListingsSpotlight({
  listings,
  city,
}: {
  listings: ListingData[];
  city: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    minPrice: "",
    maxPrice: "",
    beds: "",
    type: "",
  });
  const [apiListings, setApiListings] = useState<ListingData[] | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const source = apiListings ?? listings;
    return source.filter((l) => {
      if (filters.beds && (l.beds ?? 0) < parseInt(filters.beds)) return false;
      if (filters.minPrice && (l.listPrice ?? 0) < parseInt(filters.minPrice))
        return false;
      if (filters.maxPrice && (l.listPrice ?? 0) > parseInt(filters.maxPrice))
        return false;
      if (filters.type && l.propertyType !== filters.type) return false;
      return true;
    });
  }, [listings, apiListings, filters]);

  const displayed = expanded ? filtered : filtered.slice(0, 6);

  const handleFilterChange = useCallback(
    (f: FilterState) => {
      setFilters(f);
      // If any filter is set, fetch from API for wider results
      const hasFilter = f.beds || f.minPrice || f.maxPrice || f.type;
      if (hasFilter && !apiListings) {
        setLoading(true);
        const params = new URLSearchParams();
        if (f.beds) params.set("beds", f.beds);
        if (f.minPrice) params.set("minPrice", f.minPrice);
        if (f.maxPrice) params.set("maxPrice", f.maxPrice);
        if (f.type) params.set("type", f.type);
        params.set("limit", "48");
        fetch(`/api/client/listings?${params}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.listings) setApiListings(data.listings);
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    },
    [apiListings],
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--cl-text)",
          }}
        >
          Homes Near {city}
        </h2>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none",
            border: "1px solid var(--cl-border)",
            borderRadius: "8px",
            padding: "6px 16px",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--cl-primary)",
            cursor: "pointer",
          }}
        >
          {expanded ? "Show Less" : `See All (${filtered.length})`}
        </button>
      </div>

      {expanded && (
        <div style={{ marginBottom: "1rem" }}>
          <ListingsFilter filters={filters} onChange={handleFilterChange} />
        </div>
      )}

      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: "1rem",
            color: "var(--cl-text-muted)",
          }}
        >
          Loading listings…
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {displayed.map((listing) => (
          <PropertyCard key={listing.id} listing={listing} />
        ))}
      </div>

      {!displayed.length && !loading && (
        <div
          className="cl-card-static"
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "var(--cl-text-muted)",
          }}
        >
          No listings match your filters. Try adjusting your criteria.
        </div>
      )}
    </div>
  );
}
