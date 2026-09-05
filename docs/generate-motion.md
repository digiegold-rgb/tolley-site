# Identity-locked motion (image→video) on `/generate`

Jared takes a **keep still** (Modal Qwen-Image-Edit output, pasted Blob URL, or upload) into a **5s clip** with the first frame holding identity.

This is **not** ByteDance Seedance. This is **not** stitch. This is **not** LatentSync face-lock.

## What works

| Piece | Status |
|---|---|
| Source still → 5s clip | **Shipped.** fal.ai `fal-ai/wan-i2v` (Wan 2.1, 720p, 81 frames @ 16fps). Safety checker off (same as existing property I2V). |
| Identity | First-frame lock. The still **is** frame 1. |
| Optional last-frame / pose **still** | **Shipped.** If `end_image_url` is an HTTPS image, we switch to `fal-ai/wan-flf2v` (first + last frame). Same 5s / 720p family. |
| HQ / admin gate | Same as Modal stills: HQ PIN, shop admin PIN, or `ADMIN_ALLOWLIST_EMAILS`. |
| Dry run | Persists a queued `GenerateJob`, returns fal kwargs, spends nothing. |
| Upload | `POST /api/generate/upload` → Vercel Blob HTTPS URL (`BLOB_READ_WRITE_TOKEN`). |

## What’s optional (and what it actually is)

**Last-frame / pose still** = a second **image** (another keep, a pose photo, a drawn end frame). Wan FLF2V interpolates from source → that still.

It is **not**:

- A skeleton / OpenPose / DWPose video
- A drive / puppet clip
- Animate-Anyone / MimicMotion

Those inputs are not accepted. The form says so.

## What’s not yet

| Piece | Honest status |
|---|---|
| LatentSync / extra face-lock pass | **Not in this repo’s generate/ops path.** Keyframe I2V is the lock. Follow-up: optional LatentSync (or equivalent) from the same identity still after the clip lands. |
| Beat stitch | **Not shipped.** Path is still → I2V per beat → (later) stitch. Gallery is per-clip. |
| Skeleton video drive | **Not supported** on Wan I2V / FLF2V. Do not fake it. |
| Seedance | **No access claimed.** |

## Env (Vercel)

| Variable | Required | Notes |
|---|---|---|
| `FAL_KEY` | **yes** (to spawn) | Existing fal.ai key (already used for property Wan I2V). Never commit. Never send to the browser. |
| `BLOB_READ_WRITE_TOKEN` | recommended | Upload stills + persist finished MP4s |
| `DATABASE_URL` | yes | Same `GenerateJob` table; recipe is `fal-wan-i2v` or `fal-wan-flf2v` |
| HQ / shop / allowlist | yes | Same as Modal stills |

Chat→card uses the same Spark / LiteLLM vars as Modal stills (`QWEN_VLLM_*` preferred).

## UI

1. Log in at `/hq`.
2. Open https://tolley.io/generate
3. Open the **Motion** tab (Modal stills is unchanged).
4. Set a source still: click **Use as source** on a Modal gallery still (HQ-gated path — not a public Blob link), paste an HTTPS URL, or upload.
5. Edit the motion prompt (and optional last-frame still).
6. Optional **Dry run**, then **Go**.
7. Status polls `GET /api/generate/jobs/:id` until `done`; the MP4 appears in the result well and **Motion clips** gallery.

## Curl

```bash
# Dry run (no fal spend)
curl -sS -X POST https://tolley.io/api/generate/jobs \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{
    "kind": "motion",
    "dryRun": true,
    "card": {
      "prompt": "The same adult woman as the first-frame still. Soft smile, hair moves.",
      "source_image_url": "https://YOUR.public.blob.vercel-storage.com/generate/keep.png",
      "aspect": "9:16",
      "seconds": 5
    }
  }'
```

Expected: `{ "dryRun": true, "kind": "motion", "fal_input": { "image_url": "https://...", "num_frames": 81, "enable_safety_checker": false, ... } }`

```bash
# Confirm/Go
curl -sS -X POST https://tolley.io/api/generate/jobs \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"kind":"motion","start":true,"card":{ ...same card... }}'

# Poll
curl -sS https://tolley.io/api/generate/jobs/JOB_ID \
  -H "cookie: wd_admin=$WD_ADMIN"
```

With a last-frame still, add `"end_image_url": "https://.../pose.png"` — recipe becomes `fal-wan-flf2v` and fal gets `start_image_url` + `end_image_url`.

## Prisma

No migration. Motion jobs reuse `GenerateJob` with `recipe` `fal-wan-i2v` / `fal-wan-flf2v`. The fal request id is stored in `modalCallId` (provider call id).
