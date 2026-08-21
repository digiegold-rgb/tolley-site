'use client';

/* ImageLightbox — click a character/take image, see it full screen
 * (2026-08-20, Jared: "I need to click on it and see it full screen").
 *
 * Plain overlay: image at natural fit, caption under it, click-outside or
 * Esc closes. Portalled to <body> per the studio modal doctrine.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { JELLY_TOKENS } from './tokens';

export interface ImageLightboxProps {
  /** null = closed. */
  src: string | null;
  alt?: string;
  caption?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, caption, onClose }: ImageLightboxProps): React.ReactElement | null {
  React.useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  if (!src || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        cursor: 'zoom-out',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ''}
        style={{
          maxWidth: '94vw',
          maxHeight: caption ? '82vh' : '90vh',
          objectFit: 'contain',
          borderRadius: JELLY_TOKENS.radius.md,
          boxShadow: JELLY_TOKENS.shadow24,
        }}
      />
      {caption && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 12,
            maxWidth: 720,
            maxHeight: '12vh',
            overflowY: 'auto',
            fontSize: 12.5,
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.85)',
            fontFamily: JELLY_TOKENS.font,
            textAlign: 'center',
            cursor: 'auto',
          }}
        >
          {caption}
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        style={{
          position: 'fixed',
          top: 16,
          right: 20,
          background: 'rgba(255,255,255,0.12)',
          border: 'none',
          borderRadius: '50%',
          width: 36,
          height: 36,
          color: '#fff',
          fontSize: 18,
          cursor: 'pointer',
          fontFamily: JELLY_TOKENS.font,
        }}
      >
        ✕
      </button>
    </div>,
    document.body,
  );
}
