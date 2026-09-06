# Cinema on `/generate` (estate-lady path)

Cinema is a **third motion mode** next to Motion and Motion 2. It is the lane that can recreate Spark’s **proof-estate-01** short.

**Wan ≠ estate lady.** Motion 1 is Wan 2.x I2V (~5s). Motion 2 is Wan 3.0 last-frame chain. Neither has Seedance’s multi-image ref grammar or reliable native dialogue. Cinema is `fal-cinema` / `fal-seedance-ref` (Seedance 2.0) with Kling 3 Pro elements as the face/partner-filter fallback.

## What /generate ships

Render + sequential queue + stitch + review.

| Piece | Status |
|---|---|
| Seedance 2.0 `bytedance/seedance-2.0/reference-to-video` | **Shipped.** Prompt, `image_urls` (≤9), optional `audio_urls` / `video_urls`, `aspect_ratio` 9:16, `resolution` 720p, `duration` 4–15 (default 10), `generate_audio` default true. Per-beat max **15s** (fal hard limit). Longer = stitch beats. |
| Kling 3 Pro `fal-ai/kling-video/v3/pro/image-to-video` + `elements` | **Shipped** as fallback when Seedance returns partner / content-policy / face-filter. Duration **3–15** (default 10). fal requires `frontal_image_url` **and** `reference_image_urls` (we duplicate the frontal/start still when only 1–2 refs are pasted). Same 15s per-beat cap; stitch for longer. |
| Parent + child jobs | Same pattern as Motion 2. Parent `fal-cinema`. Children `fal-seedance-ref` / `fal-kling-elements`. |
| Run remaining | Sequential only. Go = run remaining, not beat 1 only. Optional previous clip as Seedance `@Video`. |
| Stitch | Vercel ffmpeg concat-demuxer / stream copy (same as Motion 2). Music bed is stubbed. |
| Estimate | Seedance ~$0.30/s @720p. Kling ~$0.112–0.168/s (audio on ≈ $0.168/s → 15s ≈ **$2.52**). Confirm when remaining spend &gt; ~$5. |
| ArcFace / Gemini QA | **Not on Vercel.** Full Spark cinema QA loop stays on Spark. |

## Recreate proof-estate-01

Spark project (reference only): `/home/jelly/growth-engine/cinema/projects/proof-estate-01/`  
Principles: Spark `growth-engine/cinema/PRINCIPLES.md` (multi-shot grammar, `@Image1` full body, `@Image2` bust, `@Image3` identity, `She says exactly: "…"` + `@Audio1`).

On tolley.io:

1. Log in at `/hq`. Open https://tolley.io/generate
2. Open the **Cinema** tab (next to Motion / Motion 2).
3. Click **Load estate proof template**. That fills c01–c08 from `docs/fixtures/proof-estate-01-beats.json` (id, seconds, VO line, shortened prompt scaffold — not the full 2k-char Spark prompts).
4. Paste Spark-gated HTTPS URLs for the estate-a pack:
   - `@Image1` `pack/estate-a/front.png` (full body)
   - `@Image2` `pack/estate-a/bust.png`
   - `@Image3` `identity/front.jpg`
   - optional `@Audio1` voice clip
5. Plan (if you edited the script) → dry-run kwargs if you want → **Go** / **Run remaining**.
6. Review each clip. On Seedance partner/face filter, switch the model to **Kling 3 Pro elements** and retry that beat.
7. Approve every beat → **Stitch approved beats**.

Expected spend: **~$25–60** with retakes (8× ~8–10s Seedance @ ~$0.30/s, plus retries). The original Spark proof was ~$57 all-in.

**Per-beat length is 15 seconds max** on both Seedance 2.0 ref-to-video and Kling 3 Pro I2V (`fal-ai/kling-video/v3/pro/image-to-video` duration enum is 3–15 only). We cannot raise Cinema past 15s without a different model. Stitch approved beats for a longer short. Kling with native audio on is ~$0.168/s → a 15s beat is about **$2.52**.

## Queue binding

Parent job id is stored in `localStorage` (`tolley.generate.cinema.queueId`) and the URL (`?cinema=`). GET/POST always send that `id` / `queue_id`. Restoring never silently swaps to another actor’s test queue (`shop-admin` vs HQ PIN). Same rule on Motion 2 (`?queue=`).

## Env

Same `FAL_KEY` as Motion. Never commit keys. Do not burn fal budget in CI — dry-run returns kwargs only.

## Follow-ups (not this PR)

- Host `pack/estate-a` refs on Spark-gated URLs Jared can paste.
- Music bed after concat.
- Port Spark ArcFace / Gemini QA onto Vercel (out of scope).
