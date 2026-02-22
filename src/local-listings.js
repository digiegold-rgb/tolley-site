const LOCAL_LISTINGS = [
  {
    address: "123 Mission Rd, Leawood, KS",
    city: "Leawood",
    state: "KS",
    price: 489000,
    beds: 3,
    baths: 2.5,
    sqft: 2180,
    photo: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200",
    link: "https://example.local/listings/leawood-123-mission",
    source: "Local MLS Cache",
  },
  {
    address: "9800 Sagamore Rd, Leawood, KS",
    city: "Leawood",
    state: "KS",
    price: 472500,
    beds: 4,
    baths: 3,
    sqft: 2460,
    photo: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200",
    link: "https://example.local/listings/leawood-9800-sagamore",
    source: "Local MLS Cache",
  },
  {
    address: "4309 W 123rd St, Overland Park, KS",
    city: "Overland Park",
    state: "KS",
    price: 455000,
    beds: 4,
    baths: 2.5,
    sqft: 2290,
    photo: "https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=1200",
    link: "https://example.local/listings/op-4309-w123rd",
    source: "Local MLS Cache",
  },
  {
    address: "12711 Howe Dr, Leawood, KS",
    city: "Leawood",
    state: "KS",
    price: 498000,
    beds: 4,
    baths: 3,
    sqft: 2640,
    photo: "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?w=1200",
    link: "https://example.local/listings/leawood-12711-howe",
    source: "Local MLS Cache",
  },
  {
    address: "7115 Oak St, Kansas City, MO",
    city: "Kansas City",
    state: "MO",
    price: 398000,
    beds: 3,
    baths: 2,
    sqft: 1910,
    photo: "https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200",
    link: "https://example.local/listings/kcmo-7115-oak",
    source: "Local MLS Cache",
  },
  {
    address: "10907 W 128th Ter, Overland Park, KS",
    city: "Overland Park",
    state: "KS",
    price: 512000,
    beds: 4,
    baths: 3.5,
    sqft: 2810,
    photo: "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=1200",
    link: "https://example.local/listings/op-10907-w128th",
    source: "Local MLS Cache",
  },
];

const DEFAULT_PRICE_LIMIT = 500000;

function normalizeCity(value) {
  return (value || "").trim().toLowerCase();
}

function normalizeState(value) {
  return (value || "").trim().toUpperCase();
}

function fetchLocalListings({ city, state, minBeds = 0, maxPrice = DEFAULT_PRICE_LIMIT }) {
  const normalizedCity = normalizeCity(city);
  const normalizedState = normalizeState(state);

  return LOCAL_LISTINGS.filter((listing) => {
    const cityMatches =
      !normalizedCity || normalizeCity(listing.city) === normalizedCity;
    const stateMatches =
      !normalizedState || normalizeState(listing.state) === normalizedState;
    const bedsMatch = Number(listing.beds || 0) >= Number(minBeds || 0);
    const priceMatch = Number(listing.price || 0) <= Number(maxPrice || DEFAULT_PRICE_LIMIT);

    return cityMatches && stateMatches && bedsMatch && priceMatch;
  })
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);
}

function buildMarketStats(localListings, externalListings) {
  const merged = [...localListings, ...externalListings].filter(
    (listing) => typeof listing.price === "number" && listing.price > 0,
  );

  const prices = merged.map((listing) => listing.price).sort((a, b) => a - b);
  const midpoint = Math.floor(prices.length / 2);
  const medianPrice =
    prices.length === 0
      ? null
      : prices.length % 2 === 0
        ? Math.round((prices[midpoint - 1] + prices[midpoint]) / 2)
        : prices[midpoint];

  return {
    localCount: localListings.length,
    externalCount: externalListings.length,
    totalConsidered: merged.length,
    medianPrice,
    minPrice: prices[0] || null,
    maxPrice: prices[prices.length - 1] || null,
  };
}

module.exports = {
  fetchLocalListings,
  buildMarketStats,
};
