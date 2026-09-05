# Identity-locked motion (image→video) on `/generate`

Jared takes a **keep still** (Modal Qwen-Image-Edit output, pasted Blob URL, or upload) into a **5s clip** with the first frame holding identity. Longer “estate lady” pieces are a **beat queue**: one Wan clip per beat, review, then an explicit ffmpeg stitch.

This is **not** ByteDance Seedance. This is **not** LatentSync face-lock.

## What works

| Piece | Status |
|---|---|
| Source still → 5s clip | **Shipped.** fal.ai `fal-ai/wan-i2v` (Wan 2.1, 720p, 81 frames @ 16fps). Safety checker off (same as existing property I2V). |
| Identity | First-frame lock. The still **is** frame 1. |
| Optional last-frame / pose **still** | **Shipped.** If `end_image_url` is an HTTPS image, we switch to `fal-ai/wan-flf2v` (first + last frame). Same 5s / 720p family. |
| Inline player | **Shipped.** Result well + Motion / engine galleries use `<video controls>` against the HQ-gated job route (`video/mp4` + Range). Not download-only. |
| 0.5× slow-mo | **Shipped.** Chip on Motion (and I2V / T2V). After fal returns, Vercel remuxes with ffmpeg `setpts=2*PTS` when `ffmpeg` is on the runtime. Same frames, ~10s wall clock — **not** a longer Wan call. If remux fails, the in-page player uses `playbackRate=0.5` and is labeled. |
| Beat queue | **Shipped.** Ordered scenes on the Motion tab. Generate **one beat at a time**. Review / reject / regenerate independently. **Stitch approved beats** only when every beat is `approved`. No auto-stitch on Go. |
| Stitch | **Vercel Node + ffmpeg concat** (optional 0.25s xfade when two clips + `crossfade: true`). Not Spark. Parent job recipe `fal-wan-beats`; stitch job `fal-wan-stitch`. |
| HQ / admin gate | Same as Modal stills: HQ PIN, shop admin PIN, or `ADMIN_ALLOWLIST_EMAILS`. |
| Dry run | Persists a queued `GenerateJob`, returns fal kwargs, spends nothing. |
| Upload | `POST /api/generate/upload` → Vercel Blob HTTPS URL (`BLOB_READ_WRITE_TOKEN`). |

## What’s optional (and what it actually is)

**Last-frame / pose still** = a second **image** (another keep, a pose photo, a drawn end frame). Wan FLF2V interpolates from source → that still.

**0.5× slow-mo** = remux (or labeled playback). It does **not** ask Wan for more frames.

**Beat queue** = N independent ~5s clips. Longer runtime = stitch, not one Wan call.

It is **not**:

- A skeleton / OpenPose / DWPose video
- A drive / puppet clip
- Animate-Anyone / MimicMotion

Those inputs are not accepted. The form says so.

## What’s not yet

| Piece | Honest status |
|---|---|
| LatentSync / extra face-lock pass | **Not in this repo’s generate/ops path.** Keyframe I2V is the lock. Follow-up: optional LatentSync (or equivalent) from the same identity still after the clip lands. |
| Last-frame extract from a clip | Beat “use previous still” copies the previous **end pose still or source still**. ffmpeg last-frame grab from the MP4 is not wired. |
| N-clip crossfade | Simple concat is the default. Two-clip 0.25s xfade only when requested. |
| Skeleton video drive | **Not supported** on Wan I2V / FLF2V. Do not fake it. |
| Seedance | **No access claimed.** |

## Env (Vercel)

| Variable | Required | Notes |
|---|---|---|
| `FAL_KEY` | **yes** (to spawn) | Existing fal.ai key (already used for property Wan I2V). Never commit. Never send to the browser. |
| `FFMPEG_PATH` | no | Override if `ffmpeg` is not on PATH. Stitch + slow-mo remux run **on Vercel Node**, not Spark. |
| `GENERATE_SPARK_STORE_URL` + `GENERATE_SPARK_STORE_KEY` | clips | Same private store as Modal stills. PUT `video/mp4` → `{index}.mp4`. |
| `GENERATE_BLOB_FALLBACK=1` + private token | optional | Private Blob fallback for MP4s (never public Blob). |
| `BLOB_READ_WRITE_TOKEN` | recommended | Upload stills. **Do not** use the public store for private clips. |
| `DATABASE_URL` | yes | `GenerateJob` table; recipes `fal-wan-i2v`, `fal-wan-flf2v`, `fal-wan-beats`, `fal-wan-stitch` |
| HQ / shop / allowlist | yes | Same as Modal stills |

Chat→card uses the same Spark / LiteLLM vars as Modal stills (`QWEN_VLLM_*` preferred).

## UI

1. Log in at `/hq`.
2. Open https://tolley.io/generate
3. Open the **Motion** tab (Modal stills is unchanged).
4. Set a source still: click **Use as source** on a Modal gallery still (HQ-gated path — not a public Blob link), paste an HTTPS URL, or upload.
5. Edit the motion prompt (and optional last-frame still). Optional **0.5× slow-mo** chip.
6. Optional **Dry run**, then **Go** — single-clip path is unchanged. The MP4 plays **in-page with controls**.
7. For a longer piece: **Add current card** into the beat queue. Generate / approve / regenerate each beat. When every beat is approved, **Stitch approved beats**.

## Media route

HQ-gated playback (same cookie as jobs):

```
GET /api/generate/jobs/:id/image?i=0
GET /api/generate/jobs/:id/media?i=0   # alias
```

Sniffs MP4 (`ftyp`) and serves `Content-Type: video/mp4` with `Accept-Ranges: bytes` so `<video controls>` can seek. Stills stay `image/png`.

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
      "seconds": 5,
      "slow_mo": false
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

Beat queue (never stitches on generate):

```bash
curl -sS -X POST https://tolley.io/api/generate/beats \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"add","beat":{"prompt":"she turns","source_image_url":"https://…/keep.png"}}'

curl -sS -X POST https://tolley.io/api/generate/beats \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"generate","queueId":"QUEUE_JOB_ID","beatId":"beat_…"}'

# After the child job is done and you like it:
curl -sS -X POST https://tolley.io/api/generate/beats \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"approve","queueId":"QUEUE_JOB_ID","beatId":"beat_…"}'

# Only when every beat is approved:
curl -sS -X POST https://tolley.io/api/generate/beats \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"stitch","queueId":"QUEUE_JOB_ID"}'
```

## Prisma

No new table. Motion jobs reuse `GenerateJob` with `recipe` `fal-wan-i2v` / `fal-wan-flf2v`. The fal request id is stored in `modalCallId` (provider call id).

The beat queue is a parent row `recipe=fal-wan-beats` whose `cardJson` is `{ title, beats[], stitch_job_id }`. Each beat: `draft | generating | ready | approved | rejected`, plus `job_id` of the child clip. Stitch writes a `fal-wan-stitch` row.

## Persist

Clips are Spark-first (`spark:generate-jobs/{id}/{i}.mp4`) or private Blob (`blob:…`). The public `persistVideoToBlob` path is **not** used for `/generate` Motion. If private persist fails, the gated route proxies the temporary fal HTTPS URL.
