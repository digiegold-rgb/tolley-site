# Animate bug hunt (post-#66)

Discovery only against `main` (`f590744`). Verified in code. No fal spend. No customer email.

**Out of scope / already in flight**

- Video #66 delivery race (`concierge_in_progress` + live mp4, library hide, `/deliver` 409 `audit_missing`) — **PR #98** (`cursor/animate-delivery-check-6eba`). Do not redo.
- T-Agent, Engine 1, ads, Lady.

**#66 sister search.** The log-`→ ready` / write-old-status bug is only in `lib/vater/project-sync.ts:397` (`policy === "concierge" ? project.status : nextStatus`). PR #98 already fixes that persist + the QA clobber. No other stage (script / voiceover / scenes / animation / QA) logs a transition and then writes the previous status. Related *deadlocks* below are a different class: the row is written to a status that **never enters** `IN_FLIGHT_STATUSES`, so `/poll` never runs.

---

## P0

### 1. Script Review “Approve & Animate” does not start a render or notify HQ

Trey’s own-script path. Studio-tier screen (`nav-visibility.ts:59`; Trey is on the studio allowlist).

**What the UI says**

- Button: `Approve & Animate — est. $X` / spinner `Starting render…` (`ScriptReviewScreen.tsx:1334–1343`).
- Copy: “Approving sends the text above to the renderer” (`:1351`).
- File header: “Approve & Animate — the ONLY thing that starts spend” (`:15`).

**What the code does**

```1206:1222:components/animate/screens/review/ScriptReviewScreen.tsx
  const approve = async (): Promise<void> => {
    // …
      const res = await fetch(`/api/vater/youtube/${project.id}/approve-script`, {
```

`POST /approve-script` is **free** and parks at `awaiting_engine` (`approve-script/route.ts:109–112`). It does not call `produce`, `startRunCreation`, or `submitConcierge`. No Telegram.

After refresh, `stageOf(awaiting_engine)` falls through to `'preparing'` (`ScriptReviewScreen.tsx:207–220`). Detail switches off `ReviewPanel` to `ProjectLiveDetail`, which prints “Getting this project ready.” and a empty `RenderProgress` — **no engine picker** (`ProjectLiveDetail.tsx:45–51`). Create’s Engine step is the only money click (`EngineStep.tsx` → `POST /produce`).

**User impact.** Trey pastes a Jeff/Linda script, sets the opening window, clicks a priced Approve button. Nothing is queued. HQ is silent. The card looks stuck in “Preparing.”

**Repro.** `#r=script-review` → paste ≥20 words → Approve & Animate → row is `awaiting_engine`, `autopilotJobId=null`, no Fable ticket, no Telegram. Compare to Create step 6 → produce.

---

### 2. Auto produce writes `scripted`; every poll kicker ignores it

When a customer *does* hit `POST /produce` `engine=auto`:

```99:128:app/api/vater/youtube/[id]/produce/route.ts
      status: "scripted",
      flowStep: 7,
      // …
    const withJob = await prisma.youTubeProject.update({
      where: { id },
      data: { autopilotJobId: jobId },
    });
```

`scripted` is **not** in `IN_FLIGHT_STATUSES` (`youtube-status.ts:123–135`). Kickers that require that set:

| Kicker | Gate |
|---|---|
| Create poll | `useCreatePoll.ts:30–32` `onDgx()` |
| Progress badge | `ProgressBadgeProvider.tsx:158–164` |
| Library interval | `Library.tsx:114–123` |
| Script Review tick | `ScriptReviewScreen.tsx:293–300` |
| ProjectShell | `ProjectShell.tsx:278` |

`deriveCreateStep` treats `scripted` + `scriptApprovedAt` as step 7 **async** (`create-steps.ts:179–182`), so the UI *says* “Producing…” and GETs the row — it never POSTs `/poll`. There is no cron that calls `syncProjectFromJob` for auto jobs.

Same `status: "scripted"` + job pattern: `lib/vater/public-api.ts:274`, `app/api/vater/topic/route.ts`, `context/route.ts` (scriptOverride).

**User impact.** Spark/DGX can finish the mp4 while the row stays `scripted`, no `finalVideoUrl`, no ready email. Looks in-progress forever until someone manually hits `/poll`.

**Repro.** Create → approve script → produce `auto` → leave the tab. Wait for DGX `done`. `GET /youtube/[id]` still `scripted`. One `GET /youtube/[id]/poll` flips it.

---

### 3. `from-script` does not seed Jeff/Linda / Finance Pixar (F5-7HR425 class)

```166:192:app/api/vater/youtube/from-script/route.ts
      styleId,
      animUntilS,
      status: "awaiting_script_approval",
      progress: 25,
```

No `stylePreset`, `voiceName`, `voiceCloneId`. Schema default is `stylePreset: "cinematic"` (`prisma/schema.prisma`).

Canonical seed (already fixed on other paths):

```119:127:lib/vater/project-remix.ts
    voiceName: style.voice,
    voiceCloneId: style.voiceCloneId,
    stylePreset: style.artStylePresetId,
```

`script-gate` still sends the **row** preset to DGX:

```176:176:lib/vater/script-gate.ts
    stylePreset: project.stylePreset,
```

`public-api.ts` documents the same miss as concierge ticket **F5-7HR425** (“Pixar 3D project renders cinematic”).

Locked bundle (`locked-style.ts:6–9`): preset `pixar` + Finance Pixar 3D + Monroe + Jeff host / Linda when named. Snapshot at kickoff *does* load the style row (`script-gate.ts:87–97`), but the top-level `stylePreset` the worker also reads is still `cinematic`.

**User impact.** Own-script Jeff videos can render / thumbnail / estimate as cinematic, wrong voice columns, wrong host.

**Repro.** `POST /api/vater/youtube/from-script` on the locked style → inspect row: `styleId` set, `stylePreset=cinematic`, `voiceName=null`. Compare `new-from-style` / remix.

---

### 4. Produce / script-gate never send `animQuality` — DGX falls back to Action, not Narration

UI / layer default is `modal-wan22-narrative` (`VisualsStep.tsx:214`, `animate-layer.ts:165`). Standing copy on Script Review: Jeff is the host, talking-head / narration (`ScriptReviewScreen.tsx:500–505`).

`startRunCreation` only forwards `defaultAnimUntilS` when `animUntilS > 0` — **no `animQuality`** (`script-gate.ts:137–142`). `buildStyleSnapshot` has `defaultAnimMode` / `defaultQuality` (stills), not motion tier (`style-snapshot.ts:107–136`).

Ops script `scripts/tmp-vater-rekick-render-V0STBtC3eOU.ts:4–9` states vater.py’s fallback is **`modal-wan22` (Action, $1.50/clip)**.

Legacy context form remaps the same way: `validAnimQualities` omits `modal-*`; Narrative becomes `"default"` then cloud rental pins **`modal-wan22`** (`context/route.ts:414–455`).

**User impact.** “Approve & Animate” (once it actually produces) and opening-window renders use aggressive Action motion for Jeff-as-real-person. Quote math that assumes Narrative ($0.80) understates Action ($1.50). 8 clips × $1.50 = **$12.00** — the figure Trey saw. (`pricing.ts:16–19` documents the old Narrative 150¢ quote; Action is still 150¢.)

**Repro.** Project with `animUntilS > 0` → produce auto → inspect scene `animQuality` / DGX style dict. Expect `modal-wan22`, not `modal-wan22-narrative`.

---

## P1

### 5. Opening-layer modal: after start, only Hide (no Back/Close)

`AnimateLayerModal.tsx:339–341` — backdrop dismiss disabled while `inFlight`. `:603–610` — footer label becomes **Hide**; Confirm disabled “In flight…”. Kickoff never `onClose()` (`:282–291`).

**Impact.** Full-screen overlay after Confirm. Click-outside does nothing. Feels frozen until Hide is found.

**Repro.** Library → Animate opening → Confirm. Try backdrop click.

---

### 6. Three different prices for the same opening motion

| Surface | Formula | 8 Wan clips / ~30s opening |
|---|---|---|
| Animate-layer ticket | `sceneCount × getAnimationPriceCents` (`animate-layer.ts:333–344`) | Narrative **$6.40** / Action **$12.00** |
| Script Review / Engine `fullUsd` | stills + `motionFraction × $2.70/min` + ops (`estimate.ts:187–197`) | minutes-scaled, not per-clip |
| Produce / 402 gate | `estimateUsdFor` = minutes × (ops + stills only) — **no motion** (`ledger.ts:558–563`) | ~$0.90/min |
| Trey Zelle bill | `costJson` pass-through (`summary.ts` + `billableComputeUsdForProject`) | ~8 × 16¢ ≈ **$1.28** compute |
| Prepaid animation | `recordUsage` only — **no `debitForAction`** (`scene/animate/route.ts:318–325`; contrast `ledger.ts:725–728`) | Usage row, balance unchanged |

VisualsStep “Add motion — est. $X” uses `fullUsd − draftUsd` (`VisualsStep.tsx:323–326`) then bills **per clip** (`:1373–1374`). A 10-min / ~150-scene video: estimate ~$27 vs bill ~$120.

Animation `checkBudget` without `projectId` reserves **$1** (`check-budget.ts:134–139`; `animate-all-kickoff.ts:76–80`).

Trey is unmetered (Zelle). He is quoted retail and invoiced cost. That is the $12 vs ~$0.70/scene (Narrative is **$0.80**; Hunyuan **$0.75**) mismatch.

**Repro.** Library → Animate opening → 8 scenes Narrative vs Action. Compare ticket, `GET …/estimate`.fullUsd, and post-finalize `costJson`.

---

### 7. No operator Telegram on the auto / own-script submit (Fable 5 submit is OK)

| Event | HQ Telegram |
|---|---|
| `submitConcierge` (produce `fable5` / `[id]/concierge`) | **Yes** (`concierge-submit.ts:257–258`) |
| `POST /from-script` | **No** |
| `POST /approve-script` | **No** |
| `POST /produce` `auto` | **No** |

If Trey’s intended lane is Fable 5, P0 #1 means he never reaches `submitConcierge`. If he uses Create → Jelly Auto, HQ never hears the job.

---

### 8. Library grid is finals-only; live re-compose vanishes + empty-state lie

```103:107:components/animate/screens/studio/Library.tsx
  const ready = React.useMemo(() => buckets.done.filter((p) => !!p.finalVideoUrl), [buckets]);
  const gridProjects = ready;
```

`pipeline` is built (`:91–94`) and **not rendered**. Empty copy still says in-progress “shows on this page and on Queue” (`:248–249`). Re-compose / opening layer sets `status: 'editing'` (`:147–150`); live `editing` → `customerStage` `in_progress` (`youtube-status.ts:226–228`) → not in `done` → card gone for up to 2h. Stale comment at `:272` still claims the grid shows in-flight work.

**#51 / #66 class that is NOT PR #98:** a *playable* final hidden because status is `editing` / in-flight, not the concierge-ready persist (that’s #98).

**Repro.** Ready video → Re-compose or Animate opening → Library shows “Nothing here yet” if it was the only done row.

---

### 9. Re-compose `editing` also never polled (same class as P0 #2)

`compose/route.ts:107–114` sets `status: "editing"` + new `autopilotJobId`. `editing ∉ IN_FLIGHT_STATUSES`. Editor toast: “Refresh when status flips to ready” (`EditorShell.tsx:649–658`) — nothing flips it if the tab is gone. `reconcile-renders` may bill; it does not `syncProjectFromJob`.

**Repro.** Re-compose → close tab → DGX done → row still `editing`.

---

### 10. Animate-all finalize is tab-owned; DGX `failed` leaves no project error

`finalizeAnimateAll` on `failed` returns 502 and does not clear `animateAllJobId` or set `errorMessage` (`animate-all-finalize.ts:83–88`). No cron. Monthly sweep bills done batches; it does not copy clips into `scenesJson` (`reconcile-renders.ts:275–278`).

**Impact.** Modal spend, stills stay stills, UI can look in-flight forever.

**Repro.** Kick `/animate-all`, close tab (or fail the Modal job). Clips missing; job id still set.

---

### 11. `from-script` skips step-5 gate metadata

No `flowStep: 5`, no `approvalExpiresAt`. Contrast `write-script/route.ts:250–255`. `approvalExpiresAt: null` never expires (`approval-expiry.ts`). Deep links / 7-day clock wrong. Status still maps to step 5 via `deriveCreateStep`, so the badge mostly works.

---

### 12. Project History: concierge row never reaches a player

`ProjectDetail.tsx:82–85` — `inFlightOrDone` omits `concierge_*`. Falls through to `YouTubeProjectDetail`, which treats unknown status as `DraftView` (“Project queued…”) even with a live `finalVideoUrl` (`youtube-project-detail.tsx:43–107`).

**Repro.** History → Fable 5 row `concierge_in_progress` + blob URL → no `<video>`. (Post-#98 `ready` is fine.)

---

### 13. Script list price 5¢ vs DGX bill 25¢

Create writer: floor 5¢ + 30% (`script-writer-models.ts:19–20`). Editor chrome: `SECTION_PRICES.script = '$0.05'` (`tokens.ts`). Poll of a DGX script job: `FLAT_ACTION_PRICES.script.priceCents` = **25** (`pricing.ts:71`, `project-sync.ts:733–743` — comment still says “flat 5¢”).

---

### 14. Poll swallows Spark/Modal failures into a forever in-progress UI

- `createApi.pollProject` catch → `null` (`create-api.ts:129–135`); UI keeps GET-ing a stale row.
- Concierge policy: `logTransition` `→ failed` but status stays `concierge_in_progress` (`project-sync.ts:397, 428–434`). **By design / partial #98 overlap** — customer still sees “in the studio” until HQ.
- GET `/poll` on autopilot 502 returns the pre-sync row (`poll/route.ts`).
- Auto `mapPhaseToStatus` can persist `ready` with **no** final (`project-sync.ts:197–207`) when `job.status === "done"` and result is empty (not a fetch-source transcript). Library Done chip, nothing to play. Not #98 (that PR changes concierge persist only).

---

## P2

### 15. Hash SPA (signed-in) — ids match; a few edges

Verified mapping: `#r=` → `Shell.tsx:364–377` → `NAV_ROUTES[].id`. `#r=queue` aliases Progress. `#tab=` is HQ-only.

| Issue | Where | Impact |
|---|---|---|
| Signed-out deep link dropped | `AnimateLanding.tsx:81–82` callback `/animate` (no hash) | Bookmark `#r=library` → sign-in → dashboard |
| `#r=library&p=` ignored | `DoneStep.tsx:60` vs Library never reads `selectedProjectId` | “Open in Library” does not focus the card |
| `#r=editor` without `p=` | `Shell.tsx:643–650` | Hash stays editor; screen is dashboard |
| Workspace switch strips hash | `WorkspaceTabs.tsx:117–118` | Lands `/animate` |

Not broken for signed-in `#r=library|progress|publishing|recent|shorts-library|dashboard|script-review|direct`.

---

### 16. Shorts cutter requires `ready`/`editing`

`ShortsLibrary.tsx:84–89`. Playable `finalVideoUrl` on `composing_video` / concierge pre-delivery is missing. Server `/short` only needs a final.

---

### 17. AnimationScreen still advertises $0.32/clip

`AnimationScreen.tsx:7,25`. Retail is $0.80+ (`pricing.ts:42–46`). Studio stub screen.

---

### 18. `from-transcript` same missing style seed

`from-transcript/route.ts:172–189`. Same cinematic default. Sets `flowStep: 4`.

---

## Suggested fix order (not done here)

1. Script Review Approve → `produce` (or Engine picker) + Telegram on submit. Stop lying on the button.
2. Produce / public-api / topic: write `queued` (or first real phase), not `scripted`, **or** treat `autopilotJobId && !terminal` as in-flight in every kicker.
3. Seed `from-script` like `createProjectFromStyle`; pass `animQuality: modal-wan22-narrative` from `script-gate` when `animUntilS > 0`.
4. Auto-close or Close (not Hide-only) on `AnimateLayerModal`.
5. One quote model per surface; Zelle vs retail labeled for unmetered.
6. Do **not** touch `project-sync` concierge persist / `/deliver` / QA clobber — PR #98.

No code landed except this file. No merge.
