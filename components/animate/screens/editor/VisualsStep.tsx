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
import type { EditorStepProps } from './ProjectShell';

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

/** 402 budget.reason values from the generation routes' billing gate. */
type BillingBlockReason =
  | 'trial_cap_reached'
  | 'subscription_inactive'
  | 'payment_past_due'
  | 'monthly_limit_exceeded';

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
>;

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
      };
    })
    .filter((s): s is ParsedScene => s !== null);
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
  const [smartOverlays, setSmartOverlays] = React.useState(true);
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

  const handleGeneratePrompts = React.useCallback(async () => {
    if (!projectId) return;
    setGenerating(true);
    setActionError(null);
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
  }, [projectId, stylePreset, styleDocId, musicId, musicVolume, consistency, animQuality, cloudRental, refresh, describeGenerationError]);

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
  const requestAnimateAll = React.useCallback(() => {
    setConfirmAnimate({ sceneIdxs: null, count: scenes.length });
  }, [scenes.length]);

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
            <VBtn
              size="sm"
              onClick={requestAnimateAll}
              disabled={animating || scenes.length === 0}
              style={{ background: '#9C27B0' }}
            >
              {animating ? 'Animating…' : 'Animate All Images'}
            </VBtn>
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
            gridTemplateColumns: '1fr 1fr',
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

      {/* Smart Overlays toggle */}
      <VCard style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sparkle" size={16} color={t.textSecondary} />
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                Smart Overlays
              </span>
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
              Auto-detect chart / map / header beats and overlay them
            </div>
          </div>
          <div
            onClick={() => setSmartOverlays((v) => !v)}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              cursor: 'pointer',
              padding: 2,
              background: smartOverlays ? JELLY_TOKENS.brand : t.border,
              transition: 'background .2s',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transform: smartOverlays ? 'translateX(18px)' : 'translateX(0)',
                transition: 'transform .2s',
              }}
            />
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

      {/* Generate N Prompts */}
      <VBtn
        onClick={handleGeneratePrompts}
        disabled={generating}
        style={{ width: '100%', justifyContent: 'center', padding: '14px 24px' }}
        icon="sparkle"
      >
        {generating
          ? 'Generating…'
          : scenes.length > 0
            ? `Regenerate ${scenes.length} Prompts`
            : 'Generate Prompts'}
      </VBtn>

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

interface BillingBlockModalProps {
  reason: BillingBlockReason | null;
  onClose: () => void;
}

function BillingBlockModal({ reason, onClose }: BillingBlockModalProps): React.ReactElement | null {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset transient state whenever the modal (re)opens with a new reason.
  React.useEffect(() => {
    setWorking(false);
    setError(null);
  }, [reason]);

  const goStripe = React.useCallback(
    async (endpoint: '/api/vater/billing/setup' | '/api/vater/billing/portal') => {
      setWorking(true);
      setError(null);
      try {
        const res = await fetch(endpoint, { method: 'POST' });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        window.location.href = data.url;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Redirect failed');
        setWorking(false);
      }
    },
    [],
  );

  if (!reason) return null;

  const content: Record<
    BillingBlockReason,
    { title: string; body: string; cta: string; onCta: () => void }
  > = {
    trial_cap_reached: {
      title: 'Free tier used up',
      body: "You've hit the free-tier cap. Add a card to keep going — pay per clip, no subscription, nothing charged until you generate.",
      cta: 'Add a card',
      onCta: () => void goStripe('/api/vater/billing/setup'),
    },
    subscription_inactive: {
      title: 'Add a card to keep going',
      body: 'Generation needs a card on file. No subscription — you only pay the per-action price for what you make.',
      cta: 'Add a card',
      onCta: () => void goStripe('/api/vater/billing/setup'),
    },
    payment_past_due: {
      title: 'Payment failed — update your card',
      body: 'Your last invoice could not be charged, so rendering is paused. Update your card to resume — your projects are safe.',
      cta: 'Update card',
      onCta: () => void goStripe('/api/vater/billing/portal'),
    },
    monthly_limit_exceeded: {
      title: 'Monthly limit reached',
      body: 'This action would put you over your self-set monthly spending limit. Raise the limit on the Pricing screen to continue.',
      cta: 'Open Pricing',
      onCta: () => {
        onClose();
        setRoute('pricing');
      },
    },
  };
  const c = content[reason];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
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
        if (e.target === e.currentTarget && !working) onClose();
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
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{c.title}</div>
        <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, lineHeight: 1.6 }}>
          {c.body}
        </div>
        {error && (
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
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <VBtn size="sm" variant="ghost" onClick={onClose} disabled={working}>
            Not now
          </VBtn>
          <VBtn size="sm" onClick={c.onCta} disabled={working}>
            {working ? 'Redirecting…' : c.cta}
          </VBtn>
        </div>
      </div>
    </div>
  );
}
