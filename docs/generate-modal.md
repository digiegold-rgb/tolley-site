# Chat-driven Modal stills on `/generate`

Identity stills run on Modal (A100 BF16, Diffusers `QwenImageEditPlusPipeline` / `Qwen/Qwen-Image-Edit-2511`). Spark Comfy / InstantID / face_lock / UltraSharp are not used.

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
| `BLOB_READ_WRITE_TOKEN` | recommended | Persist stills if Modal returns PNG bytes |
| `DATABASE_URL` | yes | Prisma `GenerateJob` |
| `WD_ADMIN_PIN_TOLLEY` or `SHOP_ADMIN_PIN` or `ADMIN_ALLOWLIST_EMAILS` | yes | Same Jared/admin gates as HQ / shop / allowlist |

Do **not** set `HF_TOKEN` on Vercel unless you have another reason. The Hugging Face token belongs in the Modal secret.

### Modal secret `tolley-generate`

| Variable | Required | Notes |
|---|---|---|
| `HF_TOKEN` | **yes** | Download `Qwen/Qwen-Image-Edit-2511` |
| `BLOB_READ_WRITE_TOKEN` | recommended | Worker uploads PNGs, webhooks URLs |
| `GENERATE_WEBHOOK_SECRET` | recommended | Must match Vercel |

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

## Deploy the Modal function

```bash
pip install modal
modal setup          # token for digiegold@gmail.com workspace
modal secret create tolley-generate \
  HF_TOKEN=hf_... \
  BLOB_READ_WRITE_TOKEN=vercel_blob_... \
  GENERATE_WEBHOOK_SECRET=long-random
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
5. Edit any recipe field on the card (seed, steps, width, height, true_cfg_scale / CFG, guidance_scale, max_sequence_length, num_images, negative_prompt, identity URLs, extra image URLs, optional sigmas, optional pipe_overrides, prompt) or paste a full card into **Advanced**. **Random seed** sits next to seed. **Allow NSFW** / **Block NSFW** chips next to Negative prompt merge or strip adult NSFW-block terms (identity/quality and child/minor stay).
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

Terminal statuses: `queued` → `running` → `done` (with `output_urls`) or `failed` (with `error`).

Webhook (Modal → Vercel) is optional if poll works:

```bash
curl -sS -X POST https://tolley.io/api/generate/webhook \
  -H 'content-type: application/json' \
  -H "Authorization: Bearer $GENERATE_WEBHOOK_SECRET" \
  -d '{"job_id":"JOB_ID","status":"done","output_urls":["https://...png"]}'
```

## Prisma

```bash
npx prisma migrate deploy
```

Adds `GenerateJob` (`status`, `cardJson`, `modalCallId`, `outputUrls`, `error`, `createdBy`, timestamps).
