'use client';

/* ProjectDetail — Phase 2 parallel build.
 *
 * Composed of 7 status-branched subviews per the inventory mapping
 * (Section 2.6 + Section 7). Wraps the existing
 * `YouTubeProjectDetail` component so the canonical status routing
 * (draft / fetching / transcribed / in-flight / ready / failed) and
 * its child components (YouTubeContextForm, YouTubeCreationProgress,
 * YouTubeFinalPlayer) carry their entire behavior over.
 *
 * Promotes the **Verification report fabrications panel** (NEEDS NEW TAB)
 * to a first-class section beside the YouTubeFinalPlayer, instead of
 * the collapsible buried at the bottom of the player. The user
 * explicitly asked for this elevation.
 *
 * Risks honored:
 *  - autopilotJobId rotation on re-compose: parent (`ProjectHistoryScreen`)
 *    is responsible for refreshing project state and uses `cache: "no-store"`
 *    when re-fetching. We surface `onRecomposeStart` so it can flip status
 *    optimistically.
 *  - scenesJson per-idx merge: not handled here — handled by the poll route
 *    on the server. We never mutate scenesJson client-side from this view.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard } from '../../primitives';
import { YouTubeProjectDetail } from '@/components/vater/youtube-project-detail';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

interface Props {
  project: AnyProject;
  onUpdate: (project: AnyProject) => void;
  onRecomposeStart?: (id: string) => void;
}

interface VerificationReport {
  ok?: boolean;
  fabrications?: string[];
  summary?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coverage?: any[];
}

export function ProjectDetail({
  project,
  onUpdate,
  onRecomposeStart,
}: Props): React.ReactElement {
  const { t } = useTheme();
  const verification = project?.verificationReport as VerificationReport | null;
  const fabs = Array.isArray(verification?.fabrications)
    ? (verification?.fabrications as string[])
    : [];
  const showFabPanel = project?.status === 'ready' && (fabs.length > 0 || verification?.ok === false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showFabPanel && (
        <VCard
          style={{
            borderColor: JELLY_TOKENS.warning,
            background: 'rgba(245,158,11,0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 20 }}>⚠</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              Verification report — fabrications detected
            </span>
          </div>
          {verification?.summary && (
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 8 }}>
              {verification.summary}
            </div>
          )}
          {fabs.length > 0 && (
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 13,
                color: t.text,
                lineHeight: 1.6,
              }}
            >
              {fabs.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          {fabs.length === 0 && verification?.ok === false && (
            <div style={{ fontSize: 13, color: t.text }}>
              The verifier flagged this script. Review the script before publishing.
            </div>
          )}
        </VCard>
      )}

      {/* The canonical 7-status routing lives inside the wrapped
          YouTubeProjectDetail. We don't re-implement its branching. */}
      <YouTubeProjectDetail
        project={project}
        onUpdate={onUpdate}
        onRecomposeStart={onRecomposeStart}
      />
    </div>
  );
}
