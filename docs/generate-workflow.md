# Guided Generate workspace

`/generate` starts with a choice of outcome and four steps:

1. **Choose a workflow** — seven available workflows, described by their inputs and outputs. Video → Video remains unavailable and is explained without presenting a working action.
2. **Describe & add sources** — prompts, references, uploads, and scene scripts. The optional director edits the same underlying cards as the manual controls.
3. **Adjust settings** — format, duration, seeds, negative prompts, content controls, JSON overrides, and queue planning as appropriate to the selected workflow.
4. **Generate & review** — input summary, actionable missing-input messages, generation, clip approval/retry, stitching, and gated downloads.

**All controls** displays every step together. Numbered navigation permits inspection of any step; the forward button explains missing prerequisites. Forms stay mounted across step navigation, preserving file selections and JSON drafts. Server queue persistence and bindings remain unchanged. `?workflow=` preserves a selected workflow when queue bindings also exist; explicit `?queue=` or `?cinema=` links without a workflow open the relevant review step.

| Workflow | Engine / API path | Required input |
| --- | --- | --- |
| Create an image | FLUX, `/api/generate/jobs` | Prompt or scene details |
| Animate an image | Wan I2V, jobs + upload | Image and motion prompt |
| Create a video from text | Wan T2V, jobs | Prompt |
| Create a character still | Modal Qwen Image Edit, jobs | Prompt and identity references |
| Direct a sequence | Motion, jobs + beats | Starting still and first-clip prompt |
| Build a continuous video | Wan 3.0, longform | Starting still and planned scenes |
| Make a cinematic film | Seedance / Kling, cinema | Reference images and planned shots |

The shared library retains its server-verified passcode gate. Selecting a still sets the current video workflow's source and returns to step 2. Selecting from a still-creation workflow opens Animate an image. Engine video outputs are excluded from the Modal still gallery.

Generation requires the existing admin authentication. The sign-in refresh button checks access without reloading the page or discarding edits. Test-run success and provider errors are visible in the workspace even with the director closed.

## Verification

- `node --import <tsx-loader> --test lib/generate-*.test.ts`: existing engine, card, queue, and persistence regression tests.
- `GENERATE_TEST_URL=http://127.0.0.1:3024 node --import <tsx-loader> tests/generate-guided.ts`: browser regression against a local app. Every API request is fulfilled locally; this test never creates paid generation jobs. Covers seven workflows, back/forward state, file selection, dry-run payloads, error recovery, library unlock and source selection, longform/Cinema planning, all-controls view, mobile overflow, and sign-in recovery. Screenshots are written to `/tmp/tolley-generate-guided-review`.
- `npm run build`: changelog, links, Prisma generation, production type check and Next build.

The redesign does not change engine submission payloads, paid rendering, authentication, or clip stitching APIs. Existing source/queue state remains owned by GenerateStudio; WorkflowSection controls presentation only.
