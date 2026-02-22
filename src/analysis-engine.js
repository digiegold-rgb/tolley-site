/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("node:crypto");

const { getCachedValue, getHourBucket, ONE_HOUR_MS, setCachedValue } = require("./cache-store");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function hashForKey(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 18);
}

function buildAnalysisCacheKey(question, criteria) {
  const hourBucket = getHourBucket();
  const signature = hashForKey(
    JSON.stringify({
      question,
      city: criteria.city,
      state: criteria.state,
      maxPrice: criteria.maxPrice,
      minBeds: criteria.minBeds,
    }),
  );
  return `analysis_${signature}_${hourBucket}`;
}

function deterministicAnalysis({ question, stats, localListings, externalListings }) {
  const signals = [];
  signals.push(
    `Question focus: ${question.trim().replace(/\s+/g, " ") || "Not specified"}.`,
  );
  signals.push(
    `Current match volume: ${stats.localCount} local and ${stats.externalCount} external listings.`,
  );

  if (stats.medianPrice) {
    signals.push(`Observed median list price is $${stats.medianPrice.toLocaleString()}.`);
  }

  if (localListings.length > 0) {
    const strongest = localListings[0];
    signals.push(
      `Most affordable local match starts at $${strongest.price.toLocaleString()} in ${strongest.address}.`,
    );
  }

  if (externalListings.length === 0) {
    signals.push("No external provider matches were returned for this request.");
  }

  return signals.join(" ");
}

async function analyzeWithLLM(payload) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const llmPrompt = [
    "You are a concise real estate analyst for agents.",
    "Return plain text only (no markdown headings, no bullets).",
    "Summarize inventory quality, pricing posture, and recommended next action in 5-7 short sentences.",
    `Question: ${payload.question}`,
    `City/State: ${payload.criteria.city}, ${payload.criteria.state}`,
    `Max price: ${payload.criteria.maxPrice}`,
    `Minimum beds: ${payload.criteria.minBeds}`,
    `Local listing count: ${payload.localListings.length}`,
    `External listing count: ${payload.externalListings.length}`,
    `Stats: ${JSON.stringify(payload.stats)}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are an experienced real estate market strategist.",
        },
        {
          role: "user",
          content: llmPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`llm provider failed (${response.status})`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("llm response missing content");
  }

  return text.trim();
}

async function runAnalysis(payload, { requestId = "unknown" } = {}) {
  const cacheKey = buildAnalysisCacheKey(payload.question, payload.criteria);
  const cachedAnalysis = await getCachedValue(cacheKey);
  if (cachedAnalysis) {
    console.log(`[${requestId}] analysis cached=true key=${cacheKey}`);
    return {
      answer: cachedAnalysis,
      cached: true,
      source: "cache",
    };
  }

  let answer = "";
  let source = "deterministic";

  try {
    const llmAnswer = await analyzeWithLLM(payload);
    if (llmAnswer) {
      answer = llmAnswer;
      source = "llm";
    } else {
      answer = deterministicAnalysis(payload);
    }
  } catch (error) {
    console.warn(`[${requestId}] analysis fallback:`, error.message);
    answer = deterministicAnalysis(payload);
  }

  await setCachedValue(cacheKey, answer, ONE_HOUR_MS);
  console.log(`[${requestId}] analysis cached=false key=${cacheKey} source=${source}`);

  return {
    answer,
    cached: false,
    source,
  };
}

module.exports = {
  runAnalysis,
};
