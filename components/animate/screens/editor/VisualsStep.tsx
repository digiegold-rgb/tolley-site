'use client';

/* VisualsStep — Step 4 (the largest step).
 *
 * TWO sub-views toggled by Back to Settings / Go to Prompts:
 *   - 'config' (Settings)  — voiceover source, visual type, template combo,
 *     timeline scrubber w/ segments, expanded per-segment panel,
 *     Art Style block (wraps youtube-style-picker), Smart Overlays toggle,
 *     Characters block (wraps youtube-style-document-picker + vater-file-upload),
 *     Cloud Rental panel (DGX Local vs Modal Cloud), Scene Consistency
 *     (IP-Adapter), Background Music (wraps youtube-music-picker),
 *     full-width "Generate N Prompts" button.
 *   - 'scenes' — stack of scene cards (number + time + quote, duration bar,
 *     Re-Animate Image, Preview Image, image preview, Animate-this-scene
 *     toggle, Image Quality + mini icon row), sticky bottom bar with
 *     N scenes • Mm Ss + 4 buttons.
 *
 * Risks honored:
 *   #1 — scenesJson per-idx merge: every PATCH/POST mutates by sceneIdx via
 *        the existing routes that already merge per-idx server-side; we never
 *        ship a wholesale scenesJson replacement from this client.
 *   #2 — Animation quality whitelist enforced at the dropdown level by mirror
 *        of the route's VALID_QUALITIES (see ANIMATION_QUALITIES).
 *   #3 — Style snapshot freeze: editing a Style here does not propagate;
 *        the picker shows it as the style on this project, period.
 *   #7 — Range header on video preview: native <video src=…> directly to the
 *        scene proxy, no middleware injected.
 *   #9 — System styles immutable: youtube-style-document-picker filters to
 *        non-system; pickers handle their own affordances.
 *  #10 — Re-compose autopilotJobId rotation: Render Video calls
 *        POST /compose then refreshes; we refetch project state to pick up
 *        the rotated jobId so subsequent scene proxy URLs resolve correctly.
 */

import * as React from 'react';
import { JELLY_TOKENS, SECTION_PRICES } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon } from '../../Icon';
import { VBtn, VCard } from '../../primitives';
import { YouTubeStylePicker } from '@/components/vater/youtube-style-picker';
import { YouTubeStyleDocumentPicker } from '@/components/vater/youtube-style-document-picker';
import { YouTubeMusicPicker } from '@/components/vater/youtube-music-picker';
import { VaterFileUpload } from '@/components/vater/vater-file-upload';
import { PromptReviewModal } from './PromptReviewModal';
import {
  animationOptionLabel,
  formatPrice,
  getAnimationPriceCents,
} from '@/lib/vater/pricing';
import { useRoute } from '../../theme-context';
import {
  type StylePresetId,
  DEFAULT_STYLE_PRESET,
} from '@/lib/vater/style-presets';
import type {
  AnimationQuality,
  SceneSpec,
} from '@/lib/vater/video-spec';
import {
  CAMERA_DEFAULTS,
  CAPTION_PRESETS,
  MAX_TRANSITION_SEC,
  readFeatures,
  saveFeatures,
  type CameraMove,
  type CaptionPreset,
  type ProjectFeatures,
} from '@/lib/vater/project-features';
import type { EditorStepProps } from './ProjectShell';
import {
  BillingBlockModal,
  type BillingBlockReason,
} from './BillingBlock';

/* Mirrors the route's VALID_QUALITIES exactly. Any new tier added to the
 * route (app/api/vater/youtube/[id]/scene/animate/route.ts) MUST be added here
 * — risk #2. The route currently fail-louds on drift, which is what we want.
 * Labels/prices come from lib/vater/pricing.ts — the customer price, not our
 * Modal cost. */
const ANIMATION_QUALITY_ORDER: ReadonlyArray<AnimationQuality> = [
  'modal-wan22-narrative',
  'modal-wan22-narrative-fast',
  'modal-hunyuan-narrative',
  'modal-hunyuan-narrative-fast',
  'modal-wan22',
  'modal-wan22-fast',
  'modal-easyanimate-anime',
  'kling-standard',
  'kling-pro',
  'kling-master',
  'luma',
  'turbo',
  'default',
  'default_1080p',
  'high',
  'wan22-local',
  'ltx-local',
];

const ANIMATION_QUALITIES: ReadonlyArray<{ id: AnimationQuality; label: string }> =
  ANIMATION_QUALITY_ORDER.map((id) => ({ id, label: animationOptionLabel(id) }));

type VisualType = { emoji: string; label: string };
const VISUAL_TYPES: VisualType[] = [
  { emoji: '🖼️', label: 'Images' },
  { emoji: '✨', label: 'Animated' },
  { emoji: '👤', label: 'Avatar' },
  { emoji: '🎬', label: 'B-Roll' },
  { emoji: '🎭', label: 'B-Roll Mix' },
  { emoji: '🖼️', label: 'Visuals Mix' },
];

interface CloudOption {
  key: 'dgx' | 'modal';
  label: string;
  desc: string;
}
const CLOUD_OPTIONS: CloudOption[] = [
  { key: 'dgx', label: 'DGX Local', desc: 'Free, uses your GPU' },
  { key: 'modal', label: 'Modal Cloud', desc: '~$0.03/scene L40S' },
];

/** Local shape — UI reads only this subset; the route owns full scenesJson
 *  schema validation. Per risk #9 in feature-inventory.md: don't overwrite
 *  the full scene record on writes — merge per-idx, preserving every UI
 *  field. This typedef is read-only display state. */
type ParsedScene = Pick<
  SceneSpec,
  | 'idx'
  | 'startS'
  | 'endS'
  | 'beatText'
  | 'imagePrompt'
  | 'version'
  | 'videoVersion'
  | 'mediaType'
  | 'animate'
  | 'animQuality'
> & {
  /** Per-scene camera override (contract: scenesJson[i].camera). Undefined
   *  means "inherit features.cameraDefault". */
  camera?: CameraMove;
  /** What the planner decided to overlay on this beat, if anything. Read
   *  from the contract's `overlay` key, falling back to the flags the
   *  existing /scene/overlay route writes (isChart / isMap / isHeader). */
  overlay?: 'chart' | 'map' | 'header';
};

/** Read the planner's overlay marking off a raw scene record. */
function parseOverlay(o: Record<string, unknown>): ParsedScene['overlay'] {
  const raw =
    typeof o.overlay === 'string'
      ? o.overlay
      : typeof (o.overlay as { type?: unknown } | undefined)?.type === 'string'
        ? ((o.overlay as { type: string }).type)
        : null;
  if (raw === 'chart' || raw === 'map' || raw === 'header') return raw;
  if (o.isChart === true) return 'chart';
  if (o.isMap === true) return 'map';
  if (o.isHeader === true) return 'header';
  return undefined;
}

const OVERLAY_BADGES: Record<
  NonNullable<ParsedScene['overlay']>,
  { label: string; color: string }
> = {
  chart: { label: '📊 Chart', color: '#0EA5E9' },
  map: { label: '🗺️ Map', color: '#16A34A' },
  header: { label: '🔤 Section header', color: '#F59E0B' },
};

function parseScenes(raw: unknown): ParsedScene[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, i): ParsedScene | null => {
      if (!s || typeof s !== 'object') return null;
      const o = s as Record<string, unknown>;
      const idx = typeof o.idx === 'number' ? o.idx : i;
      return {
        idx,
        startS: typeof o.startS === 'number' ? o.startS : 0,
        endS: typeof o.endS === 'number' ? o.endS : 0,
        beatText: typeof o.beatText === 'string' ? o.beatText : '',
        imagePrompt: typeof o.imagePrompt === 'string' ? o.imagePrompt : '',
        version: typeof o.version === 'number' ? o.version : 0,
        videoVersion: typeof o.videoVersion === 'number' ? o.videoVersion : 0,
        mediaType: o.mediaType === 'video' ? 'video' : 'image',
        animate: Boolean(o.animate),
        animQuality:
          typeof o.animQuality === 'string'
            ? (o.animQuality as AnimationQuality)
            : undefined,
        camera:
          typeof o.camera === 'string' ? (o.camera as CameraMove) : undefined,
        overlay: parseOverlay(o),
      };
    })
    .filter((s): s is ParsedScene => s !== null);
}

/* ─── Render estimate ─────────────────────────────────────────────────────
 * GET /api/vater/youtube/[id]/estimate → { draftUsd, fullUsd, breakdown }.
 * That route is lane-billing's; until it exists (or while the DGX side is
 * still being built) it answers 404/501 and we show "est. —" rather than an
 * error. Pure math on the server — polling it never spends anything.
 */
interface RenderEstimate {
  draftUsd: number | null;
  fullUsd: number | null;
  /** True while the first fetch is in flight — the caller shows "est. …". */
  loading: boolean;
}

function useRenderEstimate(projectId: string | null): RenderEstimate {
  const [state, setState] = React.useState<RenderEstimate>({
    draftUsd: null,
    fullUsd: null,
    loading: !!projectId,
  });

  React.useEffect(() => {
    if (!projectId) {
      setState({ draftUsd: null, fullUsd: null, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/vater/youtube/${projectId}/estimate`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          if (!cancelled) {
            setState({ draftUsd: null, fullUsd: null, loading: false });
          }
          return;
        }
        const data = (await res.json()) as {
          draftUsd?: number;
          fullUsd?: number;
        };
        if (cancelled) return;
        setState({
          draftUsd: typeof data.draftUsd === 'number' ? data.draftUsd : null,
          fullUsd: typeof data.fullUsd === 'number' ? data.fullUsd : null,
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState({ draftUsd: null, fullUsd: null, loading: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return state;
}

/** "$1.85" / "—" for a maybe-missing dollar figure. */
function fmtUsd(usd: number | null, loading: boolean): string {
  if (loading) return '…';
  if (usd === null) return '—';
  return `$${usd.toFixed(2)}`;
}

function fmtDur(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VisualsStep({ projectId, project, refresh }: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const [view, setView] = React.useState<'config' | 'scenes'>('config');
  const [voiceoverSource, setVoiceoverSource] = React.useState<'upload' | 'generated'>('generated');
  const [visualType, setVisualType] = React.useState<number>(1);
  const [stylePreset, setStylePreset] = React.useState<StylePresetId>(DEFAULT_STYLE_PRESET);
  const [styleDocId, setStyleDocId] = React.useState<string | null>(null);
  const [cloudRental, setCloudRental] = React.useState<CloudOption['key']>('dgx');
  const [consistency, setConsistency] = React.useState(true);
  const [animQuality, setAnimQuality] = React.useState<AnimationQuality>('modal-wan22-narrative');
  const [musicId, setMusicId] = React.useState<string | null>(null);
  const [musicVolume, setMusicVolume] = React.useState(0.18);
  const [generating, setGenerating] = React.useState(false);
  const [animating, setAnimating] = React.useState(false);
  const [composing, setComposing] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  // Billing gate (402 budget.reason from the generation routes) — rendered as
  // a modal with the right call-to-action (add card / fix card / raise limit).
  const [billingBlock, setBillingBlock] = React.useState<BillingBlockReason | null>(null);
  // Pending batch-animate confirmation: which sceneIdxs (null = all) + count.
  const [confirmAnimate, setConfirmAnimate] = React.useState<
    { sceneIdxs: number[] | null; count: number } | null
  >(null);
  // Per-scene selection for batch operations (Animate Selected, Regen Images
  // Selected). Stored as a Set of sceneIdx so toggles are O(1) and the
  // sceneIdxs we send to /animate-all stay in stable numeric order.
  const [selectedScenes, setSelectedScenes] = React.useState<Set<number>>(
    () => new Set(),
  );

  const scenes = React.useMemo(() => parseScenes(project?.scenesJson), [project?.scenesJson]);
  const totalDuration = scenes.reduce(
    (acc, s) => Math.max(acc, s.endS),
    project?.audioDuration ?? 0,
  );

  // ─── Feature bag (2026-08-16 contract) ────────────────────────────────
  // Server state is the source of truth; `pending` holds the key the user
  // just clicked so the control reflects the change before `refresh()`
  // round-trips. Every write is a PARTIAL patch — the PATCH route shallow-
  // merges, so writing `overlays` here can't wipe the Script step's
  // `language`.
  const saved = React.useMemo(
    () => readFeatures(project?.settingsJson),
    [project?.settingsJson],
  );
  const [pending, setPending] = React.useState<ProjectFeatures>({});
  const [featureError, setFeatureError] = React.useState<string | null>(null);
  const features: ProjectFeatures = React.useMemo(
    () => ({ ...saved, ...pending }),
    [saved, pending],
  );

  // Drop optimistic keys once the server echoes them back.
  React.useEffect(() => {
    setPending((prev) => {
      const next: ProjectFeatures = {};
      let changed = false;
      for (const [k, v] of Object.entries(prev)) {
        const server = (saved as Record<string, unknown>)[k];
        if (JSON.stringify(server) === JSON.stringify(v)) changed = true;
        else (next as Record<string, unknown>)[k] = v;
      }
      return changed ? next : prev;
    });
  }, [saved]);

  const patchFeatures = React.useCallback(
    async (patch: ProjectFeatures) => {
      if (!projectId) return;
      setPending((prev) => ({ ...prev, ...patch }));
      setFeatureError(null);
      try {
        await saveFeatures(projectId, patch as Record<string, unknown>);
        await refresh();
      } catch (err) {
        // Roll the optimistic value back — a control that stays flipped
        // after a failed save is a lie about what will render.
        setPending((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(patch)) {
            delete (next as Record<string, unknown>)[k];
          }
          return next;
        });
        setFeatureError(
          err instanceof Error ? err.message : 'Could not save that setting',
        );
      }
    },
    [projectId, refresh],
  );

  const captionPreset: CaptionPreset = features.captionPreset ?? 'clean';
  const cameraDefault: CameraMove = features.cameraDefault ?? 'alternate';
  const transitionSec = features.transitionSec ?? 0;
  const overlays = features.overlays ?? {};

  // Live cost estimate for the motion pass. Lane-billing is building
  // `useRenderEstimate` in lib/vater/use-estimate.ts against the same route;
  // when it lands, delete this hook and import theirs — the shape is the same.
  const estimate = useRenderEstimate(projectId);
  const motionEstimate =
    estimate.fullUsd !== null && estimate.draftUsd !== null
      ? Math.max(0, estimate.fullUsd - estimate.draftUsd)
      : null;

  // ─── Actions ──────────────────────────────────────────────────────────

  /** Turn a failed generation-route response into either a billing-block
   *  modal (returns null) or a user-facing error string. The routes return:
   *    402 { error, budget: { reason, ... } } — billing gate
   *    429 { error, retryAfterSeconds }       — rate limited
   *    409 { error }                          — scene animation lock
   *  No silent paths — every branch ends in a modal or an inline message. */
  const describeGenerationError = React.useCallback(
    async (res: Response): Promise<string | null> => {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        retryAfterSeconds?: number;
        budget?: { reason?: string };
      };
      if (res.status === 402) {
        const reason = data.budget?.reason;
        if (
          reason === 'trial_cap_reached' ||
          reason === 'subscription_inactive' ||
          reason === 'payment_past_due' ||
          reason === 'monthly_limit_exceeded'
        ) {
          setBillingBlock(reason);
          return null; // surfaced via the billing modal instead
        }
        return data.error || 'Payment required — check Pricing for details.';
      }
      if (res.status === 429) {
        const s =
          typeof data.retryAfterSeconds === 'number'
            ? Math.ceil(data.retryAfterSeconds)
            : null;
        return s !== null
          ? `Rate limited — retry in ${s}s.`
          : 'Rate limited — try again in a moment.';
      }
      if (res.status === 409) {
        return 'This scene already has an animation running. Wait for it to finish, then retry.';
      }
      return data.error || `HTTP ${res.status}`;
    },
    [],
  );

  /** Per-scene camera override. Merges server-side by sceneIdx (risk #1). */
  const setSceneCamera = React.useCallback(
    async (sceneIdx: number, camera: CameraMove | null) => {
      if (!projectId) return;
      setFeatureError(null);
      try {
        const res = await fetch(
          `/api/vater/youtube/${projectId}/scene/camera`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceneIdx, camera }),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        await refresh();
      } catch (err) {
        setFeatureError(
          err instanceof Error ? err.message : 'Could not set the camera move',
        );
      }
    },
    [projectId, refresh],
  );

  /* Stills draft is the DEFAULT render: it plans the scenes and renders one
   * still per beat, with no i2v spend at all. Motion is a second, explicitly
   * priced click (see requestAddMotion). */
  const handleGeneratePrompts = React.useCallback(async () => {
    if (!projectId) return;
    setGenerating(true);
    setActionError(null);
    // Record the intent before kickoff so a tab close mid-render still leaves
    // the project marked as a stills draft.
    void patchFeatures({ motionMode: 'draft' });
    try {
      // Re-runs the context phase which produces scenes. Per risk #1, the
      // route's poll handler merges scenes per-idx so existing UI fields
      // (animQuality, motionIntensity, etc.) survive.
      const res = await fetch(`/api/vater/youtube/${projectId}/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stylePreset,
          styleId: styleDocId,
          backgroundMusicId: musicId,
          musicVolume,
          consistency: consistency ? 70 : 0,
          videoBackend: 'sdxl',
          animQuality,
          cloudRental: cloudRental === 'modal',
        }),
      });
      if (!res.ok) {
        const msg = await describeGenerationError(res);
        if (msg) setActionError(msg);
        return;
      }
      await refresh();
      setView('scenes');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  }, [projectId, stylePreset, styleDocId, musicId, musicVolume, consistency, animQuality, cloudRental, refresh, describeGenerationError, patchFeatures]);

  /** Executes the batch animation after the user confirms the price.
   *  sceneIdxs null = whole project (animate-all default path); a list forces
   *  re-animation of exactly those scenes (see route.ts:54-60). */
  const runBatchAnimate = React.useCallback(
    async (sceneIdxs: number[] | null) => {
      if (!projectId) return;
      setAnimating(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/vater/youtube/${projectId}/animate-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            sceneIdxs
              ? { quality: animQuality, sceneIdxs }
              : { quality: animQuality },
          ),
        });
        if (!res.ok) {
          const msg = await describeGenerationError(res);
          if (msg) setActionError(msg);
          return;
        }
        // Animation finalize is a long poll handled by the existing
        // EditorShell. For v2 we just kick it off and let the user navigate
        // away or refresh.
        await refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Animate failed');
      } finally {
        setAnimating(false);
      }
    },
    [projectId, animQuality, refresh, describeGenerationError],
  );

  // The batch buttons open the price-confirm modal; runBatchAnimate fires on
  // Confirm. Per-clip price comes from the selected quality tier.
  /** "Add motion" — the second, explicitly-priced pass over a stills draft.
   *  Flips motionMode to "full" so the estimate + any re-render agree with
   *  what the user just bought, then opens the price confirmation. */
  const requestAddMotion = React.useCallback(() => {
    void patchFeatures({ motionMode: 'full' });
    setConfirmAnimate({ sceneIdxs: null, count: scenes.length });
  }, [scenes.length, patchFeatures]);

  const requestAnimateSelected = React.useCallback(() => {
    const ids = Array.from(selectedScenes).sort((a, b) => a - b);
    if (ids.length === 0) return;
    setConfirmAnimate({ sceneIdxs: ids, count: ids.length });
  }, [selectedScenes]);

  const toggleSceneSelection = React.useCallback((idx: number) => {
    setSelectedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleAnimateScene = React.useCallback(
    async (sceneIdx: number) => {
      if (!projectId) return;
      try {
        const res = await fetch(`/api/vater/youtube/${projectId}/scene/animate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneIdx,
            // Empty prompt → DGX auto-suggests via planSceneAnimation upstream.
            animationPrompt: '',
            quality: animQuality,
          }),
        });
        if (!res.ok) {
          const msg = await describeGenerationError(res);
          if (msg) setActionError(msg);
          return;
        }
        await refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Animate failed');
      }
    },
    [projectId, animQuality, refresh, describeGenerationError],
  );

  const handleCompose = React.useCallback(async () => {
    if (!projectId) return;
    setComposing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/compose`, {
        method: 'POST',
      });
      if (!res.ok) {
        const msg = await describeGenerationError(res);
        if (msg) setActionError(msg);
        return;
      }
      // Risk #10: refetch to bust the autopilotJobId cache the next request
      // batch sees. The server already revalidates the tag; we resync state.
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Compose failed');
    } finally {
      setComposing(false);
    }
  }, [projectId, refresh, describeGenerationError]);

  // ─── Render: scenes view ──────────────────────────────────────────────

  if (view === 'scenes') {
    return (
      <div>
        <div
          style={{
            fontSize: 11,
            color: JELLY_TOKENS.brand,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          Cost: {SECTION_PRICES.visuals}
        </div>

        {scenes.length === 0 && (
          <VCard variant="flat" style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: t.textSecondary }}>
              No scenes yet. Run Generate Prompts from the Settings view.
            </div>
            <VBtn
              variant="outlined"
              size="sm"
              onClick={() => setView('config')}
              style={{ marginTop: 12 }}
            >
              Back to Settings
            </VBtn>
          </VCard>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scenes.map((sc) => {
            const dur = Math.max(0, sc.endS - sc.startS);
            const previewSrc = projectId
              ? `/api/vater/youtube/${projectId}/scene/${sc.idx}?v=${sc.version}&variant=image`
              : undefined;
            const videoSrc = projectId
              ? `/api/vater/youtube/${projectId}/scene/${sc.idx}?v=${sc.videoVersion}&variant=video`
              : undefined;
            return (
              <VCard key={sc.idx} variant="flat" style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={selectedScenes.has(sc.idx)}
                    onChange={() => toggleSceneSelection(sc.idx)}
                    disabled={animating}
                    style={{
                      marginTop: 6,
                      width: 16,
                      height: 16,
                      cursor: animating ? 'not-allowed' : 'pointer',
                      accentColor: JELLY_TOKENS.brand,
                      flexShrink: 0,
                    }}
                    aria-label={`Select scene ${sc.idx + 1} for batch operations`}
                  />
                  <div
                    style={{
                      width: 96,
                      height: 56,
                      borderRadius: JELLY_TOKENS.radius.md,
                      background: t.cardAlt,
                      flexShrink: 0,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {sc.mediaType === 'video' && videoSrc ? (
                      <video
                        src={videoSrc}
                        muted
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : previewSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewSrc}
                        alt={`Scene ${sc.idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="image" size={20} color={t.textSecondary} />
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: JELLY_TOKENS.brandGhost,
                          color: JELLY_TOKENS.brand,
                        }}
                      >
                        Scene {sc.idx + 1}
                      </span>
                      <span style={{ fontSize: 11, color: t.textSecondary }}>
                        {fmtDur(sc.startS)}–{fmtDur(sc.endS)}
                      </span>
                      <span style={{ fontSize: 11, color: t.textSecondary }}>
                        • {dur.toFixed(1)}s
                      </span>
                      {sc.overlay && (
                        <span
                          title="The planner marked this beat for an overlay"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            color: OVERLAY_BADGES[sc.overlay].color,
                            border: `1px solid ${OVERLAY_BADGES[sc.overlay].color}`,
                          }}
                        >
                          {OVERLAY_BADGES[sc.overlay].label}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: t.text,
                        marginTop: 4,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                      }}
                    >
                      “{sc.beatText || sc.imagePrompt}”
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        height: 4,
                        background: t.border,
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${
                            totalDuration > 0
                              ? Math.min(100, (dur / totalDuration) * 100)
                              : 0
                          }%`,
                          height: '100%',
                          background: JELLY_TOKENS.brand,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginTop: 8,
                        fontSize: 11,
                        color: t.textSecondary,
                      }}
                    >
                      <span>Image Quality:</span>
                      <span style={{ color: t.text }}>
                        {sc.animQuality ?? 'still'}
                      </span>
                      <Icon name="image" size={14} color={t.textSecondary} />
                      <Icon name="play" size={14} color={t.textSecondary} />
                      <Icon name="sparkle" size={14} color={t.textSecondary} />
                      {/* Per-scene camera. Empty value = inherit the project
                          default, which is what the label spells out so
                          nobody has to guess what "Auto" means here. */}
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>Camera:</span>
                        <select
                          value={sc.camera ?? ''}
                          onChange={(e) =>
                            void setSceneCamera(
                              sc.idx,
                              e.target.value
                                ? (e.target.value as CameraMove)
                                : null,
                            )
                          }
                          style={{
                            padding: '2px 6px',
                            borderRadius: JELLY_TOKENS.radius.sm,
                            border: `1px solid ${t.border}`,
                            background: t.card,
                            color: t.text,
                            fontSize: 11,
                            fontFamily: JELLY_TOKENS.font,
                          }}
                          aria-label={`Camera move for scene ${sc.idx + 1}`}
                        >
                          <option value="">
                            Default (
                            {CAMERA_DEFAULTS.find((c) => c.id === cameraDefault)
                              ?.label ?? 'Auto'}
                            )
                          </option>
                          {CAMERA_DEFAULTS.filter((c) => c.id !== 'alternate').map(
                            (c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <VBtn
                      size="sm"
                      variant="text"
                      onClick={() => {
                        if (previewSrc && typeof window !== 'undefined') {
                          window.open(previewSrc, '_blank');
                        }
                      }}
                      style={{ color: '#0EA5E9' }}
                    >
                      Preview Image
                    </VBtn>
                    <VBtn
                      size="sm"
                      variant="outlined"
                      onClick={() => handleAnimateScene(sc.idx)}
                      style={{ color: '#9C27B0', borderColor: 'rgba(156,39,176,0.4)' }}
                    >
                      Re-Animate ({formatPrice(getAnimationPriceCents(animQuality))})
                    </VBtn>
                    {/* Animate-this-scene toggle. Mirrors UI-only state for
                        the "include in animate-all" choice — the server picks
                        up sceneIdxs via animate-all body in the bulk action. */}
                  </div>
                </div>
              </VCard>
            );
          })}
        </div>

        {actionError && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: JELLY_TOKENS.radius.md,
              background: 'rgba(220,38,38,0.08)',
              color: JELLY_TOKENS.error,
            }}
          >
            {actionError}
          </div>
        )}

        {featureError && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: JELLY_TOKENS.radius.md,
              background: 'rgba(220,38,38,0.08)',
              color: JELLY_TOKENS.error,
            }}
          >
            {featureError}
          </div>
        )}

        {/* Sticky bottom bar */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: t.card,
            borderTop: `1px solid ${t.border}`,
            padding: '12px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            zIndex: 5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: t.textSecondary }}>
              {scenes.length} scenes • {fmtDur(totalDuration)}
            </div>
            {scenes.length > 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: t.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>•</span>
                <span>{selectedScenes.size} selected</span>
                <button
                  onClick={() =>
                    setSelectedScenes(new Set(scenes.map((s) => s.idx)))
                  }
                  disabled={animating}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: JELLY_TOKENS.brand,
                    fontSize: 12,
                    cursor: animating ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedScenes(new Set())}
                  disabled={animating}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: JELLY_TOKENS.brand,
                    fontSize: 12,
                    cursor: animating ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                >
                  None
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <VBtn size="sm" variant="ghost" onClick={() => setView('config')}>
              Back to Config
            </VBtn>
            <VBtn
              size="sm"
              variant="outlined"
              onClick={() => setReviewOpen(true)}
              disabled={scenes.length === 0}
              icon="edit"
            >
              Review Prompts
            </VBtn>
            <VBtn
              size="sm"
              variant="outlined"
              onClick={requestAnimateSelected}
              disabled={animating || selectedScenes.size === 0}
              style={{
                color: '#9C27B0',
                borderColor: 'rgba(156,39,176,0.4)',
              }}
            >
              {animating
                ? 'Animating…'
                : `Animate Selected (${selectedScenes.size})`}
            </VBtn>
            {/* Stills exist → motion becomes an explicit, priced second
                step. The estimate is the DELTA over the draft, because the
                draft is already paid for by the time this button shows. */}
            <span title="Turns every still into a short animated clip">
              <VBtn
                size="sm"
                onClick={requestAddMotion}
                disabled={animating || scenes.length === 0}
                style={{ background: '#9C27B0' }}
              >
                {animating
                  ? 'Animating…'
                  : `Add motion — est. ${fmtUsd(motionEstimate, estimate.loading)}`}
              </VBtn>
            </span>
            <VBtn size="sm" variant="outlined" icon="download">
              Download All Images
            </VBtn>
            <VBtn
              size="sm"
              onClick={handleCompose}
              disabled={composing}
              style={{ background: '#0EA5E9' }}
            >
              {composing ? 'Rendering…' : 'Render Video'}
            </VBtn>
          </div>
        </div>
        <PromptReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          projectId={projectId ?? ''}
          scenes={scenes}
          onComplete={refresh}
          initialSelected={selectedScenes}
        />
        <BatchAnimateConfirmModal
          request={confirmAnimate}
          priceCents={getAnimationPriceCents(animQuality)}
          qualityLabel={animationOptionLabel(animQuality)}
          onCancel={() => setConfirmAnimate(null)}
          onConfirm={() => {
            const ids = confirmAnimate?.sceneIdxs ?? null;
            setConfirmAnimate(null);
            void runBatchAnimate(ids);
          }}
        />
        <BillingBlockModal reason={billingBlock} onClose={() => setBillingBlock(null)} />
      </div>
    );
  }

  // ─── Render: config view ──────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, color: JELLY_TOKENS.brand, fontWeight: 600 }}>
          Cost: {SECTION_PRICES.visuals}
        </div>
        {scenes.length > 0 && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span
              onClick={() => setReviewOpen(true)}
              style={{
                fontSize: 13,
                color: JELLY_TOKENS.brand,
                cursor: 'pointer',
              }}
            >
              Review Prompts
            </span>
            <span
              onClick={() => setView('scenes')}
              style={{
                fontSize: 13,
                color: JELLY_TOKENS.brand,
                cursor: 'pointer',
              }}
            >
              Go to Prompts →
            </span>
          </div>
        )}
      </div>

      {/* Voiceover source */}
      <VCard style={{ marginBottom: 16 }}>
        <div
          onClick={() => setVoiceoverSource('upload')}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginBottom: 12,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: t.hover,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="upload" size={16} color={t.textSecondary} />
          </div>
          <div style={{ fontSize: 14, color: t.textSecondary }}>
            Upload Your Own Voiceover
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: voiceoverSource === 'upload'
                ? `6px solid ${JELLY_TOKENS.brand}`
                : `2px solid ${t.border}`,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div
          onClick={() => setVoiceoverSource('generated')}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: 12,
            borderRadius: JELLY_TOKENS.radius.md,
            border: voiceoverSource === 'generated'
              ? `2px solid ${JELLY_TOKENS.brand}`
              : `1px solid ${t.border}`,
            background: voiceoverSource === 'generated' ? JELLY_TOKENS.brandGhost : 'transparent',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: JELLY_TOKENS.brandGhost,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="mic" size={16} color={JELLY_TOKENS.brand} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>
              Use Generated Voiceover
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary }}>
              Use your generated voiceover to create visuals
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: voiceoverSource === 'generated'
                ? `6px solid ${JELLY_TOKENS.brand}`
                : `2px solid ${t.border}`,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </VCard>

      {/* Visual Type */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>
          VISUAL TYPE
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
          Tell us how you’d like your video visuals to be
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {VISUAL_TYPES.map((vt, i) => {
            const active = visualType === i;
            return (
              <div
                key={i}
                onClick={() => setVisualType(i)}
                style={{
                  padding: '12px 16px',
                  borderRadius: JELLY_TOKENS.radius.md,
                  cursor: 'pointer',
                  textAlign: 'center',
                  minWidth: 80,
                  border: active
                    ? `2px solid ${JELLY_TOKENS.brand}`
                    : `1px solid ${t.border}`,
                  background: active ? JELLY_TOKENS.brandGhost : 'transparent',
                }}
              >
                <div style={{ fontSize: 24 }}>{vt.emoji}</div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.text,
                    marginTop: 4,
                  }}
                >
                  {vt.label}
                </div>
              </div>
            );
          })}
        </div>
      </VCard>

      {/* Template combobox */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>
          Template
        </div>
        <select
          defaultValue=""
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${t.border}`,
            background: t.card,
            color: t.text,
            fontSize: 14,
            fontFamily: JELLY_TOKENS.font,
          }}
        >
          <option value="">Default — one prompt per beat</option>
          <option value="cutaway">Cutaway B-roll</option>
          <option value="character">Character-driven</option>
          <option value="documentary">Documentary</option>
        </select>
      </VCard>

      {/* Timeline scrubber */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="history" size={16} color={t.textSecondary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            Timeline
          </span>
          <span style={{ fontSize: 12, color: t.textSecondary }}>
            00:00 / {fmtDur(totalDuration)}
          </span>
        </div>
        <div
          style={{
            height: 48,
            background: t.cardAlt,
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${t.border}`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {scenes.length > 0
            ? scenes.map((s) => {
                const left = totalDuration > 0 ? (s.startS / totalDuration) * 100 : 0;
                const width = totalDuration > 0 ? ((s.endS - s.startS) / totalDuration) * 100 : 0;
                return (
                  <div
                    key={s.idx}
                    title={s.beatText}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${Math.max(0.5, width - 0.2)}%`,
                      top: 4,
                      bottom: 4,
                      background: `hsl(${260 + s.idx * 5}, 45%, ${50 + (s.idx % 3) * 10}%)`,
                      borderRadius: 4,
                      opacity: 0.7,
                    }}
                  />
                );
              })
            : Array.from({ length: 12 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${i * 8.3}%`,
                    width: `${8.3 - 0.5}%`,
                    top: 4,
                    bottom: 4,
                    background: `hsl(${260 + i * 5}, 45%, ${50 + (i % 3) * 10}%)`,
                    borderRadius: 4,
                    opacity: 0.4,
                  }}
                />
              ))}
        </div>
      </VCard>

      {/* Per-segment expanded panel: animation + quality + strategy radios */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>
          Per-segment defaults
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
              Type
            </div>
            <select
              defaultValue="image"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                background: t.card,
                color: t.text,
                fontSize: 13,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              <option value="image">Still image</option>
              <option value="video">Animated</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
              Animation Quality
            </div>
            <select
              value={animQuality}
              onChange={(e) => setAnimQuality(e.target.value as AnimationQuality)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                background: t.card,
                color: t.text,
                fontSize: 13,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              {ANIMATION_QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
            <div
              style={{
                fontSize: 11,
                color: JELLY_TOKENS.brand,
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              {formatPrice(getAnimationPriceCents(animQuality))}/clip — charged
              per animated scene
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 6 }}>
          Animation strategy
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { k: 'none', label: '🖼️ No animation' },
            { k: 'all', label: '🎬 Animate all' },
            { k: 'long', label: '⏱️ Longer scenes only' },
            { k: 'manual', label: '✏️ Per-scene (editor)' },
          ].map((s) => (
            <label
              key={s.k}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                fontSize: 12,
                color: t.text,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="anim-strategy"
                defaultChecked={s.k === 'manual'}
                style={{ accentColor: JELLY_TOKENS.brand }}
              />
              {s.label}
            </label>
          ))}
        </div>
      </VCard>

      {/* Art Style — wraps the existing 16-preset picker (system styles
          immutable — risk #9). Editing a Style here is non-destructive: it
          just selects which preset goes into context. */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="styles" size={16} color={t.textSecondary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            Art Style
          </span>
        </div>
        <YouTubeStylePicker value={stylePreset} onChange={setStylePreset} />
      </VCard>

      {/* Captions — 6 burned-in looks, each with a live swatch so the choice
          is made by eye instead of by name. */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon name="description" size={16} color={t.textSecondary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            Captions
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
          Burned into the video — pick the look before you render.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 8,
          }}
        >
          {CAPTION_PRESETS.map((p) => {
            const active = captionPreset === p.id;
            return (
              <div
                key={p.id}
                onClick={() => void patchFeatures({ captionPreset: p.id })}
                role="radio"
                aria-checked={active}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void patchFeatures({ captionPreset: p.id });
                  }
                }}
                style={{
                  padding: 10,
                  borderRadius: JELLY_TOKENS.radius.md,
                  cursor: 'pointer',
                  border: active
                    ? `2px solid ${JELLY_TOKENS.brand}`
                    : `1px solid ${t.border}`,
                  background: active ? JELLY_TOKENS.brandGhost : 'transparent',
                }}
              >
                <CaptionSwatch preset={p.id} />
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.text,
                    marginTop: 6,
                  }}
                >
                  {p.label}
                </div>
                <div style={{ fontSize: 11, color: t.textSecondary }}>
                  {p.note}
                </div>
              </div>
            );
          })}
        </div>
      </VCard>

      {/* Smart Overlays — three independent opt-ins. Off by default: the
          planner only injects an overlay for a beat that asked for one. */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkle" size={16} color={t.textSecondary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            Smart Overlays
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2, marginBottom: 12 }}>
          Let the planner turn qualifying beats into a chart, a map, or a
          section title card instead of a plain image.
        </div>
        <FeatureToggle
          label="Charts"
          hint="Numbers in the script become an animated bar/line chart"
          value={overlays.charts === true}
          onChange={(v) =>
            void patchFeatures({ overlays: { ...overlays, charts: v } })
          }
        />
        <FeatureToggle
          label="Maps"
          hint="Place names become a highlighted map beat"
          value={overlays.maps === true}
          onChange={(v) =>
            void patchFeatures({ overlays: { ...overlays, maps: v } })
          }
        />
        <FeatureToggle
          label="Section headers"
          hint="Chapter breaks become a full-screen title card"
          value={overlays.headers === true}
          onChange={(v) =>
            void patchFeatures({ overlays: { ...overlays, headers: v } })
          }
        />
      </VCard>

      {/* Camera + transitions */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon name="play" size={16} color={t.textSecondary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            Camera &amp; transitions
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
          Applies to every scene. Override individual scenes from the prompts
          view.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
              Default camera move
            </div>
            <select
              value={cameraDefault}
              onChange={(e) =>
                void patchFeatures({
                  cameraDefault: e.target.value as CameraMove,
                })
              }
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                background: t.card,
                color: t.text,
                fontSize: 13,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              {CAMERA_DEFAULTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === 'alternate' ? 'Auto — alternate per scene' : c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 4 }}>
              Transitions
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TRANSITION_OPTIONS.map((opt) => {
                const active = transitionSec === opt.sec;
                return (
                  <div
                    key={opt.sec}
                    onClick={() => void patchFeatures({ transitionSec: opt.sec })}
                    style={{
                      padding: '8px 12px',
                      borderRadius: JELLY_TOKENS.radius.md,
                      cursor: 'pointer',
                      fontSize: 12,
                      color: t.text,
                      border: active
                        ? `2px solid ${JELLY_TOKENS.brand}`
                        : `1px solid ${t.border}`,
                      background: active
                        ? JELLY_TOKENS.brandGhost
                        : 'transparent',
                    }}
                  >
                    {opt.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </VCard>

      {/* Characters — wraps style document picker + file upload */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>
          Characters
        </div>
        <YouTubeStyleDocumentPicker
          value={styleDocId}
          onChange={(id) => setStyleDocId(id)}
        />
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 12,
              color: t.textSecondary,
              marginBottom: 6,
            }}
          >
            Upload a new character reference image
          </div>
          <VaterFileUpload />
        </div>
      </VCard>

      {/* Primary CTA — stills draft. This is the cheap default: it plans the
          scenes and renders one still per beat, with no animation spend.
          Motion is a separate, priced button in the prompts view. */}
      <VBtn
        onClick={handleGeneratePrompts}
        disabled={generating}
        style={{ width: '100%', justifyContent: 'center', padding: '14px 24px' }}
        icon="sparkle"
      >
        {generating
          ? 'Rendering stills…'
          : scenes.length > 0
            ? `Re-render ${scenes.length} stills`
            : 'Render stills draft'}
      </VBtn>
      <div
        style={{
          fontSize: 12,
          color: t.textSecondary,
          textAlign: 'center',
          marginTop: 8,
        }}
      >
        Stills only — no animation spend
        {estimate.draftUsd !== null || estimate.loading
          ? ` (est. ${fmtUsd(estimate.draftUsd, estimate.loading)})`
          : ''}
        . Add motion afterwards from the prompts view.
      </div>

      {/* Cloud Rental */}
      <VCard style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: JELLY_TOKENS.radius.md,
              background: 'rgba(245,158,11,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 18 }}>⚡</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
              Cloud rental — FireRed + Modal
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.textSecondary,
                marginTop: 2,
                lineHeight: 1.5,
              }}
            >
              Bursts the paid pipeline to Modal serverless GPUs: FireRed stills
              on L40S (~$0.03/scene) plus Modal Wan2.2 i2v if animation is on.
              Frees up the DGX during long runs.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {CLOUD_OPTIONS.map((opt) => {
                const active = cloudRental === opt.key;
                return (
                  <div
                    key={opt.key}
                    onClick={() => setCloudRental(opt.key)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: JELLY_TOKENS.radius.md,
                      cursor: 'pointer',
                      border: active
                        ? `2px solid ${JELLY_TOKENS.brand}`
                        : `1px solid ${t.border}`,
                      background: active ? JELLY_TOKENS.brandGhost : 'transparent',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: t.textSecondary }}>
                      {opt.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </VCard>

      {/* Scene Consistency (IP-Adapter) */}
      <VCard style={{ marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
              Scene Consistency
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
              Use IP-Adapter to keep characters and style consistent across all
              scenes
            </div>
          </div>
          <div
            onClick={() => setConsistency((v) => !v)}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              cursor: 'pointer',
              padding: 2,
              background: consistency ? JELLY_TOKENS.brand : t.border,
              transition: 'background .2s',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transform: consistency ? 'translateX(18px)' : 'translateX(0)',
                transition: 'transform .2s',
              }}
            />
          </div>
        </div>
      </VCard>

      {/* Background Music — wraps existing music picker */}
      <VCard style={{ marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Icon name="music" size={16} color={t.textSecondary} />
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            BACKGROUND MUSIC
          </span>
          <span style={{ fontSize: 12, color: t.textSecondary }}>
            • CC-BY-4.0 Kevin MacLeod — optional
          </span>
        </div>
        <YouTubeMusicPicker
          value={musicId}
          volume={musicVolume}
          onChange={(id, vol) => {
            setMusicId(id);
            setMusicVolume(vol);
          }}
        />
      </VCard>

      {actionError && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            fontSize: 13,
            borderRadius: JELLY_TOKENS.radius.md,
            background: 'rgba(220,38,38,0.08)',
            color: JELLY_TOKENS.error,
          }}
        >
          {actionError}
        </div>
      )}
      {featureError && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            fontSize: 13,
            borderRadius: JELLY_TOKENS.radius.md,
            background: 'rgba(220,38,38,0.08)',
            color: JELLY_TOKENS.error,
          }}
        >
          {featureError}
        </div>
      )}
      <PromptReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        projectId={projectId ?? ''}
        scenes={scenes}
        onComplete={refresh}
      />
      <BillingBlockModal reason={billingBlock} onClose={() => setBillingBlock(null)} />
    </div>
  );
}

/* ─── Feature controls ────────────────────────────────────────────────────*/

/** Transitions offered in the UI. 0 = hard cuts, today's behavior. Anything
 *  above MAX_TRANSITION_SEC is clamped by the parser, so keep these in range. */
const TRANSITION_OPTIONS: ReadonlyArray<{ sec: number; label: string }> = [
  { sec: 0, label: 'Hard cuts' },
  { sec: 0.5, label: 'Crossfade 0.5s' },
  { sec: 1, label: 'Crossfade 1s' },
].filter((o) => o.sec <= MAX_TRANSITION_SEC);

interface FeatureToggleProps {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

/** Label + one-line hint + a switch, matching the switches already used on
 *  this screen (Scene Consistency, Cloud Rental). */
function FeatureToggle({
  label,
  hint,
  value,
  onChange,
}: FeatureToggleProps): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '8px 0',
        borderTop: `1px solid ${t.border}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary }}>{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          cursor: 'pointer',
          padding: 2,
          border: 'none',
          flexShrink: 0,
          background: value ? JELLY_TOKENS.brand : t.border,
          transition: 'background .2s',
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transform: value ? 'translateX(18px)' : 'translateX(0)',
            transition: 'transform .2s',
          }}
        />
      </button>
    </div>
  );
}

/** A 2-line mock of what the caption preset looks like over a frame. Not a
 *  render — just enough contrast/weight/placement to tell them apart. */
function CaptionSwatch({ preset }: { preset: CaptionPreset }): React.ReactElement {
  const base: React.CSSProperties = {
    height: 46,
    borderRadius: JELLY_TOKENS.radius.sm,
    background: 'linear-gradient(135deg, #3b3054 0%, #1f2937 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };
  const word: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
  };

  if (preset === 'none') {
    return (
      <div style={base}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
          no text
        </span>
      </div>
    );
  }
  if (preset === 'bold-yellow') {
    return (
      <div style={base}>
        <span
          style={{
            ...word,
            fontSize: 13,
            color: '#FDE047',
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          BIG IDEA
        </span>
      </div>
    );
  }
  if (preset === 'karaoke-pink') {
    return (
      <div style={base}>
        <span style={{ ...word, color: '#fff' }}>big </span>
        <span style={{ ...word, color: '#F26BB0' }}>IDEA</span>
      </div>
    );
  }
  if (preset === 'minimal-lower') {
    return (
      <div style={{ ...base, alignItems: 'flex-end', paddingBottom: 5 }}>
        <span style={{ ...word, fontSize: 9, fontWeight: 500, color: '#E5E7EB' }}>
          big idea
        </span>
      </div>
    );
  }
  if (preset === 'boxed') {
    return (
      <div style={base}>
        <span
          style={{
            ...word,
            color: '#111827',
            background: '#fff',
            padding: '3px 7px',
            borderRadius: 3,
          }}
        >
          BIG IDEA
        </span>
      </div>
    );
  }
  // "clean" — the default
  return (
    <div style={base}>
      <span
        style={{
          ...word,
          color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,0.85)',
        }}
      >
        Big idea
      </span>
    </div>
  );
}

/* ─── Billing modals ──────────────────────────────────────────────────────
 * Overlay/dialog styling follows PromptReviewModal. These live here (not a
 * shared component) because the only billing gate today is generation in
 * this step; promote to components/animate/ if another screen needs them.
 */

interface BatchAnimateConfirmModalProps {
  /** Pending request (null = closed). sceneIdxs null = animate all. */
  request: { sceneIdxs: number[] | null; count: number } | null;
  priceCents: number;
  qualityLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function BatchAnimateConfirmModal({
  request,
  priceCents,
  qualityLabel,
  onCancel,
  onConfirm,
}: BatchAnimateConfirmModalProps): React.ReactElement | null {
  const { t } = useTheme();
  if (!request) return null;
  const { count } = request;
  const totalCents = count * priceCents;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm batch animation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: JELLY_TOKENS.radius.lg,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
          Animate {count} scene{count === 1 ? '' : 's'}?
        </div>
        <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, lineHeight: 1.6 }}>
          {qualityLabel}
        </div>
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: JELLY_TOKENS.radius.md,
            background: t.cardAlt,
            border: `1px solid ${t.border}`,
            fontSize: 14,
            color: t.text,
            fontWeight: 600,
          }}
        >
          {count} clip{count === 1 ? '' : 's'} × {formatPrice(priceCents)} ={' '}
          {formatPrice(totalCents)}
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 8 }}>
          Charged to your card after each clip succeeds — failed clips are never
          charged.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <VBtn size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </VBtn>
          <VBtn size="sm" onClick={onConfirm} style={{ background: '#9C27B0' }}>
            Confirm — {formatPrice(totalCents)}
          </VBtn>
        </div>
      </div>
    </div>
  );
}
