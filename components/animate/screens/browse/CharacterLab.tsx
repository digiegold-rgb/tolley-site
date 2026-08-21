'use client';

/* CharacterLab — audition characters cheaply, without burning test renders
 * (2026-08-20).
 *
 * Generate: describe a character (or tap a preset), pick which Style it
 * belongs to, one priced click renders THREE portrait takes in that style's
 * art direction. Poll → pick the take you like → it's saved onto the Style
 * as the recurring character. 99¢/batch vs the $7 test-video auditions Trey
 * used to run.
 *
 * Import: bring a character from anywhere — upload an image, Gemini Vision
 * writes the identity descriptor, the same image anchors every scene render.
 * 49¢.
 *
 * Nothing here is free-running: every batch is a priced click, and the
 * confirm price is printed ON the button.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard } from '../../primitives';
import { MicroLabel } from '../../cinema';
import { Icon } from '../../Icon';
import { ImageLightbox } from '../../ImageLightbox';
import {
  BillingBlockModal,
  BillingBlockedError,
  assertOk,
  type BillingBlockReason,
} from '../editor/BillingBlock';

interface OwnStyle {
  id: string;
  name: string;
  isSystem: boolean;
}

interface Take {
  jobId: string;
  take: number;
  phase: string;
  status: 'running' | 'done' | 'failed';
  description?: string;
  imageUrl?: string;
  saved?: boolean;
}

const PRESETS: Array<{ label: string; name: string; brief: string }> = [
  {
    label: '💼 Finance mentor',
    name: 'The Money Mentor',
    brief: 'A trustworthy male finance mentor in his 50s — sharp navy suit, silver-gray hair, warm confident smile, reading glasses tucked in breast pocket.',
  },
  {
    label: '👵 Cozy storyteller',
    name: 'Grandma Rose',
    brief: 'A warm female grandmother storyteller in her 70s — silver bun, floral cardigan, kind wrinkled smile, cup of tea always nearby.',
  },
  {
    label: '⚡ Tech reviewer',
    name: 'Max Volt',
    brief: 'An energetic male tech reviewer in his late 20s — hoodie over a graphic tee, modern glasses, expressive eyebrows, fast-talking energy.',
  },
  {
    label: '🕵️ Noir detective',
    name: 'Detective Sloane',
    brief: 'A world-weary female noir detective in her 40s — trench coat, fedora shadowing sharp eyes, five o’clock city grit, holds a case file.',
  },
  {
    label: '🏋️ Fitness coach',
    name: 'Coach Dee',
    brief: 'An upbeat female fitness coach in her 30s — athletic build, high ponytail, bright track jacket, whistle on a lanyard, motivating grin.',
  },
  {
    label: '🔧 Blue-collar everyman',
    name: 'Hank',
    brief: 'A friendly male blue-collar everyman in his 40s — work boots, flannel shirt, tool belt, honest weathered face, baseball cap.',
  },
  {
    label: '🏡 Real estate pro',
    name: 'Alexis Grand',
    brief: 'A polished female luxury real estate agent in her 30s — tailored blazer, sleek bob, tablet in hand, confident welcoming posture.',
  },
  {
    label: '🧑‍🏫 Explainer teacher',
    name: 'Professor Pip',
    brief: 'A cheerful androgynous teacher character — bow tie, rolled sleeves, marker in hand at a whiteboard, bright curious eyes.',
  },
];

const POLL_MS = 4000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

export function CharacterLab({
  onCharacterSaved,
}: {
  /** Called after a take is adopted or an import lands, so the parent can refresh the library grid. */
  onCharacterSaved?: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const { openStyleEditor, setRoute } = useRoute();

  const [tab, setTab] = React.useState<'generate' | 'import'>('generate');
  const [styles, setStyles] = React.useState<OwnStyle[]>([]);
  const [styleId, setStyleId] = React.useState<string>('');
  const [name, setName] = React.useState('');
  const [brief, setBrief] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [billingBlock, setBillingBlock] = React.useState<BillingBlockReason | null>(null);
  const [takes, setTakes] = React.useState<Take[]>([]);
  const [adoptingJob, setAdoptingJob] = React.useState<string | null>(null);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importJob, setImportJob] = React.useState<Take | null>(null);
  const [lightbox, setLightbox] = React.useState<{ src: string; caption?: string } | null>(null);
  const pollStop = React.useRef(false);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/vater/youtube/styles', { cache: 'no-store' });
        const data = (await r.json().catch(() => ({}))) as { styles?: OwnStyle[] };
        const own = (data.styles ?? []).filter((s) => !s.isSystem);
        setStyles(own);
        if (own.length > 0) setStyleId((prev) => prev || own[0].id);
      } catch {
        /* selector just stays empty; the button is disabled without a style */
      }
    })();
    return () => {
      pollStop.current = true;
    };
  }, []);

  const pollJob = React.useCallback(
    async (jobId: string, apply: (patch: Partial<Take>) => void) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (!pollStop.current && Date.now() < deadline) {
        try {
          const r = await fetch(`/api/vater/autopilot/jobs/${jobId}`, { cache: 'no-store' });
          if (r.ok) {
            const job = (await r.json()) as {
              status?: string;
              phase?: string;
              error?: string;
              result?: { description?: string; imageUrl?: string };
            };
            if (job.status === 'done') {
              apply({
                status: 'done',
                phase: 'done',
                description: job.result?.description,
                imageUrl: job.result?.imageUrl,
              });
              return;
            }
            if (job.status === 'failed') {
              apply({ status: 'failed', phase: job.error || 'failed' });
              return;
            }
            apply({ phase: job.phase || 'working' });
          }
        } catch {
          /* transient poll error — keep going until the deadline */
        }
        await new Promise((res) => setTimeout(res, POLL_MS));
      }
      apply({ status: 'failed', phase: 'timed out — check the Styles screen later' });
    },
    [],
  );

  const generate = async () => {
    if (busy || !styleId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setTakes([]);
    // Reset the poll gate: StrictMode's dev double-mount runs the unmount
    // cleanup once, which would otherwise leave polling dead forever.
    pollStop.current = false;
    try {
      const r = await fetch(`/api/vater/youtube/styles/${styleId}/characters/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), brief: brief.trim() }),
      });
      await assertOk(r);
      const data = (await r.json()) as { jobs: Array<{ jobId: string; take: number }> };
      const initial: Take[] = data.jobs.map((j) => ({
        ...j,
        phase: 'starting',
        status: 'running' as const,
      }));
      setTakes(initial);
      for (const j of data.jobs) {
        void pollJob(j.jobId, (patch) =>
          setTakes((prev) => prev.map((tk) => (tk.jobId === j.jobId ? { ...tk, ...patch } : tk))),
        );
      }
    } catch (err) {
      if (err instanceof BillingBlockedError) setBillingBlock(err.reason);
      else setError(err instanceof Error ? err.message : 'Could not start generation');
    } finally {
      setBusy(false);
    }
  };

  const adopt = async (take: Take) => {
    if (!take.description || adoptingJob) return;
    setAdoptingJob(take.jobId);
    setError(null);
    try {
      const r = await fetch(`/api/vater/youtube/styles/${styleId}/characters/adopt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: take.description,
          imageUrl: take.imageUrl ?? null,
        }),
      });
      await assertOk(r);
      setTakes((prev) => prev.map((tk) => (tk.jobId === take.jobId ? { ...tk, saved: true } : tk)));
      setNotice(`Saved — "${name.trim()}" is now the character on that style.`);
      onCharacterSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the character');
    } finally {
      setAdoptingJob(null);
    }
  };

  const runImport = async () => {
    if (busy || !styleId || !importFile) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setImportJob(null);
    pollStop.current = false;
    try {
      const form = new FormData();
      form.append('file', importFile);
      const up = await fetch('/api/vater/upload', { method: 'POST', body: form });
      if (!up.ok) throw new Error(`Upload failed (${up.status})`);
      const { url } = (await up.json()) as { url: string };
      const r = await fetch(`/api/vater/youtube/styles/${styleId}/characters/from-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), imageUrl: url }),
      });
      await assertOk(r);
      const data = (await r.json()) as { jobId: string };
      const job: Take = { jobId: data.jobId, take: 1, phase: 'reading the image', status: 'running' };
      setImportJob(job);
      void pollJob(data.jobId, (patch) => {
        setImportJob((prev) => (prev ? { ...prev, ...patch } : prev));
        if (patch.status === 'done') {
          setNotice('Imported — descriptor written and character saved to the style.');
          onCharacterSaved?.();
        }
      });
    } catch (err) {
      if (err instanceof BillingBlockedError) setBillingBlock(err.reason);
      else setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '9px 12px',
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${t.borderStrong}`,
        background: t.cardAlt,
        color: t.text,
        fontSize: 13,
        fontFamily: JELLY_TOKENS.font,
        outline: 'none',
      }}
    />
  );

  const noStyles = styles.length === 0;
  const ready = !!styleId && name.trim().length > 0 && !busy;

  return (
    <VCard style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <MicroLabel tone="violet" size={10.5}>
          Character Lab
        </MicroLabel>
        <span style={{ fontSize: 13, color: t.textSecondary }}>
          Audition a character in stills — no test renders needed.
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['generate', 'import'] as const).map((k) => (
            <VBtn
              key={k}
              size="sm"
              variant={tab === k ? 'primary' : 'ghost'}
              onClick={() => setTab(k)}
            >
              {k === 'generate' ? 'Generate' : 'Import'}
            </VBtn>
          ))}
        </div>
      </div>

      {noStyles ? (
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
          Characters live on a Style (it carries the voice and art direction).
          Create or clone a Style first —{' '}
          <button
            type="button"
            onClick={() => setRoute('styles-list')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: JELLY_TOKENS.brand,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            open Styles
          </button>
          .
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label style={{ fontSize: 12, color: t.textSecondary, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Style (owns the character)
              <select
                value={styleId}
                onChange={(e) => setStyleId(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: JELLY_TOKENS.radius.md,
                  border: `1px solid ${t.borderStrong}`,
                  background: t.cardAlt,
                  color: t.text,
                  fontSize: 13,
                  fontFamily: JELLY_TOKENS.font,
                }}
              >
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12, color: t.textSecondary, display: 'flex', flexDirection: 'column', gap: 4 }}>
              Character name
              {input({
                value: name,
                onChange: (e) => setName((e.target as HTMLInputElement).value),
                placeholder: 'e.g. The Money Mentor',
                maxLength: 80,
              })}
            </label>
          </div>

          {tab === 'generate' ? (
            <>
              <label style={{ fontSize: 12, color: t.textSecondary, display: 'flex', flexDirection: 'column', gap: 4 }}>
                Describe the character
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Who are they? Age, vibe, outfit, defining details — the style's art direction is applied automatically."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: `1px solid ${t.borderStrong}`,
                    background: t.cardAlt,
                    color: t.text,
                    fontSize: 13,
                    fontFamily: JELLY_TOKENS.font,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setName(p.name);
                      setBrief(p.brief);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: JELLY_TOKENS.radius.pill,
                      border: `1px solid ${t.border}`,
                      background: t.cardAlt,
                      color: t.textSecondary,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: JELLY_TOKENS.font,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <VBtn
                  variant="primary"
                  size="sm"
                  icon="sparkle"
                  disabled={!ready || brief.trim().length < 8}
                  onClick={() => void generate()}
                  data-testid="character-lab-generate"
                >
                  {busy ? 'Starting…' : 'Generate 3 takes · $0.68'}
                </VBtn>
                <span style={{ fontSize: 11.5, color: t.textFaint }}>
                  Billed per batch. You pick the take you like; the others cost nothing extra.
                </span>
              </div>
            </>
          ) : (
            <>
              <label style={{ fontSize: 12, color: t.textSecondary, display: 'flex', flexDirection: 'column', gap: 4 }}>
                Character image (from any platform — PNG/JPG, max 10MB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  style={{ fontSize: 12, color: t.textSecondary, fontFamily: JELLY_TOKENS.font }}
                />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <VBtn
                  variant="primary"
                  size="sm"
                  icon="upload"
                  disabled={!ready || !importFile}
                  onClick={() => void runImport()}
                  data-testid="character-lab-import"
                >
                  {busy ? 'Uploading…' : 'Import character · $0.49'}
                </VBtn>
                <span style={{ fontSize: 11.5, color: t.textFaint }}>
                  We write the identity descriptor from the image; the same face anchors every scene.
                </span>
              </div>
              {importJob && (
                <div style={{ fontSize: 13, color: importJob.status === 'failed' ? JELLY_TOKENS.error : t.textSecondary }}>
                  {importJob.status === 'running' && `Please stand by — ${importJob.phase}…`}
                  {importJob.status === 'done' && 'Done ✓ — character saved to the style.'}
                  {importJob.status === 'failed' && `Import failed: ${importJob.phase}`}
                </div>
              )}
            </>
          )}
        </>
      )}

      {error && (
        <div role="alert" style={{ fontSize: 13, color: JELLY_TOKENS.error }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ fontSize: 13, color: JELLY_TOKENS.success }}>{notice}</div>
      )}

      {takes.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {takes.map((tk) => (
            <div
              key={tk.jobId}
              style={{
                border: `1px solid ${tk.saved ? JELLY_TOKENS.success : t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
                overflow: 'hidden',
                background: t.cardAlt,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  aspectRatio: '1 / 1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: t.card,
                }}
              >
                {tk.status === 'done' && tk.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    /* DGX-relative /vater/file/... → the site's authed proxy;
                       the raw autopilot URL 401s in browsers. */
                    src={tk.imageUrl.includes('://') ? tk.imageUrl : `/api${tk.imageUrl}`}
                    alt={`Take ${tk.take} — click to view full screen`}
                    title="Click to view full screen"
                    onClick={() =>
                      setLightbox({
                        src: tk.imageUrl!.includes('://') ? tk.imageUrl! : `/api${tk.imageUrl}`,
                        caption: tk.description,
                      })
                    }
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                  />
                ) : tk.status === 'failed' ? (
                  <span style={{ fontSize: 12, color: JELLY_TOKENS.error, padding: 10, textAlign: 'center' }}>
                    Take {tk.take} failed — {tk.phase}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: t.textSecondary, padding: 10, textAlign: 'center' }}>
                    <Icon name="sparkle" size={18} color={JELLY_TOKENS.brand} />
                    <br />
                    Please stand by — take {tk.take}: {tk.phase}…
                  </span>
                )}
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tk.description && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: t.textSecondary,
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }}
                  >
                    {tk.description}
                  </div>
                )}
                <VBtn
                  size="sm"
                  variant={tk.saved ? 'ghost' : 'outlined'}
                  disabled={tk.status !== 'done' || !!tk.saved || !!adoptingJob}
                  onClick={() => void adopt(tk)}
                >
                  {tk.saved
                    ? 'Saved ✓'
                    : adoptingJob === tk.jobId
                      ? 'Saving…'
                      : 'Use this character'}
                </VBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {takes.length > 0 && takes.every((tk) => tk.status !== 'running') && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <VBtn size="sm" variant="ghost" icon="sparkle" onClick={() => void generate()}>
            Not quite? Generate 3 more · $0.68
          </VBtn>
          {styleId && (
            <VBtn size="sm" variant="ghost" onClick={() => openStyleEditor(styleId)}>
              Open the style
            </VBtn>
          )}
        </div>
      )}

      <ImageLightbox
        src={lightbox?.src ?? null}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
      <BillingBlockModal reason={billingBlock} onClose={() => setBillingBlock(null)} />
    </VCard>
  );
}
