'use client';

/* LearningCenterScreen — read-only guide to the studio.
 *
 * Rework (2026-08-20): this used to be a gamified 14-module clone that
 * advertised credit rewards it never paid out and locked modules behind
 * each other. Now it is an honest reading guide: ~13 short lessons that
 * teach the real product, every one readable immediately, with deep-links
 * into the actual screens. No rewards, no locks — the only state is a
 * "mark as read" checklist that persists to localStorage.
 *
 * All facts here are grounded in lib/vater/help-content.ts and the screens
 * themselves (PublishingScreen, Voices, VisualsStep, VideoEditorScreen).
 * If a price changes there, change it here too.
 *
 * Storage shape: { [lessonId]: { completed: true, ts: ISOString } }
 * Key: vater:learning:v1 (kept from the old screen so prior reads survive)
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard, SectionHeader } from '../../primitives';
import { MicroLabel } from '../../cinema';
import { ON_GRADIENT_PLATE } from '../tint';

const STORAGE_KEY = 'vater:learning:v1';

/** Deep-link out of a lesson. Resolved against useRoute() at render time. */
interface LessonLink {
  label: string;
  /** setRoute target — omitted when action is used instead. */
  route?: string;
  /** Shell-level actions that are not plain routes. */
  action?: 'help' | 'new-video';
}

interface LessonSpec {
  id: string;
  title: string;
  desc: string;
  paras: string[];
  bullets?: string[];
  link?: LessonLink;
}

const LESSONS: LessonSpec[] = [
  {
    id: 'what-it-is',
    title: 'What Jelly Animate is',
    desc: 'The five-step pipeline, start to finished MP4.',
    paras: [
      'Jelly Animate turns a script into a finished, publishable video. Every project moves through the same five steps: Script, Voice, Scenes, Motion, Publish.',
      'You stay in control at each step — you edit every word of the script, audition the voice, review every generated frame, and decide per scene whether motion is worth paying for. Nothing renders or spends without an explicit click from you.',
    ],
    bullets: [
      'Script — paste your own or generate one from a topic',
      'Voice — cloned and custom voices with word-level caption timing',
      'Scenes — every beat becomes a generated cinematic frame in your locked art style',
      'Motion — optional per-scene animation, priced before you click',
      'Publish — compose with captions and soundtrack, then publish or download the MP4',
    ],
    link: { label: 'Start a video', action: 'new-video' },
  },
  {
    id: 'billing',
    title: 'How billing works',
    desc: 'No subscription. Prepaid credit, compute at cost.',
    paras: [
      'There is no plan, no seat fee and no monthly minimum. You buy prepaid credit in $10, $25, $50 or $100 packs and spend it a render at a time. A $10 pack is $9.41 of credit — the difference is Stripe’s card fee, and we add nothing on top. Credit does not expire.',
      'Every render is billed the same way: GPU compute passed through at our cost, plus a flat $0.35 per finished minute. Most long-form still-image videos land between $1 and $7 all in.',
      'Putting a card on file charges nothing — Stripe places a $0 verification hold — and lands a $10 promotional starter credit on your balance. That starter credit covers the stills pipeline (scripts, voice, still scenes); animated motion runs on purchased credit only.',
      'Failed renders are never charged, and if a successful render overruns its estimate on repair passes, your bill is capped at the estimate.',
    ],
    link: { label: 'Open Billing & Pricing', route: 'pricing' },
  },
  {
    id: 'styles',
    title: 'Styles',
    desc: 'Lock a visual style so every scene matches.',
    paras: [
      'A style is the art direction for a project — the look every generated frame is held to. You lock it up front so scene 40 matches scene 1.',
      'Pick from the style library, or build a custom art style of your own and reuse it across projects.',
    ],
    link: { label: 'Browse styles', route: 'styles' },
  },
  {
    id: 'characters',
    title: 'Characters & consistency',
    desc: 'A cast that looks the same in every scene.',
    paras: [
      'Characters are defined once per project and injected into every scene that features them, so the same face and wardrobe carry through the whole video instead of mutating frame to frame.',
      'Manage your cast on the Characters screen — the scenes step pulls from it automatically.',
    ],
    link: { label: 'Open Characters', route: 'characters' },
  },
  {
    id: 'scripts',
    title: 'Scripts',
    desc: 'Paste your own or generate one — you edit every word.',
    paras: [
      'The script is the spine of the video: narration length is what determines runtime. Paste a script you already wrote, or generate one from a topic — either way the full text is editable before anything renders.',
      'Scripts can be generated in any major language. The beta caps a video at 9:00 and defaults to 5:00 — renders are proven clean up to just under nine minutes, and longer videos come once the fix-up budget scales with length.',
    ],
    link: { label: 'Start a video', action: 'new-video' },
  },
  {
    id: 'voices',
    title: 'Voices',
    desc: 'Clone your own, or bring your ElevenLabs account.',
    paras: [
      'The default lane is F5-TTS: clone your own voice by uploading samples — open to every tier, stored in your own namespace, with word-level caption timing shaped in the Voice Tuner.',
      'ElevenLabs is opt-in, bring-your-own-account: paste your ElevenLabs API key once and narration runs on your own plan — Jelly bills $0 for it. The key is validated, stored encrypted on the render box, and never sent back to the browser.',
      'Voiceovers support major languages via F5-TTS and ElevenLabs.',
    ],
    link: { label: 'Open Voices', route: 'voices' },
  },
  {
    id: 'stills-draft',
    title: 'The stills draft',
    desc: 'Why every video renders as still frames first.',
    paras: [
      'Scenes render as still frames first because stills are cheap and fast to judge. You see the whole video — framing, characters, style — before a single dollar goes to motion.',
      'A stills-only video is a finished product in its own right: most long-form still-image videos cost $1–$7 all in. Motion is a deliberate second step you add only where it earns its cost.',
    ],
  },
  {
    id: 'motion',
    title: 'Adding motion',
    desc: 'Optional, per scene, priced before you click.',
    paras: [
      'Motion is generated with Wan2.2, scene by scene. You choose which scenes to animate — a hook and a couple of key beats often carry a video — and each clip shows its price, set by the quality tier you pick, before you confirm.',
      'Animated motion costs meaningfully more per animated minute than stills, and it runs on purchased credit only — the $10 starter credit does not cover it.',
    ],
  },
  {
    id: 'reviewing',
    title: 'Reviewing scenes',
    desc: 'Regenerate, re-animate, set camera moves.',
    paras: [
      'Every scene is individually fixable. Rewrite its prompt and regenerate the image, re-animate a clip that came out wrong (each re-animate shows its price first), or set a camera move — there is a default camera move for the project plus a per-scene override.',
      'Review before you compose. A minute spent eyeballing the scene grid saves a paid re-render later.',
    ],
    link: { label: 'Open the Video Editor', route: 'video-editor' },
  },
  {
    id: 'render-receipt',
    title: 'Render & the receipt',
    desc: 'The itemized receipt, visible while it runs.',
    paras: [
      'When you render, the receipt itemizes everything — GPU time at our cost plus the $0.35 per finished minute — and you can see it while the render is still running, so there is never a number you find out about later. Our 8:44 benchmark render cost $5.56.',
      'Failed renders are never charged, partially or otherwise — retry from the Queue screen at no cost.',
    ],
    link: { label: 'Open the Queue', route: 'queue' },
  },
  {
    id: 'publishing',
    title: 'Publishing',
    desc: 'Your accounts, your click — or just take the MP4.',
    paras: [
      'You connect your own social accounts, and Jelly never posts without you pressing Publish. YouTube publishing is native from inside the studio.',
      'Each direct connection costs $6/month per connected account, billed to your Jelly credit — you are told before the OAuth flow, not after. Or skip connections entirely: the finished MP4 has no watermark and downloads free, so you can hand it to any scheduler you already run.',
    ],
    link: { label: 'Open Publishing', route: 'publishing' },
  },
  {
    id: 'video-editor',
    title: 'The Video Editor',
    desc: 'Fix a rendered video scene by scene.',
    paras: [
      'Every rendered video stays editable. Open a project in the Video Editor to rewrite a scene’s prompt, regenerate its image, or re-animate it — then re-compose a fresh MP4 to your Library.',
      'Edits save as you go, so you can always come back and pick up where you left off.',
    ],
    link: { label: 'Open the Video Editor', route: 'video-editor' },
  },
  {
    id: 'getting-help',
    title: 'Getting help',
    desc: 'The Help drawer, the feedback form, and a human.',
    paras: [
      'The Help drawer holds the pipeline walkthrough and the full FAQ — pricing, caps, languages, failed renders. The in-app feedback form is the fastest way to reach us; it files a ticket that gets seen the same day. Email works too: support@tolley.io.',
    ],
    link: { label: 'Open the Help drawer', action: 'help' },
  },
];

type ProgressMap = Record<string, { completed: true; ts: string }>;

function readProgress(): ProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgress(p: ProgressMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* localStorage full or disabled — ignore */
  }
}

export function LearningCenterScreen(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute, openHelp, requestNewVideo } = useRoute();
  const [progress, setProgress] = React.useState<ProgressMap>({});
  const [openId, setOpenId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setProgress(readProgress());
  }, []);

  const readCount = React.useMemo(
    () => LESSONS.filter((l) => progress[l.id]?.completed).length,
    [progress],
  );
  const pct = Math.round((readCount / LESSONS.length) * 100);

  const toggleRead = React.useCallback((id: string) => {
    setProgress((prev) => {
      const next = { ...prev };
      if (next[id]?.completed) {
        delete next[id];
      } else {
        next[id] = { completed: true, ts: new Date().toISOString() };
      }
      writeProgress(next);
      return next;
    });
  }, []);

  const followLink = React.useCallback(
    (link: LessonLink) => {
      if (link.action === 'help') {
        openHelp();
      } else if (link.action === 'new-video') {
        requestNewVideo();
      } else if (link.route) {
        setRoute(link.route);
      }
    },
    [openHelp, requestNewVideo, setRoute],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860 }}>
      <SectionHeader
        icon="learning"
        title="Learning Center"
        description="A plain guide to the studio. Read in any order — nothing is locked."
      />

      <VCard variant="hero" style={{ background: JELLY_TOKENS.gradTutorial, color: JELLY_TOKENS.onGradient }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Your reading checklist</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
              Check off lessons as you read them. Progress saves to this browser only.
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              {readCount} / {LESSONS.length} read
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{pct}%</div>
          </div>
        </div>
        <div
          style={{
            height: 6,
            background: ON_GRADIENT_PLATE,
            borderRadius: 3,
            marginTop: 12,
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: JELLY_TOKENS.onGradient,
              borderRadius: 3,
              transition: 'width .3s ease',
            }}
          />
        </div>
      </VCard>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {LESSONS.map((l, idx) => {
          const isRead = Boolean(progress[l.id]?.completed);
          const isOpen = openId === l.id;
          return (
            <VCard
              key={l.id}
              variant="flat"
              style={{
                border: isRead ? `1px solid ${JELLY_TOKENS.success}` : `1px solid ${t.border}`,
                padding: 0,
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : l.id)}
                aria-expanded={isOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  width: '100%',
                  padding: '16px 18px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                }}
              >
                <MicroLabel tone={isRead ? 'faint' : 'violet'} as="span" color={isRead ? t.textFaint : undefined}>
                  {String(idx + 1).padStart(2, '0')}
                </MicroLabel>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: t.text }}>{l.title}</div>
                  <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 2 }}>{l.desc}</div>
                </div>
                {isRead && (
                  <span style={{ fontSize: 11, color: JELLY_TOKENS.success, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    ✓ Read
                  </span>
                )}
                <span
                  aria-hidden
                  style={{
                    color: t.textSecondary,
                    fontSize: 12,
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform .2s ease',
                  }}
                >
                  ▼
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: '0 18px 18px 18px', borderTop: `1px solid ${t.border}` }}>
                  {l.paras.map((p, i) => (
                    <p key={i} style={{ fontSize: 13.5, lineHeight: 1.65, color: t.textSecondary, margin: '14px 0 0' }}>
                      {p}
                    </p>
                  ))}
                  {l.bullets && (
                    <ul style={{ margin: '12px 0 0', paddingLeft: 20 }}>
                      {l.bullets.map((b, i) => (
                        <li key={i} style={{ fontSize: 13.5, lineHeight: 1.7, color: t.textSecondary }}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
                    {l.link && (
                      <VBtn variant="outlined" size="sm" onClick={() => followLink(l.link!)}>
                        {l.link.label} →
                      </VBtn>
                    )}
                    <VBtn
                      variant="text"
                      size="sm"
                      onClick={() => toggleRead(l.id)}
                      style={isRead ? { color: JELLY_TOKENS.success } : undefined}
                    >
                      {isRead ? '✓ Read — mark unread' : 'Mark as read'}
                    </VBtn>
                  </div>
                </div>
              )}
            </VCard>
          );
        })}
      </div>
    </div>
  );
}
