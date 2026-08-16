# Jelly Studio — feature build contract (2026-08-16)

Shared interface for the parallel build lanes. Site (Next.js, ~/tolley-site) ↔ DGX orchestrator (~/content-autopilot/vater.py) ↔ Remotion (~/content-autopilot/remotion). Everything is ADDITIVE and OPTIONAL: any missing field = today's behavior.

## Project-level settings (stored on YouTubeProject.settingsJson / passed in run-creation kwargs as `features`)
```jsonc
{
  "captionPreset": "clean" | "bold-yellow" | "karaoke-pink" | "minimal-lower" | "boxed" | "none",   // default "clean"
  "overlays": { "charts": true, "maps": true, "headers": true },                                     // default all false
  "cameraDefault": "alternate" | "zoom-in" | "zoom-out" | "pan-l" | "pan-r" | "still",              // default "alternate"
  "transitionSec": 0.0,                                                                             // 0–2, default 0 (hard cuts)
  "musicMoods": true,                                                                               // default false → single track
  "language": "en",                                                                                 // ISO code; non-"en" → ElevenLabs multilingual path
  "pronunciations": { "Tolley": "TAH-lee" },                                                       // spoken-text map
  "narrationUrl": "https://…/upload.wav",                                                           // BYO narration → skip TTS
  "aspect": "16:9" | "9:16",                                                                       // default 16:9
  "brandKit": { "logoUrl": "", "captionFont": "", "captionColor": "", "accentColor": "" },
  "motionMode": "draft" | "full"                                                                    // draft = stills only; full = wan pass
}
```
Per-scene overrides live in `scenesJson[i].camera` ("zoom-in"|…|"still") and `scenesJson[i].transitionSec`.

## DGX endpoints (bearer = CONTENT_API_KEY, all under :8096)
- POST /vater/run-creation — accepts `features` (above). Backend reads them; unknown keys ignored.
- POST /vater/projects/{projectId}/estimate → `{ stillsUsd, motionUsd, ttsUsd, totalDraftUsd, totalFullUsd, minutes, sceneCount }` (pure math from planned scenes/words; no spend).
- POST /vater/projects/{projectId}/revoice-line { sceneIndex, text? } → re-runs IndexTTS for one scene, re-aligns, returns { audioUrl, durationSec }.
- POST /vater/projects/{projectId}/thumbnail-variants { count: 2|3, hints?: [] } → [{ url, variant }].
- POST /vater/projects/{projectId}/aspect-cut { aspect: "9:16" } → new job id (reuses narration + captions, re-plans framing).
- GET  /vater/projects/{projectId}/chapters → [{ startSec, title }] derived from scene schedule + planner section headers.
- GET  /vater/characters?owner=<ownerKey> → [{ id, name, descriptor, previewUrl, styleId }].
- POST /vater/script/from-url { url } → { title, text, source } (article/PDF/YouTube-transcript extraction).
- POST /vater/script/translate { text, targetLanguage } → { text }.

## Site endpoints (session-gated, /api/vater/…)
- GET  /api/vater/youtube/[id]/estimate → proxies DGX estimate + adds `opsUsd` (minutes × VATER_OPS_RATE_PER_MIN) → { draftUsd, fullUsd, breakdown }.
- POST /api/vater/youtube/[id]/remix → new project from this one (style snapshot, voice, aspect, soundtrack, characters, brandKit, captionPreset) → { id }.
- POST /api/vater/youtube/[id]/aspect-cut, /revoice-line, /thumbnail-variants, GET /chapters, POST /api/vater/script/from-url, /translate — thin proxies.
- GET  /api/vater/characters — proxy with ownerKey = u_<userId> (owner sees all).
- Publish: PublishPanel sends `publishAt` (ISO) → youtube-upload sets status.publishAt + privacyStatus="private".
- Refund: reconcile-renders → ledger `refund` row when job failed; receipt shows "Refunded $X — <reason>".
- Referral: each invited user gets 2 codes (BetaInvite.createdBy=userId, note "referral"); invitee's first debit triggers `grant` $5 to referrer (idempotent).
- Public API v1 (bearer API key, table VaterApiKey): POST /api/v1/videos (from-script), GET /api/v1/videos/{id}, GET /api/v1/status; webhook URL on the key; /llms.txt + /api/v1/mcp manifest.

## Remotion props (remotion/src)
- `captionPreset`, `brandKit`, per-scene `camera` + `transitionSec`, `overlays[]` per scene ({type:"chart"|"map"|"header", data}), `musicSegments[]` ({startSec,endSec,trackUrl,gainDb}), composition `JellyVertical` (1080×1920) alongside the 16:9 one.
