# Gen2 generation workspace

`/gen2` starts with a choice of outcome and four steps:

1. **Choose a workflow** — seven workflows with provider-configuration status, described by their inputs and outputs. Video → Video remains unavailable and is explained without presenting a working action.
2. **Describe & add sources** — prompts, references, uploads, and scene scripts. The optional director edits the same underlying cards as the manual controls.
3. **Adjust settings** — format, duration, seeds, negative prompts, content controls, JSON overrides, and queue planning as appropriate to the selected workflow.
4. **Generate & review** — input summary, actionable missing-input messages, generation, clip approval/retry, stitching, and gated downloads.

**All controls** displays every step together. Numbered navigation permits inspection of any step; the forward button explains missing prerequisites. Forms stay mounted across step navigation, preserving file selections and JSON drafts. Server queue persistence remains shared; Gen2 browser bindings use their own storage keys. `?workflow=` preserves a selected workflow when queue bindings also exist; explicit `?queue=` or `?cinema=` links without a workflow open the relevant review step.

| Workflow | Engine / API path | Required input |
| --- | --- | --- |
| Create an image | FLUX, `/api/generate/jobs` | Prompt or scene details |
| Animate an image | Wan I2V, jobs + upload | Image and motion prompt |
| Create a video from text | Wan T2V, jobs | Prompt |
| Create a character still | Modal Qwen / fal Qwen / FLUX.2 Edit, jobs | Prompt and identity references |
| Direct a sequence | Motion, jobs + beats | Starting still and first-clip prompt |
| Build a continuous video | Wan 3.0, longform | Starting still and planned scenes |
| Make a cinematic film | Seedance / Kling, cinema | Reference images and planned shots |

The shared library retains its server-verified passcode gate. Selecting a still sets the current video workflow's source and returns to step 2. Selecting from a still-creation workflow opens Animate an image. Engine video outputs are excluded from the Modal still gallery.

Generation requires an owner account with completed MFA. The dedicated `/api/gen2/access` check distinguishes missing login, pending MFA, insufficient permissions and service failure. Direct sign-in opens on the same origin with a `/gen2` callback; focus/visibility refresh resumes the original draft. Legacy HQ PIN cookies do not grant access. The login inputs and submit button wait for client initialization to prevent native form reloads before hydration. Test-run success and provider errors are visible in the workspace even with the director closed.

## Verification

- `node --import <tsx-loader> --test lib/generate-*.test.ts`: existing engine, card, queue, and persistence regression tests.
- `GENERATE_TEST_URL=http://127.0.0.1:3034 node --import <tsx-loader> tests/generate-guided.ts`: browser regression against a local app. Every API request is fulfilled locally; this test never creates paid generation jobs. Covers seven workflows, back/forward state, file selection, dry-run payloads, error recovery, library unlock and source selection, longform/Cinema planning, all-controls view, mobile overflow, and sign-in recovery. Screenshots are written to `/tmp/tolley-generate-guided-review`.
- `npm run build`: changelog, links, Prisma generation, production type check and Next build.

Existing source/queue state remains owned by GenerateStudio; WorkflowSection controls presentation. Stitching retains its existing API. Owner identity is checked separately from library/database loading.

## Models and internal costs

A model selector and USD quote stay available through the brief, settings, and review steps. Switching models preserves prompt, source uploads, and other form state. Options show their estimated price before selection. Model selection locks while a submission is active. Available compatible adapters:

- Images: FLUX.1 Dev and Schnell. Both submit explicit dimensions (768 × 1344, 1344 × 768, or 1024 × 1024). Whole-megapixel billing gives $0.05 and $0.006 per image respectively.
- Text video: legacy Wan 2.1 ($0.40 per 720p call) and Wan 3.0 ($0.10/generated second at 720p).
- Image video / Motion beats: legacy Wan I2V or FLF2V ($0.40 per 720p call) and Wan 3.0 (duration/resolution pricing). Each Motion beat persists its own model. The main selector edits Beat 1.
- Cinema: Seedance 2.0 and Kling 3 Pro, including a switch on the final review step. Kling quotes use each shot’s audio setting; Seedance quotes account for resolution and a reference-video duration range. This changes future calls, not existing clips.
- Character stills: Modal Qwen, fal Qwen Image Edit 2511 ($0.03/output MP), and FLUX.2 Edit ($0.012/input + output MP). fal estimates conservatively round output up to whole MP; FLUX.2 assumes each resized reference bills 1 MP. Modal uses an editable A100-80GB runtime assumption; the default five minutes is **not a benchmark**. All options show per-image and batch totals. Model-specific limits are validated before sending; Modal-only settings stay saved. fal polling preserves every batch image.
- Longform: only Wan 3.0 is connected for 2–30s scenes. Quotes use each scene’s resolution; remaining spend excludes completed and held failed scenes.

Costs are provider-generation estimates, without retail markup, credits, director chat, storage or post-processing. Rates and source links are centralized in `lib/generate-cost.ts` (checked 2026-09-14). Seedance’s current provider page has slightly different rounded headline/table rates; we use the headline $0.3034/s 720p estimate and show a range when input-video duration is unknown. Provider invoices remain authoritative. No paid generation was used to verify these changes.

Submission cards accept only compatible model IDs. Jobs persist the resolved `fal_model` and polling uses that saved model, including legacy defaults for old jobs. Motion beat Dry run now sends a test request through jobs instead of starting a paid beat.

## Searchable prompt catalogs

Character stills include 486 location, 390 hairstyle, and 366 camera choices. Catalogs combine curated locations with lighting, hairstyles with colors, and framing/angle/lens setups. Each dropdown supports text filtering, category groups, random selection, clearing, and custom descriptions. Selections replace their own marked prompt section and survive model/step changes.

## Real authentication regression

`DATABASE_URL=postgresql://postgres@127.0.0.1:55438/tolley_revenue_test GENERATE_TEST_URL=http://localhost:3034 node --import <tsx-loader> tests/generate-access.ts` creates and removes a disposable local owner account. It exercises real credentials, real TOTP verification, same-origin access refresh with the original prompt preserved, non-owner rejection, and real API dry runs across all seven workflows and supported model variants. It refuses nonlocal URLs and databases and never submits a paid generation.

Provider configuration status is not a render health check. Completed paid images/videos are not verified by these dry-run tests.

The original `/generate` page and its compact preset lists are retained. Gen2 uses separate browser queue bindings and shares the existing authenticated generation APIs and job library.

## Preview deployment

CLI deployments must include `-m githubDeployment=1 -m githubCommitRef=feat/generate-guided-workflow` to load the branch-specific provider credentials. Generic `gitCommitRef` metadata alone does not link branch environment variables. Verify that the resulting deployment contains `FAL_KEY` and the owner allowlist keys; do not print credential values. This was the cause of the earlier preview's unavailable-engine message. See [Vercel's branch environment guide](https://vercel.com/kb/guide/branch-variables-and-domains-not-linked-to-cli-deployments).

The redesigned workspace is served at `/gen2` on previews and any future production release. `/generate` retains the original page, styles and compact presets. Gen2 styles are scoped to `.gen2-root`.

## Ease of use and advanced controls (2026-09-21)

Guided mode starts with prompt examples and basic output settings. **Review with current settings** skips the settings step only when the inputs are valid; it never submits a render. **Advanced options** reveals the original character seed, inference, dimension, negative, guidance and JSON controls without clearing them when closed. All controls view expands the sections. Simple image/video flows also expose seed, video negative prompt and an optional end-frame image. Sequence scenes have editable per-scene overrides.

Provider errors are explained separately from the original diagnostic. Balance exhaustion identifies fal as the shared billing service for Kling and Wan; missing references, rejected requests and video processing errors have distinct next steps. A failed sequence offers **Review scene**, **Clear failure**, and **Retry scene**. Reviewing is local navigation; clearing only resets the failed scene to a draft. The ineffective Continue queue button was removed. Background loading of other workflows no longer surfaces their failures as the current workflow’s error.

Edited sequence settings are saved before generation, retry, approval or reset; a failed save stops the action. Planning preserves the chosen automatic-generation setting. When automatic generation is off, the main sequence button submits only the next scene. Automatic mode retains the existing sequence flow and estimates. This setting is checked between scenes, too.

The private library is one list with image/video filters, prompt/model/job-ID search, and downloads. Gated Kling and Seedance clips are recognized as video; extracted last frames remain usable as image sources. Motion outputs no longer render in two separate galleries. The original library passcode and authenticated media routes still govern access.
