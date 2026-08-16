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
 * Rendered inside ThemeProvider + RouteContext so the editor's useTheme() /
 * useRoute() calls resolve to real values rather than the module defaults —
 * without dragging in the full Shell, which is session-shaped (sidebar, tier
 * fetch, help drawer, impersonation banner).
 */
'use client';

import * as React from 'react';

import { JELLY_TOKENS } from '@/components/animate/tokens';
import {
  ThemeProvider,
  RouteContext,
  type RouteContextValue,
} from '@/components/animate/theme-context';
import { ProjectShell } from '@/components/animate/screens/editor/ProjectShell';
import type { EditorProject } from '@/components/animate/screens/editor/ProjectShell';
import { DEMO_PROJECT, DEMO_CTA_HREF } from '@/lib/vater/demo-data';

export default function AnimateDemoPage(): React.ReactElement {
  const [dark, setDark] = React.useState(true);
  /* Land on Script (step 1), not Title. The script is the thing this product
   * is about — "paste a script, get a video" — and it is the most convincing
   * artifact on the page after the video itself. Step 0 is a title form, which
   * is an empty-looking first impression for a project that is already done. */
  const [editorStep, setEditorStep] = React.useState(1);

  const toggle = React.useCallback(() => setDark((d) => !d), []);

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

  const t = dark ? JELLY_TOKENS.dark : JELLY_TOKENS.light;

  return (
    <ThemeProvider dark={dark} toggle={toggle}>
      <RouteContext.Provider value={routeValue}>
        <div
          style={{
            minHeight: '100vh',
            background: t.body,
            color: t.text,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 0' }}>
            {/* The finished video, first. Everything below is "how it was
                made"; this is "what you get". Served from the same public
                Blob bucket customers download their own finals from — no
                session, no proxy, nothing that needs an account. */}
            <video
              controls
              playsInline
              preload="none"
              poster={DEMO_PROJECT.thumbnailUrl}
              src={DEMO_PROJECT.finalVideoUrl}
              style={{
                width: '100%',
                borderRadius: JELLY_TOKENS.radius.lg,
                border: `1px solid ${t.border}`,
                background: '#000',
                display: 'block',
                marginBottom: 20,
              }}
            />
            <ProjectShell
              projectId="demo"
              demoProject={DEMO_PROJECT as unknown as EditorProject}
            />
          </div>
        </div>
      </RouteContext.Provider>
    </ThemeProvider>
  );
}
