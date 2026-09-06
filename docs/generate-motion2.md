# Motion 2 · Longform (~3 min) on `/generate`

Motion 2 is a **separate tab** next to Motion. It is purpose-built for a continuous ~3-minute identity-locked take. It does **not** reuse or overload the Motion 1 filmstrip.

**Honest limit:** fal Wan 3.0 I2V (`alibaba/wan-3.0/image-to-video`) is still a **segment** (5 / 15 / 30s; Motion 2 default **15s**). A “3 min take” is **N chained beats** + **ffmpeg last-frame extract** + **stitch**. There is no native 3-minute Wan call. 12×15s or 6×30s ≈ 180s.

## Vs Motion 1

| | Motion 1 | Motion 2 · Longform |
|---|---|---|
| UI | Beat filmstrip on the Motion tab | Own tab: `Motion 2 · Longform` (vertical review list) |
| Parent recipe | `fal-wan-beats` | `fal-wan-longform` |
| Continuity | “Use previous still” copies the previous **end pose still or source still** | After each beat, **ffmpeg extracts the last frame of the MP4** and that PNG becomes the next beat’s `source_image_url` |
| Default length | You add beats by hand (5s default) | Target duration (default **180s / 3 min**) → N beats (`12 × 15s` or `6 × 30s`) |
| Engine | Legacy `fal-ai/wan-i2v` / `wan-flf2v` (~5s / 81 frames) | Wan 3.0 I2V (`alibaba/wan-3.0/image-to-video`) |
| Generate | One beat at a time (Go = Beat 1) | Sequential generate remaining (last-frame chain forbids safe parallel) |
| Stitch | Vercel ffmpeg **re-encode** concat (mixed slow-mo) | Vercel ffmpeg **concat demuxer / stream copy** (36 clips would blow 120s if re-encoded) |
| Spark stitch | Not used | Not used — stream-copy concat of already-encoded H.264 finishes in seconds on Node |

Motion 1 is unchanged. Do not generate Motion 2 jobs through the filmstrip.

## Pipeline

1. **Keep still** + **target seconds** (default 180, max 300) + optional **scene plan** (one motion prompt per line).
2. **Plan** creates N draft beats from target seconds ÷ segment length. Empty script duplicates the identity-lock / Beat-1 prompt. Extra lines raise beat count above the duration floor. **Go** plans for you when the queue is empty or a leftover finished take is loaded.
3. **Dry-run estimate** shows beat count and fal call count **before** spend. Dry run on Go dry-runs beat 1 only (kwargs, no GPU).
4. **Go** runs beats **sequentially**: spawn fal Wan 3.0 I2V (or FLF2V if an end still is set) → poll → **extract last frame** → persist PNG at child job index `1` (Spark-first / private Blob) → next beat `source_image_url` = gated `/api/generate/jobs/:id/image?i=1`. Spawn failures surface as an on-page error.
5. **Review** each clip. Regenerate a bad beat. **Ripple continuity** (opt-in) re-chains the new last frame into beat k+1 and resets later beats to draft. Without ripple, later clips stay (expect a cut).
6. **Approve** every beat, then **Stitch approved beats**. Concat is `ffmpeg -f concat -c copy` on **Vercel Node** (`maxDuration` 120). Not Spark. Crossfade is not on this path (Motion 1 still has optional two-clip xfade).

## Cost

Each beat is one fal Wan 3.0 I2V call — same as Motion 1. 180s @ 15s ≈ **12 calls**. Estimate uses ~$0.10/s @720p and ~$0.20/s @1080p (`POST /api/generate/longform` `action: "estimate"`) **before** you spend.

## Env

Same as Motion 1 (`docs/generate-motion.md`):

| Variable | Notes |
|---|---|
| `FAL_KEY` | Required to spawn. Never to the browser. |
| `FFMPEG_PATH` | Last-frame extract + stitch. Same Vercel Node binary as Motion 1 remux/stitch. |
| `GENERATE_SPARK_STORE_URL` + `GENERATE_SPARK_STORE_KEY` | Private MP4 + last-frame PNG. No public Blob. |
| `GENERATE_BLOB_FALLBACK=1` + private token | Optional fallback. |
| HQ / shop / allowlist | Same gate as Modal stills. |

Adult Lady2 is allowed. CSAM / minors are refused (`isBlockedStudioRequest`).

## API

```bash
# Estimate only (no persist required)
curl -sS -X POST https://tolley.io/api/generate/longform \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"estimate","targetSeconds":180}'

# Plan 12 × 15s beats from a keep still (optional multi-line script)
curl -sS -X POST https://tolley.io/api/generate/longform \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{
    "action":"plan",
    "targetSeconds":180,
    "sourceImageUrl":"https://…/keep.png",
    "script":"she turns\nshe walks to the stairs\nshe looks back"
  }'

# Dry-run beat 1
curl -sS -X POST https://tolley.io/api/generate/longform \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"generate-next","dryRun":true,"queueId":"QUEUE_JOB_ID"}'

# Sequential generate (client loops generate-next after each child is done)
curl -sS -X POST https://tolley.io/api/generate/longform \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"generate-next","queueId":"QUEUE_JOB_ID"}'

# Poll child — poll also extracts last frame and wires beat k+1
curl -sS https://tolley.io/api/generate/jobs/CHILD_ID \
  -H "cookie: wd_admin=$WD_ADMIN"

# Approve / regenerate (ripple=true resets later beats)
curl -sS -X POST https://tolley.io/api/generate/longform \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"approve","queueId":"QUEUE_JOB_ID","beatId":"lf_…"}'

curl -sS -X POST https://tolley.io/api/generate/longform \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"generate","queueId":"QUEUE_JOB_ID","beatId":"lf_…","ripple":true}'

# Stitch when every beat is approved
curl -sS -X POST https://tolley.io/api/generate/longform \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"action":"stitch","queueId":"QUEUE_JOB_ID"}'
```

## Prisma

No new table. Parent row `recipe=fal-wan-longform`, `cardJson`:

```json
{
  "recipe": "fal-wan-longform",
  "target_seconds": 180,
  "beat_seconds": 5,
  "continuity": "last_frame",
  "source_image_url": "…",
  "script": "…",
  "beats": [{ "id": "lf_…", "status": "draft", "last_frame_url": "", "from_prev_last": true }]
}
```

Child clips are `fal-wan-i2v` / `fal-wan-flf2v` with `cardJson.longform: true` and `queue_id`. Last-frame PNG is `outputUrls[1]` on the child. Stitch is `fal-wan-stitch` with `stitch_mode: "concat_copy"`.

## Why not Spark stitch?

36 already-encoded 5s H.264 clips concat via demuxer + stream copy on Vercel Node typically finishes in seconds — well under the 120s route cap. Re-encode concat (Motion 1) would not. Spark has no generate-specific concat endpoint wired; we did not invent one.
