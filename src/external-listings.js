/* eslint-disable @typescript-eslint/no-require-imports */

const { getCachedValue, getHourBucket, ONE_HOUR_MS, setCachedValue } = require("./cache-store");

const PROVIDER_URL = process.env.EXTERNAL_LISTINGS_PROVIDER_URL || "";
const PROVIDER_TOKEN = process.env.EXTERNAL_LISTINGS_PROVIDER_TOKEN || "";
const PROVIDER_TIMEOUT_MS = Number(process.env.EXTERNAL_LISTINGS_TIMEOUT_MS || 7000);

function isExternalProviderConfigured() {
  return Boolean(PROVIDER_URL.trim());
}

function buildExternalCacheKey({ city, state, minBeds = 0, maxPrice = 500000 }) {
  const hourBucket = getHourBucket();
  return `${String(city || "unknown").trim().toLowerCase()}_${String(state || "na")
    .trim()
    .toLowerCase()}_${Number(minBeds || 0)}_${Number(maxPrice || 500000)}_${hourBucket}`;
}

function withTimeout(promiseFactory, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return promiseFactory(controller.signal).finally(() => {
    clearTimeout(timeoutId);
  });
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeListing(raw, fallbackSource = "Approved Provider") {
  return {
    address:
      raw.address ||
      raw.full_address ||
      raw.streetAddress ||
      raw.title ||
      "Address unavailable",
    price:
      normalizeNumber(raw.price) ||
      normalizeNumber(raw.list_price) ||
      normalizeNumber(raw.amount) ||
      0,
    beds:
      normalizeNumber(raw.beds) ||
      normalizeNumber(raw.bedrooms) ||
      normalizeNumber(raw.bed_count) ||
      0,
    baths:
      normalizeNumber(raw.baths) ||
      normalizeNumber(raw.bathrooms) ||
      normalizeNumber(raw.bath_count) ||
      0,
    sqft:
      normalizeNumber(raw.sqft) ||
      normalizeNumber(raw.square_feet) ||
      normalizeNumber(raw.living_area) ||
      0,
    photo: raw.photo || raw.photo_url || raw.image || "",
    link: raw.link || raw.url || raw.details_url || "",
    source: raw.source || fallbackSource,
  };
}

async function fetchExternalListings(query, options = {}) {
  const { requestId = "unknown" } = options;
  const cacheKey = buildExternalCacheKey(query);

  const cached = await getCachedValue(cacheKey);
  if (cached) {
    console.log(`[${requestId}] external listings cached=true key=${cacheKey}`);
    return cached;
  }

  if (!isExternalProviderConfigured()) {
    console.log(`[${requestId}] external listings provider not configured`);
    return [];
  }

  const searchParams = new URLSearchParams({
    city: String(query.city || ""),
    state: String(query.state || ""),
    minBeds: String(Number(query.minBeds || 0)),
    maxPrice: String(Number(query.maxPrice || 500000)),
    limit: "5",
  });

  const requestUrl = `${PROVIDER_URL.replace(/\/$/, "")}/listings?${searchParams.toString()}`;

  const response = await withTimeout(
    (signal) =>
      fetch(requestUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(PROVIDER_TOKEN ? { Authorization: `Bearer ${PROVIDER_TOKEN}` } : {}),
        },
        signal,
      }),
    PROVIDER_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`external provider unavailable (${response.status})`);
  }

  const payload = await response.json();
  const rawListings = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.listings)
      ? payload.listings
      : Array.isArray(payload?.results)
        ? payload.results
        : [];

  const normalizedListings = rawListings
    .map((listing) => normalizeListing(listing, payload?.source))
    .filter((listing) => listing.address && listing.price)
    .slice(0, 5);

  await setCachedValue(cacheKey, normalizedListings, ONE_HOUR_MS);
  console.log(`[${requestId}] external listings cached=false key=${cacheKey}`);

  return normalizedListings;
}

module.exports = {
  fetchExternalListings,
  isExternalProviderConfigured,
};
