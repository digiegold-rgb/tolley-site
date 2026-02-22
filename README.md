# T-Agent (Next.js App Router)

Single-page liquid-glass search portal with:

- Auth.js (NextAuth v5) email magic-link auth
- Prisma + Postgres persistence
- Stripe subscriptions (checkout + portal + webhook)
- Server-side `/api/ask` protection + paywall + usage limits

## Required Environment Variables

Set these in local `.env.local` and in Vercel project settings:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL` (or `NEXTAUTH_URL`)
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_BASIC`
- `STRIPE_PRICE_PRO`
- `AGENT_URL` (upstream agent endpoint, e.g. `http://localhost:3002`)

Optional:

- `REDIS_URL` (if you later add Redis-backed usage/cache flows)
- `SESSION_IDLE_TIMEOUT_MS` (default 45 minutes)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure `.env.local` with the variables above.

3. Generate Prisma client:

```bash
npx prisma generate
```

4. Run DB migrations against Postgres:

```bash
npx prisma migrate deploy
```

For local development migration creation:

```bash
npx prisma migrate dev
```

5. Run the web app:

```bash
npm run dev
```

## Billing Routes

- `POST /api/billing/checkout`
  - body: `{ "plan": "basic" | "pro" }`
- `POST /api/billing/portal`
- `POST /api/stripe/webhook`

## Auth + Ask Flow

`POST /api/ask` behavior:

- `401 { error: "LOGIN_REQUIRED" }` when unauthenticated
- `401 { error: "SESSION_EXPIRED" }` after idle timeout
- `402 { error: "SUBSCRIPTION_REQUIRED" }` when no active subscription
- `429 { error: "USAGE_LIMIT_REACHED", resetAt, usage }` when daily cap is reached
- `200` with `{ answer, requestId, cached, latency, usage }` on success

Usage is enforced server-side and persisted using:

- `UsageEvent` (per ask)
- `UsageBucket` (daily counters, `lastSeenAt`)

## Stripe Webhook Notes

Use Stripe CLI locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Set `STRIPE_WEBHOOK_SECRET` from the CLI output.

## Deploy Notes

- Do **not** use localhost URLs in production env vars.
- Ensure `AUTH_URL` (or `NEXTAUTH_URL`) points to your deployed origin.
- Ensure `AGENT_URL` is publicly reachable from Vercel.
