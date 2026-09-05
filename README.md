# T-Agent (Next.js App Router)

Single-page liquid-glass search portal with:

- Auth.js (NextAuth v5) credentials auth (+ optional email provider)
- Prisma + Postgres persistence
- Stripe subscriptions (checkout + portal + webhook)
- Server-side `/api/ask` protection + paywall + usage limits
- Auth-gated Agent Setup dashboard (`/agents`) with user-scoped CRUD

## Required Environment Variables

Set these in local `.env.local` and in Vercel project settings:

- `DATABASE_URL`
- `AUTH_SECRET` (required in production)
- `AUTH_URL` (or `NEXTAUTH_URL`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_BASIC_MONTHLY` (Basic $500/mo recurring price id)
- `STRIPE_PRICE_PREMIUM_MONTHLY` (Premium $800/mo recurring price id)
- `APP_URL` (e.g. `https://www.tolley.io`)
- `AGENT_URL` (upstream agent endpoint, e.g. `http://localhost:3002`)
- `ADMIN_ALLOWLIST_EMAILS` (comma-separated, e.g. `owner@tolley.io,ops@tolley.io`)
- `OPENCLAW_CONNECTOR_URL` (connector URL reachable by website backend)
- `OPENCLAW_CONNECTOR_SHARED_SECRET` (website -> connector HMAC secret)

Optional:

- `QWEN_VLLM_BASE_URL` (Spark vLLM base for `/generate` chat, e.g. `http://<spark>:8357/v1` — see `docs/generate-qwen-vllm.md`)
- `QWEN_VLLM_MODEL` (served id, default `KarlKinda/Qwen3.8-27B-Uncensored-FP8`)
- `QWEN_VLLM_API_KEY` (optional Bearer; omit or `none` for open LAN vLLM)
- `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` (spawn `/generate` Modal stills — never commit; see `docs/generate-modal.md`)
- `MODAL_APP_NAME` (default `tolley-qwen-image-edit`)
- `MODAL_FUNCTION_NAME` (default `qwen_image_edit`)
- `GENERATE_WEBHOOK_SECRET` (Modal → `/api/generate/webhook`)
- `GENERATE_IDENTITY_REF_FRONT_URL` / `_LEFT_URL` / `_RIGHT_URL` (HTTPS grey-shirt identity refs)
- `LITELLM_API_URL` / `LITELLM_API_KEY` / `LITELLM_MODEL` (chat→job-card JSON)
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`
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

6. Create your first user:

- Open `/signup`
- Create an account with email + password
- Sign in and you will land on `/agents`

## Login Gate + Protected Routes

- `/` shows login when logged out.
- `/` redirects to `/agents` when logged in.
- `/agents` requires authentication and active subscription tier.
- `/settings` requires authentication.
- `/api/agents/*` requires authentication + active subscription and is user-scoped.
- `/pricing` is public (logged-out users can view plans).

## Billing Routes

- `POST /api/billing/checkout`
  - body: `{ "priceId": "<stripe_price_id>" }`
  - supports `plan` fallback (`basic`/`premium`) for compatibility
- `POST /api/billing/portal`
- `GET /api/billing/status`
- `POST /api/stripe/webhook`

Billing pages:

- `/pricing` (Basic vs Premium plans)
- `/billing/success` (post-checkout confirmation)

Saved results:

- `POST /api/results` (create)
- `GET /api/results/:id` (owner-scoped read)
- `PATCH /api/results/:id` (owner-scoped update)
- `/results/:id` (authenticated result view)

## Admin OpenClaw Proxy

- Admin page: `/admin` (allowlist-restricted)
- Server-side proxy: `/api/admin/openclaw/*`
- Browser never calls bridge directly.

Request flow:

- Browser -> Next.js API route
- Next.js signs request with `OPENCLAW_CONNECTOR_SHARED_SECRET`
- Connector verifies signature and forwards to bridge over tailnet

See connector runtime docs:

- `connector/README.md`

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

Required webhook events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## Deploy Notes

- Do **not** use localhost URLs in production env vars.
- Ensure `AUTH_URL` (or `NEXTAUTH_URL`) points to your deployed origin.
- Ensure `AGENT_URL` is publicly reachable from Vercel.
