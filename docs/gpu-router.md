# GPU router v1 (Modal short, Nebius long later)

First shippable slice toward a Modal-vs-Nebius GPU job router for Jelly Studio `/generate`. **No Nebius client.** **Never Spark** — Spark is ops-only (still store, chat vLLM, local debug), not a scalable GPU backend (Jared hard rule).

Code: `lib/gpu-router.ts` (pure rules, no LLM). Tests: `lib/gpu-router.test.ts`.

## Policy

| Input | Backend |
|---|---|
| `kind` still or short-motion, estimated runtime missing or under 20 minutes | `modal` |
| estimated runtime **≥ 20 minutes** | `nebius` (stub) |
| `kind` long-video or batch | `nebius` (stub) |
| Spark | **never** — not a `GpuBackend` |

`queueDepth` is accepted for future tuning and ignored in v1.

Stills on `/generate` always call `routeGpuJob({ kind: "still" })` then `requireWiredGpuBackend`. Today that is Modal. If the stub ever returns Nebius, spawn throws `Nebius GPU backend is not wired yet` and the job is marked failed — callers still only spawn Modal.

## How Nebius plugs in later

1. Keep `routeGpuJob` as the only decision point.
2. Replace `requireWiredGpuBackend` with a real spawn switch: Modal stays `spawnQwenImageEdit`; Nebius gets its own client (VMs / Docker — not this slice).
3. Write `GenerateJob.backend = "nebius"` and the same duration/cost columns.
4. Do **not** add Spark as a backend. Do **not** route growth-shorts / Eclipse through this module until those products are explicitly migrated.

SkyPilot is out of scope.

## Cost / time logs (tuning dataset)

`GenerateJob` already had `startedAt`, `completedAt`, `modalCallId`, `recipe`. This slice adds:

| Field | Meaning |
|---|---|
| `backend` | `modal` (default) or later `nebius` |
| `kind` | `still` / `short-motion` / `long-video` / `batch` |
| `durationMs` | wall clock `completedAt - startedAt` (null if never started) |
| `costUsd` | whatever Modal returns on the function result (`cost_usd` / `usage.cost_usd`), else **null** — never a guess |

Modal stills write these on webhook and poll completion via `applyModalResult` → `generateJobFinishPatch`. Failures on the stills path do the same so a failed A100 call still has duration.

These rows are how we will retune the 20-minute cutover: if Modal stills regularly sit near the threshold, move the number; if long-video estimates are wrong, fix the estimator, not the router with an LLM.

## Vater

Vater Modal spawn (`firered-modal` / Wan on DGX Python) is **not** on this `GenerateJob` path. It was not instrumented here — not adjacent enough. Vater already rolls Modal spend into `YouTubeProject.costJson`.

## Related

- Modal stills spawn / webhook: `docs/generate-modal.md`
- fal T2I / T2V / I2V: `docs/generate-engines.md` (not this router)
