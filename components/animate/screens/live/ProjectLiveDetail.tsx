'use client';

/* ProjectLiveDetail — what a project looks like once it is past the approval
 * gate: rendering, failed, ready to publish, or published.
 *
 * Moved out of ScriptReviewScreen 2026-08-23 (Trey). Script Review is intake
 * plus the approve-before-spend gate; it had grown a full detail column too,
 * while Project History rendered a SECOND, legacy detail view over the same
 * project (components/vater/youtube-creation-progress.tsx — the "old school
 * green lines"). Two views of one thing, and the worse one was the one you
 * reached by clicking a video in your own history.
 *
 * This is now the single detail panel. Project History renders it; Script
 * Review renders it for anything that is not awaiting approval.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard } from '../../primitives';
import { RenderProgress } from './RenderProgress';
import { PublishPanel } from '../review/PublishPanel';
import { stageOf, type ReviewProject } from '../review/ScriptReviewScreen';

export function ProjectLiveDetail({
  project,
  onChanged,
}: {
  project: ReviewProject;
  onChanged: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const stage = stageOf(project);

  if (stage === 'ready_to_publish' || stage === 'published') {
    return <PublishPanel project={project} onChanged={onChanged} />;
  }

  return (
    <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>
        {project.publishTitle || project.sourceTitle || 'Untitled'}
      </div>
      <div style={{ fontSize: 13, color: t.textSecondary }}>
        {stage === 'failed'
          ? 'This project failed — the error is above. The log below is what the worker did before it stopped.'
          : stage === 'rendering'
            ? 'Rendering the approved script.'
            : stage === 'awaiting_approval'
              ? 'Waiting for approval — open it in Script Review to read and approve the script.'
              : 'Getting this project ready.'}
      </div>

      {/* Rolling step log. Shown on failure too — the last lines before a stop
       * are the fastest way to see WHERE it died. */}
      <RenderProgress project={project} />

      {project.script && (
        <div
          style={{
            maxHeight: 220,
            overflowY: 'auto',
            fontSize: 12,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            color: t.textSecondary,
            background: t.cardAlt,
            borderRadius: JELLY_TOKENS.radius.md,
            padding: 12,
          }}
        >
          {project.script}
        </div>
      )}
    </VCard>
  );
}
