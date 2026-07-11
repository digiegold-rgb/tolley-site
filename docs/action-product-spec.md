# Action Reels — Build Spec (sellable highlight-reel SaaS)

_Status: VALIDATED, not built. This is the go/no-go artifact for a future session._

## Verdict

**Yes, it's sellable — but as a NEW, separately-deployed product, never the existing `/action`.**

Today `/action` is a personal, single-tenant home-lab tool: one shared PIN, a global
`ACTION_API_TOKEN`, and hardcoded personal infrastructure baked into the browser bundle
(NAS `192.168.2.196`, share `personal_folder`, user `Jared`, the DGX Tailscale host, a
private Plex library, "the kids" framing, a Private/family disposition). The reel
generation runs on the DGX via ffmpeg. **Exposing this to customers would leak family
video and personal infra.** Keep `/action` exactly as-is behind its PIN.

The sellable product reuses the *patterns* below — not the `/action` backend, PIN, token,
NAS paths, or Plex.

## The pitch

"Drop your GoPro/phone footage in. Get back a beat-synced highlight reel — cinematic,
vertical for social, no editing skills." Target: parents, travelers, event/real-estate
shooters, small creators drowning in raw clips. This is the same AI-scoring + ffmpeg reel
engine that already runs for `/action`, wrapped as multi-tenant self-serve.

## Reusable patterns already in the codebase

| Need | Reuse from | Files |
|---|---|---|
| Auth / accounts | NextAuth sessions | `auth.ts`, `User`/`Account`/`Session` models |
| Per-user credit ledger + metered billing | **Animate/Vater** | `VideoCredit` model, `app/api/vater/billing/*`, `lib/vater-subscription.ts` |
| Per-slug isolated delivery page (`noindex`) | **Animate** `/v/[slug]` | `app/v/[slug]/page.tsx` |
| Multi-tenant workspace + Stripe metadata routing | **Launchpad** | `Operator`/`Storefront`, `lib/launchpad.ts`, `metadata.product` tag → single `lib/stripe-webhook.ts` dispatch |
| Customer file upload | Vercel Blob | `lib/blob.ts`, `@vercel/blob`, existing `*/upload-token` routes (type + size capped) |

**The reusable shape:** session → per-user workspace row → customer uploads own footage to
Blob → render job → Stripe checkout tagged `metadata.product="action"` → webhook branch →
per-user credit/subscription → `noindex` delivery page. This is exactly how Animate already
works, minus the render engine.

## New data model (per-user, isolated)

```prisma
model ActionWorkspace {
  id        String   @id @default(cuid())
  userId    String   @unique          // NextAuth user — hard tenant boundary
  planStatus String  @default("free") // free | active | canceled
  createdAt DateTime @default(now())
  reels     ActionReel[]
}

model ActionReel {
  id           String   @id @default(cuid())
  workspaceId  String
  workspace    ActionWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  title        String?
  sourceBlobs  Json     @default("[]") // customer-uploaded clip URLs (Blob)
  style        String   @default("cinematic") // cinematic | hype | chill | story
  aspect       String   @default("9:16")
  status       String   @default("queued") // queued | rendering | done | failed
  outputBlobUrl String?
  slug         String   @unique          // /r/<slug> noindex delivery
  createdAt    DateTime @default(now())
}
```
No shared state with `/action`'s DGX `jobs.json` / NAS tree.

## The one real engineering problem: rendering

`/action` renders on the DGX with ffmpeg (LUT, reframe, beat-sync, AI moment scoring). That
won't run on Vercel (long-running, GPU/ffmpeg). Two viable options:

1. **Cloud render worker** (recommended for a real product): a container (Fly.io / Modal /
   Runpod) with ffmpeg + the scoring model, pulling jobs from a queue, writing output to
   Blob. Fully decoupled, scales, never touches home infra.
2. **Multi-tenant DGX render queue** (cheapest to MVP): reuse the DGX engine but behind a
   NEW authenticated job API that only ever reads customer Blob URLs and writes to customer
   Blob output — **never** the NAS/Plex/personal libraries. Risk: ties the product's uptime
   to the home box; acceptable for a paid beta, not for scale.

Start with option 2 for the MVP to validate demand, budget option 1 for launch.

## Pricing (suggested)

- **Free:** 1 reel, watermarked, 720p.
- **Creator $12/mo:** 10 reels/mo, 1080p, no watermark, all styles.
- **Pro $29/mo:** unlimited, 4K, priority render, FCPXML export.
- Or credit packs ($5 / 5 reels) mirroring the Animate metered model.

## Phased build

1. **Phase 0 — demand test (cheap):** a marketing landing page + waitlist/email capture on
   tolley.io (reuse `/api/email-capture` or a `lead/action` verb). Gauge interest before
   building the engine. _(User chose to write this spec first; the landing page is Phase 0
   when greenlit.)_
2. **Phase 1 — MVP:** signup → upload clips to Blob → DGX render queue (option 2) → `noindex`
   `/r/<slug>` delivery. Free tier only, manual quality check.
3. **Phase 2 — billing:** `metadata.product="action"` checkout + webhook branch + credit
   ledger (copy Animate). Turn on paid tiers.
4. **Phase 3 — scale:** move rendering to a cloud worker (option 1); add styles, monthly
   recaps, People/per-subject reels (the `/action` v2 features), FCPXML export.

## Estimate

Billing/auth/upload plumbing is ~80% reusable from Launchpad + Animate. The genuine new work
is (a) per-tenant upload/ingest and (b) decoupling the render engine. Phase 1 MVP is roughly
a focused multi-day build; full launch (Phase 3) is multi-week, mostly the render worker.

## Hard rule

The customer product must **never** share the `/action` DGX API, the shared PIN/token, the
NAS paths, or the owner's Plex. New models, new auth, new delivery surface, customer-supplied
footage only. No personal video is ever reachable.
