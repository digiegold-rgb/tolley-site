'use client';

import dynamic from 'next/dynamic';

/* three.js only ships to the client, after hydration, and only where the
 * backdrop actually mounts. */
export const SpaceFieldLazy = dynamic(() => import('./SpaceField'), { ssr: false });
