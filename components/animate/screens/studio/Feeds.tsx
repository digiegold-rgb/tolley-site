'use client';

/* Feeds tab — wraps the existing YouTubeRssPanel.
 * Every user gets their own feeds (multi-tenant since 2026-08-17). Add a
 * feed → Jelly polls it every 15 minutes → new items land here → one click
 * turns an item into a project. Auto-pipeline (render with no click) is
 * owner-only because it is unattended spend.
 */

import * as React from 'react';
import { SectionHeader } from '../../primitives';
import { useTier } from '../../tier-context';
import { YouTubeRssPanel } from '@/components/vater/youtube-rss-panel';

export function Feeds(): React.ReactElement {
  const { tier } = useTier();
  const owner = tier === 'owner';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="web"
        title="RSS Feeds"
        description={
          owner
            ? 'Add a feed and Jelly polls it every 15 minutes. Toggle auto-pipeline per feed and new items kick off a project automatically.'
            : 'Follow a YouTube channel, podcast, or blog feed. Jelly checks it every 15 minutes and lists every new episode or post here — hit "Create video" on any item to turn it into a project.'
        }
      />
      <div className="jelly-legacy">
        <YouTubeRssPanel
          allowAutoPipeline={owner}
          onProjectCreated={() => { /* no-op: parent route refreshes via polling */ }}
        />
      </div>
    </div>
  );
}
