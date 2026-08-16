'use client';

import * as React from 'react';
import { ThemeProvider } from '../theme-context';
import { JELLY_TOKENS } from '../tokens';
import { CinemaBackdrop, type CinemaBackdropProps } from './CinemaBackdrop';

/* <CinemaRoot/> — wraps a PUBLIC surface (landing, legal, demo) that has no
 * Shell: pins the dark cinema theme, paints the backdrop, and provides the
 * z-index:1 content layer. Server components can render this and pass server
 * children straight through. */

export interface CinemaRootProps extends CinemaBackdropProps {
  children: React.ReactNode;
  /** Root class — MUST stay `.jsl` on the landing and `.jc-legal` / `.jc-demo`
   *  elsewhere: app/globals.css:53 keys the site footer padding on them. */
  className: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

const noop = () => {};

export function CinemaRoot({ children, className, style, beam, density, 'data-testid': testId }: CinemaRootProps): React.ReactElement {
  const t = JELLY_TOKENS.dark;
  return (
    <ThemeProvider dark toggle={noop}>
      <div
        className={`jelly-cinema ${className}`}
        data-testid={testId}
        style={{
          position: 'relative',
          minHeight: '100vh',
          background: t.body,
          color: t.text,
          fontFamily: JELLY_TOKENS.font,
          overflowX: 'clip',
          ['--jelly-text' as string]: t.text,
          ['--jelly-text-2' as string]: t.textSecondary,
          ['--jelly-link' as string]: t.link,
          ...style,
        }}
      >
        <CinemaBackdrop beam={beam} density={density} forceDark />
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </div>
    </ThemeProvider>
  );
}
