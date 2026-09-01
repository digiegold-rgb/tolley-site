'use client';

/**
 * Small Socials / dashboard thumbnail.
 *
 * Stills (thumbnailUrl / firstSceneImage) render as <img>. A finished mp4
 * with no still does NOT eager-mount a media element — LazyBlobVideo waits until
 * the tile is on screen and a concurrent blob slot is free. Offscreen
 * tiles are a placeholder. Does not generate blob thumbnails.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { LazyBlobVideo } from '../../media/LazyBlobVideo';
import { finalVideoPlaybackUrl } from '@/lib/vater/youtube-status';
import { getStylePreset } from '@/lib/vater/style-presets';
import { libraryCardPreviewKind } from '@/lib/vater/library-card-preview';
import { mayMountThumbVideo } from '@/lib/vater/lazy-blob-video';
import type { StudioVideo } from '@/lib/vater/socials/studio-library';

function dripLabel(stage: StudioVideo['dripStage']): string | null {
  if (stage === 'scheduled') return 'In drip';
  if (stage === 'publishing') return 'Posting';
  if (stage === 'queued') return 'Queued';
  if (stage === 'published') return 'Posted';
  return null;
}

export function StudioVideoThumb({
  video,
  winning,
  dense,
  onClick,
}: {
  video: StudioVideo;
  winning?: boolean;
  dense?: boolean;
  onClick?: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const preset = getStylePreset(video.stylePreset ?? 'cinematic');
  const previewKind = libraryCardPreviewKind({
    firstSceneImage: video.firstSceneImage,
    thumbnailUrl: video.thumbnailUrl,
    finalVideoUrl: video.finalVideoUrl,
    hasPresetSample: Boolean(preset?.sampleImageUrl),
  });
  const videoSrc = video.finalVideoUrl
    ? finalVideoPlaybackUrl({ id: video.id, finalVideoUrl: video.finalVideoUrl })
    : null;
  const drip = dripLabel(video.dripStage);
  const views = video.views;
  const hasStill = Boolean(video.firstSceneImage || video.thumbnailUrl);
  const mountVideo =
    Boolean(videoSrc) &&
    mayMountThumbVideo({
      previewKind,
      hasStill,
      selected: false,
      hover: false,
    });

  return (
    <button
      type="button"
      data-testid="studio-video-tile"
      data-preview={previewKind}
      data-winning={winning ? '1' : '0'}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        padding: 0,
        border: `1px solid ${winning ? JELLY_TOKENS.success : t.border}`,
        borderRadius: JELLY_TOKENS.radius.md,
        background: t.card,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        boxShadow: winning ? `0 0 22px rgba(52,201,138,0.28)` : undefined,
        fontFamily: JELLY_TOKENS.font,
        color: t.text,
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: dense ? '1 / 1' : '16 / 10',
          background: t.cardAlt,
          overflow: 'hidden',
        }}
      >
        {previewKind === 'scene' && video.firstSceneImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.firstSceneImage}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : previewKind === 'thumb' && video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : mountVideo && videoSrc ? (
          <LazyBlobVideo id={video.id} src={videoSrc} enabled preload="metadata" />
        ) : previewKind === 'preset' && preset?.sampleImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preset.sampleImageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              opacity: 0.45,
            }}
          >
            🎬
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(10,10,20,0.72), transparent 55%)',
          }}
        />
        {video.posted ? (
          <span
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              background: JELLY_TOKENS.success,
              color: JELLY_TOKENS.onGradient,
              borderRadius: JELLY_TOKENS.radius.xs,
              padding: '2px 6px',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            POSTED
          </span>
        ) : drip ? (
          <span
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              background: JELLY_TOKENS.cyan,
              color: JELLY_TOKENS.onGradient,
              borderRadius: JELLY_TOKENS.radius.xs,
              padding: '2px 6px',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            {drip.toUpperCase()}
          </span>
        ) : null}
        {views != null ? (
          <span
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              background: 'rgba(10,10,20,0.72)',
              color: winning ? JELLY_TOKENS.success : '#fff',
              borderRadius: JELLY_TOKENS.radius.xs,
              padding: '2px 6px',
              fontSize: 10,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {views.toLocaleString()} views
          </span>
        ) : null}
      </div>
      <div style={{ padding: dense ? '7px 8px 8px' : '9px 10px 10px' }}>
        <div
          title={video.title}
          style={{
            fontSize: dense ? 11.5 : 13,
            fontWeight: 700,
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {video.title}
        </div>
        <div style={{ fontSize: 10.5, color: t.textSecondary, marginTop: 3 }}>
          {video.posted
            ? 'Live on YouTube'
            : drip
              ? drip
              : video.stage === 'done'
                ? 'Ready — post this'
                : video.stage === 'in_progress'
                  ? 'In production'
                  : video.stage === 'queued'
                    ? 'Queued'
                    : 'In the library'}
          {video.houseMatch ? ` · ${video.houseMatch.channelLabel}` : null}
        </div>
      </div>
    </button>
  );
}
