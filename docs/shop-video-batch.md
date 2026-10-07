# Shop Video Batch

Owner-only Growth HQ workflow at `/hq/shop-videos`, linked in HQ's Ideas menu. It creates an eight-second silent product video, records review and TikTok handoff, and tracks documented commissions and generation charges. It never publishes automatically. Public discovery pages and the house stream are unaffected.

## Generation

- **fal.ai**: Wan 2.2 Turbo image-to-video, 480p, $0.05 model estimate. An optional Qwen Image Edit 2511 720×1280 scene adds approximately $0.03. Safety checking stays enabled. The source clip is trimmed to four seconds.
- **Modal**: the dedicated `tolley-shop-videos.motion` cloud L40S function, 64 GiB host RAM, 480×848, 65 frames at 16fps, 20 base-I2V steps, and 20 swapped blocks. It reuses the existing immutable ComfyUI image `im-dVbYMOnzQkyfX4hr67Oedc` and shared `vater-wan22-models` volume, removing anime LoRAs from the product workflow. The $1.50 motion allowance is a conservative estimate, not an invoice or a guaranteed infrastructure spending ceiling. The model process is supervised, terminated after the call, bounded by a 14-minute function timeout, and the GPU container scales down after five seconds. Existing lady/vater deployments are unchanged.
- **Assembly**: the new `tolley-shop-videos` Modal app performs CPU FFmpeg assembly. Exports are 1080×1920, 30fps, 240 frames, H.264, eight seconds, no audio, with escaped overlay text and an AI-assisted mark. Rate-limited encoding keeps verified outputs under 4 MiB for Vercel's response limit. Upscaling does not add native model detail.
- **Hybrid** combines four seconds of confirmed real person-and-product footage with four seconds of AI display. **Display loop** uses four seconds forward and four seconds reversed, and requires a recorded passed TikTok video pre-check before approval.

There is no Spark video inference, local-Wan fallback, or automatic paid retry. Cloud CPU, storage, cold-start and warm-container billing are separate from model estimates. Invalid or short hybrid footage is rejected before paying a model. Inputs must use approved public media hosts and may be uploaded to the existing Vercel Blob store. Outputs and provider receipts remain on a private Modal Volume and are streamed through owner-authenticated byte-range routes.

## Operator workflow

1. Choose an active connected TikTok account from live Zernio records. Check its actual Shop affiliate access and remaining daily/weekly limits in Creator Center. Confirmation expires after seven days. The tool also counts its recorded handoffs against those limits; include posts made elsewhere in your available allowance.
2. Start from an existing numeric TikTok Shop listing in Tolley's catalog, or add a new product link/ID. Verify its seller, variant, price, commission, authorized photo, and real footage if using hybrid. Catalog details are a prefill and do not confirm rights, authenticity, live availability or affiliate eligibility. An Amazon listing cannot silently become a TikTok affiliate product.
3. Select up to 20 products, a provider, scene, format, overlay and generation allowance. One request key identifies one batch. Duplicate concurrent requests return that batch; changed parameters under an existing key are rejected.
4. Refresh for completed results. Visually review the exact product and variant, branding, overlay claims and AI distortions. Approve each acceptable output. A pure loop additionally requires a passed TikTok pre-check; this record does not guarantee platform acceptance.
5. Download the video, upload it to the chosen TikTok account, enable the required disclosure, select permitted audio, attach the exact Shop product, and reserve the posting slot. Finish publishing in TikTok and record the account-bound published video URL.
6. Record commission order-line IDs and evidence. Pending, settled and reversed amounts stay separate; updates do not create duplicate earnings. Record provider costs from actual receipts. Worker estimates are never confirmed expenses. The displayed difference is settled commissions less recorded generation charges, not total business profit.

Product intake, Shop attachment and settlement are manual in this release. Approved TikTok Shop Affiliate APIs and creator OAuth are required for a later direct showcase/commission integration. Existing ordinary TikTok/social posting connectivity does not establish affiliate API permission. The speaker's seven-day results are unverified self-reported results, not expected Tolley earnings.

## Deployment and recovery

Server runtime requires the existing `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `ZERNIO_API_KEY`, `BLOB_READ_WRITE_TOKEN`, database and owner Auth.js/MFA configuration. Modal's scoped `tolley-shop-video-secrets` supplies the verified current `FAL_KEY`. Deploy with `modal deploy modal/shop_videos.py`; functions are `health`, `render`, `render_modal`, GPU `motion`, `read_result`, `read_output` and the CPU-only `assembly_smoke`. fal renders can run three at a time. Modal renders use a serial queue so later clips do not consume their GPU wait window behind earlier clips. Deploying the GPU function requires the existing cached image and shared model volume in the same Modal workspace.

Review the additive migration with `scripts/apply-shop-video-migration.ts`. Apply with `--apply --snapshot /absolute/private/path.json`, then record `20261007000000_shop_video_batch` using `prisma migrate resolve --applied`. It creates five new tables only, in a transaction with short lock/statement timeouts. Never use destructive database push on production.

Database claims and a persistent Modal Dict prevent repeated paid spawns. Submission intent and provider request IDs are committed before each stage proceeds. Ambiguous submissions or interrupted jobs are held. **Recover saved result** reads an existing completed result by job ID and never generates again. If a provider timeout held the worker before assembly, inspect the saved provider IDs/state on the Modal Volume and the provider dashboard before starting a replacement batch. Recovery cannot invent a missing provider receipt or resume an unfinished paid request automatically.

Owner authorization applies to read, spend, uploads, outputs and financial records. Shop PINs, sync secrets and studio-only collaborator access do not bypass it. Origin checks protect browser mutations. No public webhook accepts render results; the owner dashboard polls Modal call IDs.

## Validation

```sh
node --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs --test tests/shop-video-core.test.ts
DATABASE_URL=postgresql://postgres@127.0.0.1:55449/tolley_shop_video_test node --conditions=react-server --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs tests/shop-video-workflow.ts
node --env-file=/absolute/private/cloud.env --conditions=react-server --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs tests/shop-video-cloud.ts
```

The workflow test refuses any database except the isolated test database on localhost port 55449. It exercises concurrent batch requests, dispatch claims, quota locking, publication identity, estimate/receipt separation, commission updates and durable recovery. Cloud acceptance defaults to CPU assembly and byte-range reads; `--generate /absolute/owned-fixture.png` explicitly adds one paid fal scene/motion job and one paid Modal motion job. These fixtures do not publish or create financial records.

Sources: [Wan Turbo](https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video/turbo), [Qwen Image Edit API](https://fal.ai/models/fal-ai/qwen-image-edit-2511/api), [Modal pricing](https://modal.com/pricing), [TikTok content policy](https://seller-us.tiktok.com/university/essay?knowledge_id=4581457528243969), [TikTok AI guidance](https://seller-us.tiktok.com/university/essay?knowledge_id=491489038501663), [Affiliate integration](https://partner.tiktokshop.com/docv2/page/affiliate-integration). Researched October 7, 2026; verify platform requirements for the selected account when posting.
