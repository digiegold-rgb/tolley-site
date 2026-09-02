'use client';

/**
 * Global Animate card still. The src is a stable /api/vater/.../still
 * (or /api/vater/file/... for characters). Browser + CDN cache it.
 * No spinner, no <video>, no blob: URL, no YouTube img host.
 */

import * as React from 'react';

export function PermanentStill({
  src,
  alt = '',
  className,
  style,
  testId = 'permanent-still',
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  testId?: string;
}): React.ReactElement {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const cover: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    ...style,
  };

  if (!src || failed) {
    return (
      <div
        data-testid={`${testId}-placeholder`}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          opacity: 0.4,
          ...style,
        }}
      >
        🎬
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      data-testid={testId}
      decoding="async"
      style={cover}
      onError={() => setFailed(true)}
    />
  );
}
