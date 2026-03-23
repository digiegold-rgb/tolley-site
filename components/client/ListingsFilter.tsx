"use client";

export interface FilterState {
  minPrice: string;
  maxPrice: string;
  beds: string;
  type: string;
}

export function ListingsFilter({
  filters,
  onChange,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}) {
  return (
    <div className="cl-filter-bar">
      <select
        value={filters.beds}
        onChange={(e) => onChange({ ...filters, beds: e.target.value })}
        aria-label="Bedrooms"
      >
        <option value="">Beds</option>
        <option value="1">1+</option>
        <option value="2">2+</option>
        <option value="3">3+</option>
        <option value="4">4+</option>
        <option value="5">5+</option>
      </select>
      <select
        value={filters.type}
        onChange={(e) => onChange({ ...filters, type: e.target.value })}
        aria-label="Property Type"
      >
        <option value="">Type</option>
        <option value="Single Family">Single Family</option>
        <option value="Condo">Condo</option>
        <option value="Townhouse">Townhouse</option>
        <option value="Multi-Family">Multi-Family</option>
      </select>
      <input
        type="number"
        placeholder="Min Price"
        value={filters.minPrice}
        onChange={(e) => onChange({ ...filters, minPrice: e.target.value })}
        aria-label="Minimum Price"
        style={{ width: "110px" }}
      />
      <input
        type="number"
        placeholder="Max Price"
        value={filters.maxPrice}
        onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
        aria-label="Maximum Price"
        style={{ width: "110px" }}
      />
    </div>
  );
}
