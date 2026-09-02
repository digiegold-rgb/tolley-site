'use client';

/* Step 8 — Done. The video, a way into the Library, and "Make another". */

import * as React from 'react';
import { JELLY_TOKENS } from '../../../tokens';
import { useTheme, useRoute } from '../../../theme-context';
import { VBtn } from '../../../primitives';
import { FilmFrame, FILM_MEDIA_STYLE } from '../../../cinema';
import { finalVideoPlaybackUrl } from '@/lib/vater/youtube-status';
import { permanentStillUrl } from '@/lib/vater/permanent-still';
import { DriveSyncChip } from '../../../DriveSyncChip';
import { RenderTerminalToggle } from '../../../RenderTerminal';
import { useCreateFlow } from '../create-context';
import { StepCard, Lede, StepActions } from './step-ui';

export function DoneStep(): React.ReactElement {
  const { t } = useTheme();
  const { requestNewVideo } = useRoute();
  const { project, adopt } = useCreateFlow();

  if (!project) {
    return (
      <StepCard testId="done-empty">
        <div style={{ color: t.textSecondary, fontSize: 14 }}>Nothing finished yet.</div>
      </StepCard>
    );
  }

  const ready = project.status === 'ready';
  const src = project.finalVideoUrl ? finalVideoPlaybackUrl(project) : null;

  return (
    <StepCard variant="ticket" testId="done-step">
      <div style={{ fontSize: 20, fontWeight: 600, color: t.text, letterSpacing: '-0.01em' }}>
        {ready ? 'Your video is ready' : 'Almost there'}
      </div>
      <DriveSyncChip project={project} onSynced={adopt} style={{ alignSelf: 'flex-start' }} />
      <Lede>
        {ready
          ? 'It is in your Library — play it, cut shorts from it, publish it anywhere.'
          : 'The final MP4 is still being written. Refresh in a moment.'}
      </Lede>
      {src && (
        <FilmFrame radius={14} glow>
          <video
            controls
            playsInline
            preload="metadata"
            src={src}
            poster={permanentStillUrl('youtube', project.id) || project.thumbnailUrl || undefined}
            data-testid="done-video"
            style={{ ...FILM_MEDIA_STYLE, background: '#000' }}
          />
        </FilmFrame>
      )}
      <RenderTerminalToggle projectId={project.id} active={!ready} compact={false} initialLines={project.stepDetails?.logs} />
      <StepActions
        left={
          <a
            href={`#r=library&p=${encodeURIComponent(project.id)}`}
            data-testid="done-open-library"
            style={{ color: t.link, fontSize: 13.5, fontFamily: JELLY_TOKENS.font, textDecoration: 'underline' }}
          >
            Open in Library →
          </a>
        }
      >
        <VBtn variant="outlined" onClick={requestNewVideo} data-testid="done-make-another" icon="plus">
          Make another
        </VBtn>
      </StepActions>
    </StepCard>
  );
}
