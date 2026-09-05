# fal engine tabs on `/generate`

The **Text → Image**, **Text → Video**, and **Image → Video** tabs on https://tolley.io/generate run on **Vercel + fal.ai** (`FAL_KEY`). They do **not** go through Spark `/api/admin/quickgen`, Gemini `scene_frames.gen_image`, or Modal `lady-wan22`.

**Modal stills** (Qwen-Image-Edit) and **Motion** (Wan I2V / FLF2V) are unchanged. See `docs/generate-modal.md` and `docs/generate-motion.md`.

## What each tab does

| Tab | Recipe | Provider | Happy path |
|---|---|---|---|
| Text → Image | `fal-flux-t2i` | `fal-ai/flux/dev` | Prompt → still. `enable_safety_checker: false`. Default 9:16 (`portrait_16_9`). |
| Text → Video | `fal-wan-t2v` | `fal-ai/wan-t2v` | True T2V. No Gemini keyframe. ≤5s (81 frames @ 16fps). 9:16 default. |
| Image → Video | `fal-wan-i2v` | `fal-ai/wan-i2v` | Same stack as Motion. Upload or **Use as source** from a Modal still. |
| Video → Video | — | **not wired** | Tab stays visible; Generate is disabled with a message. No fal / Animate V2V in this repo. |

Adult Lady2 / fashion / lace content is allowed in-product. CSAM / anyone 17 or under is refused (`isBlockedStudioRequest`). Stills persist Spark-first / private Blob fallback — **not** the public Vercel Blob store.

## Auth + env

Same Jared/admin gate as Modal stills and Motion:

1. HQ PIN (`wd_admin`)
2. Shop admin PIN
3. `ADMIN_ALLOWLIST_EMAILS`

| Variable | Required | Notes |
|---|---|---|
| `FAL_KEY` | **yes** (to spawn) | Same key as Motion / `/api/video/generate`. Never send to the browser. |
| `GENERATE_SPARK_STORE_URL` + `GENERATE_SPARK_STORE_KEY` | T2I persist | Same private still store as Modal. If Spark is down, the gated job route can proxy the temporary fal HTTPS URL. |
| `GENERATE_BLOB_FALLBACK=1` + private token | optional | Private Blob fallback for T2I (never public Blob). |
| `BLOB_READ_WRITE_TOKEN` | I2V upload | `POST /api/generate/upload` for the first-frame still. |
| `DATABASE_URL` | yes | `GenerateJob` rows; fal request id in `modalCallId`. |

Chat on these tabs still uses Spark Qwen (`QWEN_VLLM_*`) to fill Inference / Description. Generate itself does not need Spark.

## UI

1. Log in at `/hq`.
2. Open https://tolley.io/generate
3. Pick **Text → Image**, **Text → Video**, or **Image → Video**.
4. Chat or type Inference + Description.
5. Optional **Dry run**, then **Generate**.
6. Status polls `GET /api/generate/jobs/:id` until `done`. Failures show the fal HTTP / finish / log detail — not a bare "image generation failed".
7. Results land in **Generate gallery** (`/api/generate/jobs/:id/image?i=0`). T2V / I2V play **in-page** with `<video controls>` — the gated route serves `video/mp4` (Range) while HQ-logged-in. Optional **0.5× slow-mo** remuxes after fal (same as Motion). Multi-beat stitch lives on the Motion tab — see `docs/generate-motion.md`.

## Curl

```bash
# T2I dry run
curl -sS -X POST https://tolley.io/api/generate/jobs \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"kind":"t2i","dryRun":true,"prompt":"photoreal adult woman, lace, 85mm","aspect":"9:16"}'

# T2V confirm/go (true Wan T2V)
curl -sS -X POST https://tolley.io/api/generate/jobs \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"kind":"t2v","start":true,"prompt":"she turns toward camera, hair in the wind","aspect":"9:16","seconds":5}'

# I2V (same as Motion)
curl -sS -X POST https://tolley.io/api/generate/jobs \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"kind":"i2v","start":true,"card":{"prompt":"soft smile, hair moves","source_image_url":"https://…/keep.png","aspect":"9:16","seconds":5}}'
```

Poll: `GET /api/generate/jobs/JOB_ID` with the same cookie.

## Errors

fal submit / status / result failures are formatted with HTTP status, body `detail` / `message`, queue `FAILED` status, and trailing logs. The studio shows `job.error` as-is.

## What we did not change

- Modal stills job card, NSFW chips, Location / Hair / Camera chips, Spark-private persist
- Motion Wan I2V / FLF2V helpers
- `/animate`, billing, NextAuth
- Public Blob for private stills (still forbidden)
