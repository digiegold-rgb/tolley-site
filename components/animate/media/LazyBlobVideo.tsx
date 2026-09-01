'use client';

/**
 * IntersectionObserver + concurrent-cap blob <video> for Socials / Library tiles.
 * Offscreen tiles render a poster/placeholder — no media element, no blob hit.
 * Visible tiles take a slot (cap 6). Hover / selected bypass is decided by
 * the caller via `enabled`.
 */

import * as React from 'react';
import { blobVideoGate } from '@/lib/vater/lazy-blob-video';

function paintFirstFrame(el: HTMLVideoElement): void {
  if (el.paused && el.currentTime < 0.05) {
    try {
      el.currentTime = 0.05;
    } catch {
      /* not seekable yet */
    }
  }
}

function useInView<T extends Element>(rootMargin = '80px'): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { root: null, rootMargin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return [ref, inView];
}

export function LazyBlobVideo({
  id,
  src,
  enabled,
  priority = false,
  preload = 'metadata',
  className,
  style,
  loop,
  videoRef,
  onReady,
}: {
  id: string;
  src: string;
  enabled: boolean;
  /** Hover-play: mount even if the rest-state cap is full. */
  priority?: boolean;
  preload?: 'none' | 'metadata';
  className?: string;
  style?: React.CSSProperties;
  loop?: boolean;
  videoRef?: React.Ref<HTMLVideoElement | null>;
  onReady?: (el: HTMLVideoElement) => void;
}): React.ReactElement {
  const [boxRef, inView] = useInView<HTMLDivElement>();
  const [hasSlot, setHasSlot] = React.useState(false);
  const localRef = React.useRef<HTMLVideoElement | null>(null);

  const setVideoRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      localRef.current = el;
      if (typeof videoRef === 'function') videoRef(el);
      else if (videoRef) (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    },
    [videoRef],
  );

  const want = Boolean(enabled && inView && src);

  React.useEffect(() => {
    if (!want) {
      blobVideoGate.release(id);
      setHasSlot(false);
      return;
    }
    if (priority) {
      setHasSlot(true);
      return;
    }
    if (blobVideoGate.request(id)) {
      setHasSlot(true);
      return;
    }
    return blobVideoGate.enqueue(id, () => setHasSlot(true));
  }, [want, id, priority]);

  React.useEffect(() => {
    return () => {
      blobVideoGate.release(id);
    };
  }, [id]);

  const showVideo = want && hasSlot;

  return (
    <div
      ref={boxRef}
      data-testid="lazy-blob-video"
      data-video-id={id}
      data-in-view={inView ? '1' : '0'}
      data-mounted={showVideo ? '1' : '0'}
      style={{ width: '100%', height: '100%', ...style }}
    >
      {showVideo ? (
        <video
          ref={setVideoRef}
          src={src}
          muted
          playsInline
          loop={loop}
          preload={preload}
          className={className}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onLoadedMetadata={(e) => {
            paintFirstFrame(e.currentTarget);
            onReady?.(e.currentTarget);
          }}
          onLoadedData={(e) => {
            paintFirstFrame(e.currentTarget);
            onReady?.(e.currentTarget);
          }}
        />
      ) : (
        <div
          data-testid="lazy-blob-placeholder"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            opacity: 0.4,
          }}
        >
          🎬
        </div>
      )}
    </div>
  );
}

export { paintFirstFrame, useInView };
