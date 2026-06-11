'use client';

/* AnimationScreen — Wan2.2 / Modal GPU job tracker.
 *
 * Lists in-flight animation jobs from /api/vater/autopilot/jobs (filtered to
 * animation kind), shows progress, and surfaces the calibrated 2026-04-25
 * cost model (FireRed $1.00 warmup + $0.005/scene; Wan2.2 $0.32/clip on L40S).
 *
 * Memory: feedback_vater_no_sdxl.md — animation quality whitelist must match
 * the route handler. We display the values as static labels here and don't
 * post any new tier from this screen (read-only tracker).
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, SectionHeader } from '../../primitives';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJob = any;

const COST_MODEL_2026_04_25 = [
  { label: 'FireRed (Modal H100, BF16)', cost: '$0.005/scene + $1.00 warmup' },
  { label: 'FireRed (DGX local)', cost: 'electricity only' },
  { label: 'Wan2.2 (Modal L40S)', cost: '$0.32/clip' },
  { label: 'Hunyuan / EasyAnimate / LTX', cost: 'varies' },
  { label: 'Veo (Google)', cost: 'API metered' },
  { label: 'Kling / Luma (fal.ai)', cost: 'API metered' },
];

export function AnimationScreen(): React.ReactElement {
  const { t } = useTheme();
  const [jobs, setJobs] = React.useState<AnyJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/vater/autopilot/jobs', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const all = Array.isArray(data?.jobs) ? data.jobs : Array.isArray(data) ? data : [];
      setJobs(all.filter((j: AnyJob) => /animat/i.test(String(j?.kind ?? j?.stage ?? ''))));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [refresh]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="image"
        title="AI Animation"
        description="Wan2.2 / Modal GPU job tracker. Polls every 5 seconds. Calibrated 2026-04-25."
      />

      <VCard variant="flat">
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 12 }}>Cost Model</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {COST_MODEL_2026_04_25.map((row) => (
            <div key={row.label} style={{
              padding: 12, borderRadius: JELLY_TOKENS.radius.sm,
              background: t.cardAlt, border: `1px solid ${t.border}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{row.label}</div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>{row.cost}</div>
            </div>
          ))}
        </div>
      </VCard>

      <VCard variant="flat">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Active Animation Jobs</div>
          <div style={{ fontSize: 12, color: t.textSecondary }}>{jobs.length} running</div>
        </div>
        {loading ? (
          <div style={{ color: t.textSecondary, fontSize: 13 }}>Loading…</div>
        ) : error ? (
          <div style={{ color: JELLY_TOKENS.error, fontSize: 13 }}>{error}</div>
        ) : jobs.length === 0 ? (
          <div style={{ color: t.textSecondary, fontSize: 13 }}>No animation jobs running. Start one from any project&apos;s Visuals step.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobs.map((j: AnyJob) => (
              <div key={j.id ?? j.jobId} style={{
                padding: 12, borderRadius: JELLY_TOKENS.radius.sm,
                background: t.cardAlt, border: `1px solid ${t.border}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                    {j.projectTitle ?? j.title ?? `Job ${j.id ?? j.jobId}`}
                  </span>
                  <span style={{ fontSize: 12, color: t.textSecondary }}>{j.status ?? j.state ?? '—'}</span>
                </div>
                {typeof j.progress === 'number' && (
                  <div style={{ height: 4, marginTop: 8, background: t.border, borderRadius: 2 }}>
                    <div style={{
                      width: `${Math.max(0, Math.min(100, j.progress))}%`, height: '100%',
                      background: JELLY_TOKENS.brand, borderRadius: 2,
                    }} />
                  </div>
                )}
                {j.eta && <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4 }}>ETA: {j.eta}</div>}
              </div>
            ))}
          </div>
        )}
      </VCard>
    </div>
  );
}
