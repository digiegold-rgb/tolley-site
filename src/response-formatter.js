function formatCurrency(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "n/a";
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatListingLine(listing, index) {
  return [
    `${index + 1}. ${listing.address}`,
    `   - Price: ${formatCurrency(listing.price)} | Beds/Baths: ${listing.beds || "?"}/${listing.baths || "?"} | Sqft: ${listing.sqft || "?"}`,
    `   - Source: ${listing.source || "Unknown"}${listing.link ? ` | Link: ${listing.link}` : ""}`,
  ].join("\n");
}

function formatStats(stats) {
  return [
    `- Local matches: ${stats.localCount ?? 0}`,
    `- External matches: ${stats.externalCount ?? 0}`,
    `- Combined considered: ${stats.totalConsidered ?? 0}`,
    `- Median price: ${formatCurrency(stats.medianPrice)}`,
    `- Price range: ${formatCurrency(stats.minPrice)} to ${formatCurrency(stats.maxPrice)}`,
  ].join("\n");
}

function formatListSection(title, listings) {
  if (!Array.isArray(listings) || listings.length === 0) {
    return `${title}\n- None found for current criteria.`;
  }

  const lines = listings.map((listing, index) => formatListingLine(listing, index));
  return `${title}\n${lines.join("\n\n")}`;
}

function formatResponse(payload) {
  const responseLines = [];

  responseLines.push(payload.title || "Available Homes");
  responseLines.push("=".repeat(Math.max(20, (payload.title || "Available Homes").length)));
  responseLines.push("");
  responseLines.push("Search Criteria");
  responseLines.push(`- Original request: ${payload.criteria || "n/a"}`);
  responseLines.push("");
  responseLines.push("Market Snapshot");
  responseLines.push(formatStats(payload.stats || {}));
  responseLines.push("");
  responseLines.push(formatListSection("Local Listings", payload.listings || []));
  responseLines.push("");

  if (payload.externalStatus?.unavailable) {
    responseLines.push("External Listings");
    responseLines.push(
      `- External listings unavailable (${payload.externalStatus.reason || "service unavailable"}).`,
    );
  } else {
    responseLines.push(formatListSection("External Listings", payload.webResults || []));
  }

  responseLines.push("");
  responseLines.push("Analysis");
  responseLines.push(payload.analysis || "No analysis returned.");

  return responseLines.join("\n");
}

module.exports = {
  formatResponse,
};
