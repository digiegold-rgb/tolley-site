# Transcode Admin Handoff (Auth + Billing Upgrade)

This workspace now includes a full auth/paywall/subscription implementation for the Next.js app.

## Core additions

- Auth.js v5:
  - `auth.ts`
  - `app/api/auth/[...nextauth]/route.ts`
  - `components/providers/auth-session-provider.tsx`
  - `types/next-auth.d.ts`

- Prisma + Postgres:
  - `prisma/schema.prisma`
  - `prisma/migrations/202602202359_init/migration.sql`
  - `prisma/migrations/migration_lock.toml`
  - `lib/prisma.ts`

- Stripe billing:
  - `app/api/billing/checkout/route.ts`
  - `app/api/billing/portal/route.ts`
  - `app/api/stripe/webhook/route.ts`
  - `lib/stripe.ts`
  - `lib/billing.ts`
  - `lib/subscription.ts`

- Ask endpoint protection + usage enforcement:
  - `app/api/ask/route.ts`
  - `proxy.ts` (server-side request middleware for `/api/ask`)

- Frontend modals + subtle account controls:
  - `components/portal/login-modal.tsx`
  - `components/portal/paywall-modal.tsx`
  - `components/portal/usage-limit-modal.tsx`
  - `components/portal/account-popover.tsx`
  - `components/portal/tagent-portal.tsx` (integrated flow)

## Env vars required

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
- `AGENT_URL`

## Local run order

1. `npm install`
2. Configure env vars
3. `npx prisma generate`
4. `npx prisma migrate deploy`
5. `npm run dev`

Stripe local webhooks:

- `stripe listen --forward-to localhost:3000/api/stripe/webhook`

## Current policy behavior in `/api/ask`

- `401 LOGIN_REQUIRED`
- `401 SESSION_EXPIRED` (idle timeout)
- `402 SUBSCRIPTION_REQUIRED`
- `429 USAGE_LIMIT_REACHED` + `resetAt`
- success payload includes usage metadata (`remaining`, `limit`, `resetAt`, `plan`)
