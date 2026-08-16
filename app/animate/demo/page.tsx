/**
 * /animate/demo — the no-signup demo.
 *
 * The problem this solves: the /animate landing can describe the studio and
 * play a finished video, but the thing a prospect actually wants to know is
 * "what is it like to use". The old answer was "make an account and find out",
 * which is the wrong order — the account is the ask, the product is the offer.
 *
 * So this renders the REAL editor (components/animate/screens/editor/
 * ProjectShell) against a snapshot of a REAL finished project (library #23,
 * lib/vater/demo-data.ts), with every control switched off. No mock screens to
 * keep in sync, and nothing here can drift away from the product, because it
 * IS the product.
 *
 * ── SIGNED-OUT SAFETY ────────────────────────────────────────────────────
 * Three independent reasons a stranger cannot make this do anything:
 *   1. `demoProject` makes ProjectShell pass projectId={null} to every step,
 *      and each step already guards its fetches on that.
 *   2. The step area is a disabled <fieldset>, so the controls are inert.
 *   3. Every /api/vater route requires a session regardless. Even a crafted
 *      request from this page gets a 401.
 * proxy.ts needs no change: /animate is not in PAGE_GUARDS, so the whole
 * subtree is already public (that is how the landing works), and the
 * studio-only confinement list already allows the /animate prefix.
 *
 * Rendered inside CinemaRoot (which pins the dark ThemeProvider and paints the
 * cinema backdrop) + RouteContext, so the editor's useTheme() / useRoute()
 * calls resolve to real values rather than the module defaults — without
 * dragging in the full Shell, which is session-shaped (sidebar, tier fetch,
 * help drawer, impersonation banner). The page had its own light/dark toggle
 * state that nothing ever rendered a control for; CinemaRoot owns the theme
 * now, and a signed-out preview has no reason to be in light mode.
 */
'use client';

import * as React from 'react';

import { JELLY_TOKENS } from '@/components/animate/tokens';
import {
  RouteContext,
  type RouteContextValue,
} from '@/components/animate/theme-context';
import {
  CinemaRoot,
  FilmFrame,
  FILM_MEDIA_STYLE,
  MicroLabel,
} from '@/components/animate/cinema';
import { ProjectShell } from '@/components/animate/screens/editor/ProjectShell';
import type { EditorProject } from '@/components/animate/screens/editor/ProjectShell';
import { DEMO_PROJECT, DEMO_CTA_HREF } from '@/lib/vater/demo-data';

export default function AnimateDemoPage(): React.ReactElement {
  /* Land on Script (step 1), not Title. The script is the thing this product
   * is about — "paste a script, get a video" — and it is the most convincing
   * artifact on the page after the video itself. Step 0 is a title form, which
   * is an empty-looking first impression for a project that is already done. */
  const [editorStep, setEditorStep] = React.useState(1);

  /* A route context whose navigation is inert: there is nowhere to navigate
   * to from a signed-out page, and a setRoute that silently did nothing would
   * read as a broken link. Anything that would have left the editor sends the
   * visitor to the signup CTA instead. */
  const routeValue = React.useMemo<RouteContextValue>(() => {
    const toSignup = () => {
      window.location.href = DEMO_CTA_HREF;
    };
    return {
      route: 'editor',
      setRoute: toSignup,
      editorStep,
      setEditorStep,
      selectedProjectId: 'demo',
      setSelectedProjectId: () => {},
      selectedStyleId: null,
      setSelectedStyleId: () => {},
      openProjectInVideoEditor: toSignup,
      openProjectInEditor: toSignup,
      openStyleEditor: toSignup,
      newVideoRequest: 0,
      requestNewVideo: toSignup,
      consumeNewVideoRequest: () => {},
      openHelp: () => {},
    };
  }, [editorStep]);

  const t = JELLY_TOKENS.dark;

  return (
    /* CinemaRoot pins the dark theme and paints the backdrop; the `jc-demo`
     * class is load-bearing (app/globals.css keys the site footer padding on
     * it). No projector beam — this page's hero is the video, not a headline. */
    <CinemaRoot className="jc-demo" beam={false} density="sparse">
      <RouteContext.Provider value={routeValue}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 0' }}>
          <div style={{ marginBottom: 14 }}>
            <MicroLabel tone="cyan" style={{ marginBottom: 6 }}>
              Demo — no signup
            </MicroLabel>
            <div
              style={{
                fontSize: 13,
                color: t.textSecondary,
                lineHeight: 1.6,
                maxWidth: 620,
              }}
            >
              The real editor, loaded with a real finished film. Look around —
              nothing here can be changed or charged.
            </div>
          </div>

          {/* The finished video, first. Everything below is "how it was
              made"; this is "what you get". Served from the same public
              Blob bucket customers download their own finals from — no
              session, no proxy, nothing that needs an account. */}
          <FilmFrame glow radius={JELLY_TOKENS.radius.xl} style={{ marginBottom: 20 }}>
            {/* Spacer holds the 16:9 track open — the media itself is
                absolutely positioned (FILM_MEDIA_STYLE), so without this the
                1fr row collapses to zero. */}
            <div style={{ paddingTop: '56.25%' }} />
            <video
              controls
              playsInline
              preload="none"
              poster={DEMO_PROJECT.thumbnailUrl}
              src={DEMO_PROJECT.finalVideoUrl}
              style={{ ...FILM_MEDIA_STYLE, objectFit: 'contain', background: t.cardAlt }}
            />
          </FilmFrame>

          <ProjectShell
            projectId="demo"
            demoProject={DEMO_PROJECT as unknown as EditorProject}
          />
        </div>
      </RouteContext.Provider>
    </CinemaRoot>
  );
}
