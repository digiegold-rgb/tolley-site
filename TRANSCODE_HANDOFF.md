# Tolley-Public Agent Upgrade Handoff

This workspace now contains a modular Node agent implementation that satisfies Milestones 1-4 from the "Tolley-Public Agent Upgrade Pack".

## New backend files

- `src/server.js`
- `src/response-formatter.js`
- `src/external-listings.js`
- `src/cache-store.js`
- `src/analysis-engine.js`
- `src/preferences-store.js`
- `src/local-listings.js`

## What each module does

- `server.js`
  - Exposes `GET /health` and `POST /ask`
  - Adds requestId-based logs
  - Builds `formattedData` and calls deterministic formatter
  - Handles graceful fallback when external listings are unavailable

- `response-formatter.js`
  - Deterministic layout/formatting (headings, bullets, spacing)
  - Keeps analysis separated from listings and stats

- `external-listings.js`
  - Pluggable external provider fetch
  - Compliant mode: no scraping logic
  - Returns normalized listing objects:
    - `address, price, beds, baths, sqft, photo, link, source`
  - Hard caps results to 5
  - Includes timeout + graceful failure behavior

- `cache-store.js`
  - Hourly TTL cache (in-memory)
  - Optional Redis support when `REDIS_URL` + redis client are available
  - Hour bucket support for keys

- `analysis-engine.js`
  - Uses cached analysis where possible
  - Optional LLM analysis when `OPENAI_API_KEY` is configured
  - Deterministic fallback summary when LLM is unavailable

- `preferences-store.js`
  - Preference memory by:
    - `x-user-id` when present
    - else hash(IP + rotating salt) for privacy-safe anon identity
  - Tracks budget range, beds/baths, preferred areas
  - Applies defaults when query omits those fields

## Scripts added

- `npm run agent:start` -> starts agent on port 3002
- `npm run agent:dev` -> watch mode for agent server

## Env vars (optional)

- `AGENT_HOST` (default `0.0.0.0`)
- `AGENT_PORT` (default `3002`)
- `EXTERNAL_LISTINGS_PROVIDER_URL` (if absent, provider is "not configured")
- `EXTERNAL_LISTINGS_PROVIDER_TOKEN` (optional bearer token)
- `EXTERNAL_LISTINGS_TIMEOUT_MS` (default `7000`)
- `REDIS_URL` (optional; falls back to memory cache)
- `OPENAI_API_KEY` (optional LLM analysis)
- `OPENAI_MODEL` (default `gpt-4.1-mini`)
- `PREFERENCE_SALT_ROTATION_MS` (default 24h)

## Verification used

1. Start agent:
   - `npm run agent:start`
2. Health:
   - `curl http://localhost:3002/health`
3. Ask:
   - `curl -X POST http://localhost:3002/ask -H "Content-Type: application/json" -d '{"question":"Find homes in Leawood under 500k"}'`
4. Cache check:
   - Repeat the same `/ask` call within 1 hour and confirm logs show `cached=true`.

## Policy note

- This implementation intentionally avoids Zillow/Redfin scraping and anti-bot bypass logic.
- External listings are provider-based and pluggable for compliant integration.
