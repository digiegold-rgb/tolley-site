# Chat-driven Modal stills on `/generate`

Identity stills run on Modal (A100 BF16, Diffusers `QwenImageEditPlusPipeline` / `Qwen/Qwen-Image-Edit-2511`). Spark Comfy / InstantID / face_lock / UltraSharp are not used.

Identity-locked **motion** (still → 5s fal Wan I2V) is a separate tab on the same page — see `docs/generate-motion.md`. Modal stills job-card / NSFW chips are unchanged.

**Location / Hair / Camera chips** (Stills tab only) rewrite durable prompt sections — `[[location]]` / `[[hair]]` / `[[camera]]` — the same way Allow/Block NSFW writes `[[allow-nsfw-wardrobe]]`. Clear removes that block. Camera Clear keeps the preset `Camera:` line if one exists. Identity-lock sentences stay. Extra #1 is still manual for wardrobe; no Extra-image auto-wiring.

Jared chats on https://tolley.io/generate the same way he talks to an operator bot. An LLM fills an **editable job card** (kwargs, not a frozen GUI). Confirm/Go spawns the named Modal function `qwen_image_edit`. Results land in the gallery.

## Env var checklist

### Vercel (tolley-site)

| Variable | Required | Notes |
|---|---|---|
| `MODAL_TOKEN_ID` | **yes** (to spawn) | Modal API token id. Never commit. Never send to the browser. |
| `MODAL_TOKEN_SECRET` | **yes** (to spawn) | Modal API token secret. |
| `MODAL_APP_NAME` | no | Default `tolley-qwen-image-edit` |
| `MODAL_FUNCTION_NAME` | no | Default `qwen_image_edit` |
| `MODAL_ENVIRONMENT` | no | Modal workspace environment if not default |
| `GENERATE_WEBHOOK_SECRET` | **yes** (for webhook) | Shared HMAC/bearer secret. Same value as Modal secret. |
| `GENERATE_WEBHOOK_URL` | no | Defaults to `{APP_URL}/api/generate/webhook` |
| `APP_URL` | recommended | e.g. `https://tolley.io` |
| `GENERATE_IDENTITY_REF_FRONT_URL` | recommended | HTTPS Blob URL for grey-shirt **front** |
| `GENERATE_IDENTITY_REF_LEFT_URL` | recommended | HTTPS Blob URL for **profile-left** |
| `GENERATE_IDENTITY_REF_RIGHT_URL` | recommended | HTTPS Blob URL for **profile-right** |
| `GENERATE_IDENTITY_REF_URLS` | optional | Comma-separated override of the three URLs |
| `LITELLM_API_URL` / `LITELLM_API_KEY` / `LITELLM_MODEL` | chat→card | Preferred LLM path |
| `LLM_API_URL` / `LLM_API_KEY` / `LLM_MODEL` | fallback | OpenAI-compatible |
| `QWEN_VLLM_BASE_URL` | fallback | Existing Spark director chat |
| `GENERATE_SPARK_STORE_URL` | **yes** (stills) | HTTPS origin of the Spark still store (e.g. `https://quickgen.tolley.io`). Vercel PUTs PNGs here. Must be reachable from Vercel — not a raw Tailscale `100.x` unless a public hostname terminates on Spark. |
| `GENERATE_SPARK_STORE_KEY` | **yes** (stills) | Bearer / `x-api-key` for that store. May reuse `QUICKGEN_API_KEY` if you mount the sidecar on the same host. |
| `GENERATE_BLOB_FALLBACK` | no | Set `1` only if Spark write is blocked. Then stills go to a **private** Blob store. |
| `GENERATE_BLOB_READ_WRITE_TOKEN` | fallback only | Token for a **private** Blob store (`vercel blob create-store … --access private`). Do not point this at the existing public store. |
| `BLOB_READ_WRITE_TOKEN` | fallback / identity | Existing public-store token. **Do not** use it for new job outputs. Needed to purge old `generate/**` objects (`BLOB_READ_WRITE_TOKEN_PUBLIC`). |
| `DATABASE_URL` | yes | Prisma `GenerateJob` |
| `WD_ADMIN_PIN_TOLLEY` or `SHOP_ADMIN_PIN` or `ADMIN_ALLOWLIST_EMAILS` | yes | Same Jared/admin gates as HQ / shop / allowlist |

Do **not** set `HF_TOKEN` on Vercel unless you have another reason. The Hugging Face token belongs in the Modal secret.

### Modal secret `tolley-generate`

| Variable | Required | Notes |
|---|---|---|
| `HF_TOKEN` | **yes** | Download `Qwen/Qwen-Image-Edit-2511` |
| `GENERATE_WEBHOOK_SECRET` | recommended | Must match Vercel |
| `BLOB_READ_WRITE_TOKEN` | optional | Bearer when fetching private identity refs. Not used for public output uploads. |
| `GENERATE_BLOB_FALLBACK` | no | `1` = worker may PUT stills to a **private** Blob store. Default is off — return PNG bytes, Vercel persists to Spark. |

Identity refs historically lived at:

```
/home/jelly/growth-engine/shorts/persona-refs/identity/front.jpg
/home/jelly/growth-engine/shorts/persona-refs/identity/profile-left.jpg
/home/jelly/growth-engine/shorts/persona-refs/identity/profile-right.jpg
```

Those paths do **not** exist on Modal workers. Upload them once:

```bash
npx tsx scripts/upload-generate-identity-refs.ts \
  --front /path/to/front.jpg \
  --left /path/to/profile-left.jpg \
  --right /path/to/profile-right.jpg
```

Then paste the printed HTTPS URLs into the Vercel env vars above.

Those identity refs may still live on the **public** Blob store (residual risk). Job *outputs* must not. Re-upload identity privately later if you want; Modal `_load_refs` sends `Authorization: Bearer` for `*.blob.vercel-storage.com` URLs.

## Private stills (Spark first)

Modal cannot write `/home/jelly/...` and should not publish `*.public.blob.vercel-storage.com/generate/…` URLs.

1. Deploy `spark/generate-store/server.py` on Spark (see that README). Disk default: `/home/jelly/growth-engine/shorts/generate-jobs/{job_id}/{n}.png`.
2. Expose it on an HTTPS origin Vercel can reach (same pattern as `quickgen.tolley.io`).
3. Set `GENERATE_SPARK_STORE_URL` + `GENERATE_SPARK_STORE_KEY` on Vercel.
4. Redeploy Modal (`modal deploy modal/qwen_image_edit.py`). The worker returns PNG bytes on the function result and webhooks `{ job_id, status, outputs_ready: true }` — no public URLs, no multi-MB webhook body.
5. Vercel poll / webhook persists bytes to Spark. `/generate` gallery loads `GET /api/generate/jobs/:id/image?i=0` (same Jared/admin gate as Modal jobs).

### Private Blob fallback (only if Spark write is blocked)

Store access mode cannot be changed after creation. The current store is public.

FortKnox / token swap: create the private store first, put its `BLOB_READ_WRITE_TOKEN` in FortKnox as `GENERATE_BLOB_READ_WRITE_TOKEN`, set `GENERATE_BLOB_FALLBACK=1` on Vercel **and** the Modal secret `tolley-generate`. Keep the old public token as `BLOB_READ_WRITE_TOKEN_PUBLIC` long enough to run the purge script. Do not point `BLOB_READ_WRITE_TOKEN` at the private store if other site features still upload public assets (Vater finals, shop, invoices).

```bash
vercel blob create-store tolley-generate-private --access private
```

Point `GENERATE_BLOB_READ_WRITE_TOKEN` (Vercel + optional Modal secret) at that store. Set `GENERATE_BLOB_FALLBACK=1`. Code uses `access: 'private'` / `x-vercel-blob-access: private`. HQ still loads stills through the gated image route — never paste a raw private Blob URL into chat or `<img src>`.

### Purge existing public job outputs

```bash
BLOB_READ_WRITE_TOKEN_PUBLIC=vercel_blob_rw_… \
  npx tsx scripts/purge-public-generate-outputs.ts          # dry-run
BLOB_READ_WRITE_TOKEN_PUBLIC=vercel_blob_rw_… \
  npx tsx scripts/purge-public-generate-outputs.ts --apply
```

Skips `generate/identity/**`. Run against the **public** store token (before swapping tokens).

### Motion clips on `/generate`

The **Motion** tab (#124) is unchanged in behavior: Wan I2V / FLF2V, HQ gate, dry run, optional last-frame still. Gallery **Use as source** now passes the HQ-gated still route (`/api/generate/jobs/:id/image?i=0`). Vercel resolves that to bytes and uploads to fal storage (1-day) so fal can fetch without a public Blob keep. Finished clips are shown through the same gated job route.

The **Text → Image / Text → Video / Image → Video** tabs no longer use Spark quickgen. They share this job table and the HQ-gated `/api/generate/jobs/:id/image` route — see `docs/generate-engines.md`. **Video → Video** is disabled (no fal V2V path). Motion is unchanged.

## Deploy the Modal function

```bash
pip install modal
modal setup          # token for digiegold@gmail.com workspace
modal secret create tolley-generate \
  HF_TOKEN=hf_... \
  GENERATE_WEBHOOK_SECRET=long-random
# Optional, identity-ref fetch / private Blob fallback only:
#   BLOB_READ_WRITE_TOKEN=vercel_blob_... \
#   GENERATE_BLOB_FALLBACK=1
modal deploy modal/qwen_image_edit.py
```

Named lookup from Vercel:

```ts
modal.functions.fromName("tolley-qwen-image-edit", "qwen_image_edit")
```

Proven kwargs: `width=928`, `height=1664`, `num_inference_steps=40`, `true_cfg_scale=4.0`, `guidance_scale=1.0`, `max_sequence_length=512`, three identity ref URLs, optional `extra_image_urls` (max 3 HTTPS), optional `sigmas`, optional `attention_kwargs`, optional `pipe_overrides` / `modal_kwargs` (sanitized Diffusers pipe() escape hatch), `num_images` (→ `num_images_per_prompt`). This recipe has no denoise/strength.

## Auth

Job APIs accept any of:

1. HQ PIN cookie (`wd_admin` — log in at `/hq`)
2. Shop admin PIN cookie (`shop_admin` — log in at `/shop/dashboard`)
3. NextAuth session whose email is on `ADMIN_ALLOWLIST_EMAILS`

The `/generate` page itself stays public. Chat→card, Confirm/Go, status, and gallery require one of those gates.

## Dry Modal still from the UI

1. Log in at `/hq` (or shop dashboard / admin email).
2. Open https://tolley.io/generate
3. Stay on **Modal stills**.
4. Preset defaults to **Lady2 lacy pink front smile**. Confirm the three identity URLs.
5. Edit any recipe field on the card (seed, steps, width, height, true_cfg_scale / CFG, guidance_scale, max_sequence_length, num_images, negative_prompt, identity URLs, extra image URLs, optional sigmas, optional pipe_overrides, prompt) or paste a full card into **Advanced**. **Random seed** sits next to seed. **Location / Hair / Camera** chips under Prompt rewrite durable `[[location]]` / `[[hair]]` / `[[camera]]` blocks (and the matching labeled line when the preset already has one, e.g. `Camera:`). Clear removes that block; Camera Clear restores the preset camera line. Identity-lock sentences stay put. Extra #1 is still manual for wardrobe. **Allow NSFW** / **Block NSFW** chips next to Negative prompt: Allow strips adult NSFW-block terms and injects a `[[allow-nsfw-wardrobe]]` prompt override (ignore grey-shirt clothing lock; wardrobe follows the prompt). Block re-merges those terms and removes the override. Identity/quality and child/minor stay. Optional first extra image URL can be a lingerie/nude body keep-still — clothed identity refs alone keep covering.
6. Chat may change those same kwargs (JSON job card only — no ComfyUI / nodes / `.safetensors` advice).
7. Optional: tick **Dry run** and hit **Go** — creates a `GenerateJob`, returns the exact kwargs, does **not** spend an A100.
8. Untick Dry run, hit **Go**. Status polls `GET /api/generate/jobs/:id` until `done`; stills appear in the gallery.

## Curl: create → status → done

Log in at `/hq` first (browser), then copy the `wd_admin` cookie.

```bash
# 1) Dry-run create (no GPU)
curl -sS -X POST https://tolley.io/api/generate/jobs \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{
    "dryRun": true,
    "card": {
      "preset": "lady2-lacy-pink-front-smile",
      "prompt": "The same adult woman as the three grey-shirt identity reference photos. Wardrobe: lacy pink front. Soft smile.",
      "negative_prompt": "different person, child, watermark",
      "seed": 0,
      "num_inference_steps": 40,
      "height": 1664,
      "width": 928,
      "true_cfg_scale": 4.0,
      "guidance_scale": 1.0,
      "max_sequence_length": 512,
      "identity_ref_urls": [
        "https://YOUR.public.blob.vercel-storage.com/generate/identity/front.jpg",
        "https://YOUR.public.blob.vercel-storage.com/generate/identity/profile-left.jpg",
        "https://YOUR.public.blob.vercel-storage.com/generate/identity/profile-right.jpg"
      ],
      "extra_image_urls": [],
      "sigmas": null,
      "pipe_overrides": {},
      "num_images": 1
    }
  }'
```

Expected: `{ "dryRun": true, "job": { "status": "queued", ... }, "modal_kwargs": { "width": 928, "height": 1664, ... } }`

```bash
# 2) Chat → card (no GPU)
curl -sS -X POST https://tolley.io/api/generate/jobs \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"message":"Lady2 lacy pink front smile, same face, seed 12"}'
```

Expected: `{ "started": false, "card": { "seed": 12, "preset": "lady2-lacy-pink-front-smile", ... }, "reply": "..." }`

```bash
# 3) Confirm/Go (spawns Modal)
curl -sS -X POST https://tolley.io/api/generate/jobs \
  -H 'content-type: application/json' \
  -H "cookie: wd_admin=$WD_ADMIN" \
  -d '{"start":true,"card":{ ...same card... }}'

# 4) Poll
curl -sS https://tolley.io/api/generate/jobs/JOB_ID \
  -H "cookie: wd_admin=$WD_ADMIN"
```

Terminal statuses: `queued` → `running` → `done` (with `output_urls` rewritten to `/api/generate/jobs/JOB_ID/image?i=0`) or `failed` (with `error`).

Webhook (Modal → Vercel) is a completion ping. Do not put public Blob URLs in the payload:

```bash
curl -sS -X POST https://tolley.io/api/generate/webhook \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer $GENERATE_WEBHOOK_SECRET" \
  -d '{"job_id":"JOB_ID","status":"done","outputs_ready":true}'
```

Then poll the job (or open the gated image URL with the HQ cookie):

```bash
curl -sS -D- https://tolley.io/api/generate/jobs/JOB_ID/image?i=0 \
  -H "cookie: wd_admin=$WD_ADMIN" -o /tmp/still.png
```

## Prisma

```bash
npx prisma migrate deploy
```

Adds `GenerateJob` (`status`, `cardJson`, `modalCallId`, `outputUrls`, `error`, `createdBy`, timestamps).
