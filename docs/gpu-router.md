# GPU router v2 (Modal short, Nebius long later)

Modal-vs-Nebius GPU job router for three site surfaces. **No Nebius client.** **Never Spark** — Spark is ops-only (still store, chat vLLM, local debug, DGX Autopilot worker), not a scalable GPU backend (Jared hard rule).

Code: `lib/gpu-router.ts` (pure rules, no LLM). Kind helpers: `lib/gpu-job-kind.ts`. Cost/time helpers: `lib/gpu-job-log.ts`. Tests: `lib/gpu-router.test.ts`, `lib/gpu-job-log.test.ts`, `lib/gpu-job-kind.test.ts`, `lib/gpu-router-surfaces.test.ts`.

## Policy

| Input | Backend |
|---|---|
| `kind` still or short-motion, estimated runtime missing or under 20 minutes | `modal` |
| estimated runtime **≥ 20 minutes** | `nebius` (stub) |
| `kind` long-video or batch | `nebius` (stub) |
| Spark | **never** — not a `GpuBackend` |

`queueDepth` is accepted for future tuning and ignored in v1.

Callers invoke `routeGpuJob` then `requireWiredGpuBackend` **before** spawning Modal, fal, or a DGX Autopilot job that will rent Modal. If the stub returns Nebius, spawn throws `Nebius GPU backend is not wired yet` and the job is marked failed — no invented Nebius client.

## Surfaces

| Surface | Kickoff | Kind | Finish log |
|---|---|---|---|
| `/generate` stills | `POST /api/generate/jobs` → `spawnQwenImageEdit` | always `still` | `GenerateJob` columns via `applyModalResult` |
| Animate / Vater | site kickoff → DGX Autopilot (`animateAllScenes`, `animateScene`, `runCreation`) | film/scenes: `short-motion` or `long-video` from the length/ETA estimate; FireRed-only produce stays `still` | `YouTubeProject.costJson.gpuLog` (+ `gpuRoute`) on finalize / poll / scene complete |
| Realestate generate | `POST /api/video/generate` (fal) and `POST /api/video/studio-generate`; Listing Studio `/stage`, `/approve-still` | listing videos: `short-motion` or `long-video` by output-length estimate; virtual staging stills stay `still`; studio image → `still`, studio video → `short-motion` | `VideoGeneration` columns on generate/status; Listing Studio `VaterListingJob.costJson.gpuLog` on poll |

### Kind mapping

- **Stills** (`/generate` Modal, Listing virtual staging, studio image, produce without an animation window) → `still`.
- **Animate clips** → `gpuKindForMotionEstimate(quality ETA)` (`~5 min` → short-motion). Batch wall-clock uses the per-clip ETA (Modal overlap; a 5-clip run has finished in ~7 minutes in production), not a serial sum.
- **Animate film (produce)** with `animUntilS` → kind from `targetDuration` minutes. ≥ 20 minutes → `long-video` (Nebius stub).
- **Realestate listing / `/api/video/generate`** → kind from output length (`5 seconds`, Beauty Shot 4–30s). GPU ETA (`~45 seconds`, `about 6 minutes`) is the router's `estimatedRuntimeSec`.

Estimates parse existing labels (`parseEtaToSeconds`). Missing labels → `null` runtime → short-motion / still, never a guessed number.

## How Nebius plugs in later

1. Keep `routeGpuJob` as the only decision point.
2. Replace `requireWiredGpuBackend` with a real spawn switch: Modal stays the current client; Nebius gets its own (VMs / Docker — not this slice).
3. Write the same log fields with `backend: "nebius"`.
4. Do **not** add Spark as a backend. Do **not** route growth-shorts / Eclipse through this module until those products are explicitly migrated.

SkyPilot is out of scope.

## Cost / time logs (tuning dataset)

`costUsd` is whatever the provider returns (`cost_usd` / `usage.cost_usd` / DGX `costs.modalUsd`). **Never** list prices, ETAs, or `totalUsd` (that mix includes Gemini / fal / ops).

### GenerateJob (stills)

| Field | Meaning |
|---|---|
| `backend` | `modal` (default) or later `nebius` |
| `kind` | `still` / `short-motion` / `long-video` / `batch` |
| `durationMs` | wall clock `completedAt - startedAt` (null if never started) |
| `costUsd` | Modal function result, else **null** |

### YouTubeProject / VaterListingJob (`costJson`)

Additive keys — billing totals are untouched:

| Field | Meaning |
|---|---|
| `gpuRoute` | `{ backend, kind, reason, startedAt }` stamped at kickoff |
| `gpuLog` | append-only `{ jobId, backend, kind, durationMs, costUsd, completedAt }[]`, idempotent per `jobId` |

`mergeVideoCost` still owns `totalUsd` / `modalUsd` / `byJob`. `mergeGpuJobLog` / `foldGpuJobLog` never rewrite those.

### VideoGeneration (realestate `/api/video/*`)

Same four columns as `GenerateJob` (`backend`, `kind`, `durationMs`, `costUsd`). Written at create (route) and on `/api/video/status` completion/failure. fal results usually have no dollar field → `costUsd` stays null.

`/api/video/studio-generate` only pre-debits credits, then the browser talks to `studio-api.tolley.io`. This repo stamps `backend` + `kind` on the row; duration/cost stay null until that API grows a completion hook.

These rows are how we will retune the 20-minute cutover: if Modal stills regularly sit near the threshold, move the number; if long-video estimates are wrong, fix the estimator, not the router with an LLM.

## Spark-only gap (do not invent a Spark route)

Animate / Listing Modal **spawn** (`modal.Function.spawn`, Wan, FireRed) runs on the DGX Python Autopilot worker (Spark box), not in this repo. The site only POSTs `animateAllScenes` / `animateScene` / `runCreation` / `createListingJob` and then polls.

This slice instruments those site-side kickoff + poll/finalize paths so every finished Modal-backed job that the site sees gets duration + cost logged. It does **not** add Spark to `GPU_BACKENDS`. The inner Modal spawn on the worker is unchanged.

Growth-shorts / Eclipse cron stay off this router.

## Related

- Modal stills spawn / webhook: `docs/generate-modal.md`
- fal T2I / T2V / I2V: `docs/generate-engines.md` (fal is a spawn target after the router says Modal; it is not a `GpuBackend`)
