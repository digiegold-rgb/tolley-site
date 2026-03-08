/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("node:crypto");
const http = require("node:http");

const { runAnalysis } = require("./analysis-engine");
const { fetchExternalListings, isExternalProviderConfigured } = require("./external-listings");
const { fetchLocalListings, buildMarketStats } = require("./local-listings");
const {
  applyPreferenceDefaults,
  getStoredPreferences,
  resolveIdentityKey,
  savePreferences,
} = require("./preferences-store");
const { formatResponse } = require("./response-formatter");

const HOST = process.env.AGENT_HOST || "0.0.0.0";
const PORT = Number(process.env.AGENT_PORT || 3002);
const DEFAULT_MAX_PRICE = 500000;

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function parseNumberFromToken(token) {
  if (!token) {
    return null;
  }

  const trimmed = token.toLowerCase().replace(/[$,\s]/g, "");
  const multiplier = trimmed.endsWith("m") ? 1_000_000 : trimmed.endsWith("k") ? 1_000 : 1;
  const numeric = Number(trimmed.replace(/[km]/g, ""));
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.round(numeric * multiplier);
}

function parseCriteria(question) {
  const normalized = String(question || "").trim();

  const cityStateMatch = normalized.match(
    /\bin\s+([a-zA-Z\s.'-]+?)(?:,\s*([A-Za-z]{2}))?(?=\s+(under|below|with|near|around|for)\b|$)/i,
  );
  const city = cityStateMatch?.[1]?.trim() || "Leawood";
  const state = cityStateMatch?.[2]?.trim()?.toUpperCase() || "KS";

  const priceMatch = normalized.match(
    /\b(?:under|below|max(?:imum)?|up to|underneath)\s+\$?\s*([\d.,]+(?:[km])?)/i,
  );
  const maxPrice = parseNumberFromToken(priceMatch?.[1]) || null;

  const bedsMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:bed|beds|bd|br)\b/i);
  const bathsMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:\+?\s*)?(?:bath|baths|ba)\b/i);

  const preferredAreas = city
    ? [
        {
          city,
          state,
        },
      ]
    : [];

  return {
    question: normalized,
    city,
    state,
    minBeds: bedsMatch ? Number(bedsMatch[1]) : null,
    minBaths: bathsMatch ? Number(bathsMatch[1]) : null,
    maxPrice,
    budgetRange: maxPrice
      ? {
          min: null,
          max: maxPrice,
        }
      : null,
    preferredAreas,
  };
}

function buildCriteriaForSearch(parsed, stored) {
  const merged = applyPreferenceDefaults(parsed, stored);

  return {
    ...merged,
    maxPrice: merged.maxPrice || DEFAULT_MAX_PRICE,
    minBeds: merged.minBeds || 0,
    minBaths: merged.minBaths || 0,
  };
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("payload too large"));
      }
    });

    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

async function spawnResearchAgents({ location, maxPrice, minBeds, requestId }) {
  const providerConfigured = isExternalProviderConfigured();
  const researchPromises = [];

  researchPromises.push(
    Promise.resolve(
      fetchLocalListings({
        city: location.city,
        state: location.state,
        minBeds,
        maxPrice,
      }),
    )
      .then((listings) => ({ type: "local_listings", data: listings }))
      .catch((error) => ({ type: "local_listings", error: error.message })),
  );

  researchPromises.push(
    fetchExternalListings(
      {
        city: location.city,
        state: location.state,
        minBeds,
        maxPrice,
      },
      { requestId },
    )
      .then((listings) => ({ type: "external_listings", data: listings }))
      .catch((error) => ({ type: "external_listings", error: error.message })),
  );

  const settledResearch = await Promise.all(researchPromises);
  const research = {
    local_listings: [],
    external_listings: [],
    external_status: {
      unavailable: false,
      reason: "",
    },
  };

  for (const item of settledResearch) {
    if (item.type === "local_listings" && Array.isArray(item.data)) {
      research.local_listings = item.data;
    }

    if (item.type === "external_listings") {
      if (Array.isArray(item.data)) {
        research.external_listings = item.data.slice(0, 5);
      } else {
        research.external_status = {
          unavailable: true,
          reason: item.error || "provider error",
        };
      }
    }
  }

  if (!providerConfigured && research.external_listings.length === 0) {
    research.external_status = {
      unavailable: true,
      reason: "provider not configured",
    };
  }

  return research;
}

async function handleAsk(request, response) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const body = await parseBody(request);
    const question = body?.question;

    if (!question || typeof question !== "string") {
      sendJson(response, 400, { error: "Question is required", requestId });
      return;
    }

    console.log(`[${requestId}] /ask received question="${question}"`);

    const parsed = parseCriteria(question);
    const identity = resolveIdentityKey(request);
    const storedPreferences = getStoredPreferences(identity.key);
    const criteria = buildCriteriaForSearch(parsed, storedPreferences);

    const research = await spawnResearchAgents({
      location: { city: criteria.city, state: criteria.state },
      maxPrice: criteria.maxPrice,
      minBeds: criteria.minBeds,
      requestId,
    });

    const stats = buildMarketStats(research.local_listings, research.external_listings);
    const analysis = await runAnalysis(
      {
        question,
        criteria,
        stats,
        localListings: research.local_listings,
        externalListings: research.external_listings,
      },
      { requestId },
    );

    savePreferences(identity.key, criteria, parsed);

    const formattedData = {
      title: `Available Homes in ${criteria.city}`,
      criteria: question,
      stats,
      listings: research.local_listings,
      webResults: research.external_listings,
      analysis: analysis.answer,
      externalStatus: research.external_status,
    };

    const answer = formatResponse(formattedData);
    const latency = Date.now() - startedAt;
    const cached = Boolean(analysis.cached);

    console.log(
      `[${requestId}] /ask completed latency=${latency}ms cached=${cached} local=${research.local_listings.length} external=${research.external_listings.length}`,
    );

    sendJson(response, 200, {
      answer,
      requestId,
      cached,
      latency,
    });
  } catch (error) {
    const latency = Date.now() - startedAt;
    console.error(`[${requestId}] /ask failed latency=${latency}ms`, error.message);
    sendJson(response, 503, {
      error: "Service temporarily unavailable",
      requestId,
      cached: false,
      latency,
    });
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "tolley-public-agent",
      time: new Date().toISOString(),
    });
    return;
  }

  if (request.method === "POST" && request.url === "/ask") {
    await handleAsk(request, response);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Tolley-Public agent listening on http://${HOST}:${PORT}`);
});
