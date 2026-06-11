'use client';

/* Feeds tab — wraps the existing YouTubeRssPanel (548 lines).
 * Add / probe / pause / remove RSS feeds. Auto-pipeline toggles. Items list.
 */

import * as React from 'react';
import { useTheme } from '../../theme-context';
import { SectionHeader } from '../../primitives';
import { YouTubeRssPanel } from '@/components/vater/youtube-rss-panel';

export function Feeds(): React.ReactElement {
  const { t: _t } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="web"
        title="RSS Feeds"
        description="Add a feed and Jelly polls it every 15 minutes. Toggle auto-pipeline per feed and new items kick off a project automatically."
      />
      <YouTubeRssPanel onProjectCreated={() => { /* no-op: parent route refreshes via polling */ }} />
    </div>
  );
}
