'use client';

/* Shell — equivalent to the prototype `App` component in
 * /home/jelly/Shared/tubegen-ui-research/vater-design/tubegen/project/Jelly by Tolley.html
 * (lines 33-114).
 *
 * Owns dark-mode, route, editor-step, and sidebar-collapsed state.
 * Wraps everything in ThemeProvider + RouteContext.Provider and renders the
 * sidebar + main column (header + content + footer-via-screen) + HelpFAB +
 * ObserverSlot. The Tweaks Panel is intentionally excluded.
 *
 * Phase 1 only handles the 'dashboard' route. Every other route key falls
 * through to a centered "coming in Phase 2" placeholder.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import {
  ThemeProvider,
  RouteContext,
  type RouteContextValue,
} from './theme-context';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { HelpFAB } from './HelpFAB';
import { ObserverSlot } from './ObserverSlot';
import { BetaAccessBanner } from './BetaAccessBanner';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProjectShell } from './screens/editor/ProjectShell';
import { Library } from './screens/studio/Library';
import { Voices } from './screens/studio/Voices';
import { Feeds } from './screens/studio/Feeds';
import { Queue } from './screens/studio/Queue';
import { Recent } from './screens/studio/Recent';
import { AutopilotScreen } from './screens/live/AutopilotScreen';
import { PublishingScreen } from './screens/live/PublishingScreen';
import { AnimationScreen } from './screens/live/AnimationScreen';
import { AnalyticsScreen } from './screens/live/AnalyticsScreen';
import { DiscordScreen } from './screens/live/DiscordScreen';
import { ProjectHistoryScreen } from './screens/browse/ProjectHistoryScreen';
import { NicheFinderScreen } from './screens/browse/NicheFinderScreen';
import { VideoEditorScreen } from './screens/browse/VideoEditorScreen';
import { VideoEditorEmbed } from './screens/browse/VideoEditorEmbed';
import { StylesListEmbed } from './screens/browse/StylesListEmbed';
import { StyleEditEmbed } from './screens/browse/StyleEditEmbed';
import { CustomArtStylesEmbed } from './screens/browse/CustomArtStylesEmbed';
import { LearningCenterScreen } from './screens/browse/LearningCenterScreen';
import { PricingScreen } from './screens/browse/PricingScreen';

export function Shell(): React.ReactElement {
  const [dark, setDark] = React.useState(true);
  const [route, setRouteState] = React.useState('dashboard');
  const [editorStep, setEditorStep] = React.useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = React.useState<string | null>(null);
  // Bumps each time something outside the dashboard asks for a new video.
  // Dashboard watches this and pops the StylePickerModal.
  const [newVideoRequest, setNewVideoRequest] = React.useState(0);

  const requestNewVideo = React.useCallback(() => {
    setRouteState('dashboard');
    setNewVideoRequest((n) => n + 1);
  }, []);

  const consumeNewVideoRequest = React.useCallback(() => {
    setNewVideoRequest(0);
  }, []);

  const toggleDark = React.useCallback(() => {
    setDark((prev) => !prev);
  }, []);

  // Wrapping setRoute so leaving the editor / styles routes clears the
  // selected ID (otherwise switching to Dashboard while on a style would
  // leave a stale id floating around when the user comes back).
  const setRoute = React.useCallback((next: string) => {
    setRouteState((prev) => {
      if (prev === next) return prev;
      const wasEditor = prev === 'editor' || prev === 'video-editor';
      const goingEditor = next === 'editor' || next === 'video-editor';
      if (wasEditor && !goingEditor) setSelectedProjectId(null);

      const wasStyles = prev === 'styles-edit';
      const goingStyles = next === 'styles-edit';
      if (wasStyles && !goingStyles) setSelectedStyleId(null);

      return next;
    });
  }, []);

  const openProjectInVideoEditor = React.useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setRouteState('video-editor');
  }, []);

  const openProjectInEditor = React.useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setEditorStep(0);
    setRouteState('editor');
  }, []);

  const openStyleEditor = React.useCallback((styleId: string) => {
    setSelectedStyleId(styleId);
    setRouteState('styles-edit');
  }, []);

  /* Sync v2 state ↔ URL hash so the browser back/forward buttons walk
   * through internal navigation instead of escaping to /vater/youtube.
   *
   * Hash format: #r=<route>&s=<editorStep>&p=<projectId>&y=<styleId>
   * Empty hash = dashboard defaults. We use pushState so each navigation
   * gets its own history entry; popstate reverses the operation.
   *
   * `skipNextWrite` suppresses the write-back on the same render that an
   * apply-from-hash just ran, so popstate → setState → write-effect
   * doesn't double-push.
   */
  const skipNextWrite = React.useRef(true);
  React.useEffect(() => {
    const apply = (): void => {
      skipNextWrite.current = true;
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) {
        setRouteState('dashboard');
        setEditorStep(0);
        setSelectedProjectId(null);
        setSelectedStyleId(null);
        return;
      }
      const params = new URLSearchParams(hash);
      setRouteState(params.get('r') || 'dashboard');
      setEditorStep(Number.parseInt(params.get('s') || '0', 10) || 0);
      setSelectedProjectId(params.get('p') || null);
      setSelectedStyleId(params.get('y') || null);
    };
    apply();
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (route !== 'dashboard') params.set('r', route);
    if ((route === 'editor' || route === 'video-editor') && editorStep > 0) {
      params.set('s', String(editorStep));
    }
    if (selectedProjectId) params.set('p', selectedProjectId);
    if (selectedStyleId) params.set('y', selectedStyleId);
    const target = params.toString() ? `#${params.toString()}` : '';
    if (window.location.hash === target) return;
    const url = `${window.location.pathname}${window.location.search}${target}`;
    window.history.pushState({ v2: true }, '', url);
  }, [route, editorStep, selectedProjectId, selectedStyleId]);

  // Capture-phase click interceptor: anchors that target legacy
  // /vater/youtube/* routes get rerouted to in-v2 screens so users never
  // leave the v2 chrome. Modifier-clicks (cmd/ctrl/shift, middle-click)
  // pass through so "open in new tab" still works.
  React.useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (anchor.target && anchor.target !== '' && anchor.target !== '_self') return;

      // Style detail: /vater/youtube/styles/<id>
      const styleEdit = href.match(/^\/vater\/youtube\/styles\/([^/?#]+)(?:[/?#].*)?$/);
      if (styleEdit) {
        e.preventDefault();
        setSelectedStyleId(styleEdit[1]);
        setRouteState('styles-edit');
        return;
      }
      if (href === '/vater/youtube/styles' || href.startsWith('/vater/youtube/styles?')) {
        e.preventDefault();
        setRouteState('styles-list');
        return;
      }
      if (
        href === '/vater/youtube/custom-art-styles' ||
        href.startsWith('/vater/youtube/custom-art-styles?')
      ) {
        e.preventDefault();
        setRouteState('custom-art-styles');
        return;
      }
      // Project edit: /vater/youtube/<id>/edit
      const projectEdit = href.match(/^\/vater\/youtube\/([^/?#]+)\/edit(?:[/?#].*)?$/);
      if (projectEdit) {
        e.preventDefault();
        setSelectedProjectId(projectEdit[1]);
        setRouteState('video-editor');
        return;
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  const routeValue = React.useMemo<RouteContextValue>(
    () => ({
      route,
      setRoute,
      editorStep,
      setEditorStep,
      selectedProjectId,
      setSelectedProjectId,
      selectedStyleId,
      setSelectedStyleId,
      openProjectInVideoEditor,
      openProjectInEditor,
      openStyleEditor,
      newVideoRequest,
      requestNewVideo,
      consumeNewVideoRequest,
    }),
    [
      route,
      setRoute,
      editorStep,
      selectedProjectId,
      selectedStyleId,
      openProjectInVideoEditor,
      openProjectInEditor,
      openStyleEditor,
      newVideoRequest,
      requestNewVideo,
      consumeNewVideoRequest,
    ],
  );

  const t = dark ? JELLY_TOKENS.dark : JELLY_TOKENS.light;

  const screen = renderScreen(route, selectedProjectId, selectedStyleId);

  return (
    <ThemeProvider dark={dark} toggle={toggleDark}>
      <RouteContext.Provider value={routeValue}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            background: t.body,
            color: t.text,
            fontFamily: JELLY_TOKENS.font,
          }}
        >
          <BetaAccessBanner />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((prev) => !prev)}
          />
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            <Header />
            <main
              key={route}
              style={{
                flex: 1,
                padding: '24px 32px',
                maxWidth: 1200,
                width: '100%',
                margin: '0 auto',
              }}
            >
              {screen}
            </main>
          </div>
          </div>
        </div>
        <HelpFAB />
        <ObserverSlot />
      </RouteContext.Provider>
    </ThemeProvider>
  );
}

function renderScreen(
  route: string,
  selectedProjectId: string | null,
  selectedStyleId: string | null,
): React.ReactElement {
  switch (route) {
    case 'dashboard': return <DashboardScreen />;
    case 'editor':
      // ProjectShell requires a projectId. If we're missing one (e.g. user
      // landed via a stale URL hash) bail back to the dashboard rather than
      // render a half-broken shell. The Phase-1 StylePickerModal flow
      // always sets projectId before routing here.
      return selectedProjectId
        ? <ProjectShell projectId={selectedProjectId} />
        : <DashboardScreen />;
    // Legacy 'studio' tab is split into standalone sidebar routes. Keep
    // the key as a backwards-compat alias that lands on Library.
    case 'studio':
    case 'library':
      return <StudioPanelFrame title="Library" subtitle="Completed videos and ready-to-publish projects."><Library /></StudioPanelFrame>;
    case 'voices':
      return <StudioPanelFrame title="Voices" subtitle="F5-TTS clone management and ElevenLabs audition rail."><Voices /></StudioPanelFrame>;
    case 'feeds':
      return <StudioPanelFrame title="Feeds" subtitle="RSS feeds — auto-pipeline new items into projects."><Feeds /></StudioPanelFrame>;
    case 'queue':
      return <StudioPanelFrame title="Queue" subtitle="In-flight pipeline jobs — transcribing, scripting, animating."><Queue /></StudioPanelFrame>;
    case 'recent':
      return <StudioPanelFrame title="Recent" subtitle="Recently-completed and failed projects."><Recent /></StudioPanelFrame>;
    case 'autopilot': return <AutopilotScreen />;
    case 'publishing': return <PublishingScreen />;
    case 'animation': return <AnimationScreen />;
    case 'analytics': return <AnalyticsScreen />;
    case 'discord': return <DiscordScreen />;
    case 'niche-finder': return <NicheFinderScreen />;
    case 'styles': return <StylesListEmbed />;
    case 'styles-list': return <StylesListEmbed />;
    case 'styles-edit':
      return selectedStyleId
        ? <StyleEditEmbed styleId={selectedStyleId} />
        : <StylesListEmbed />;
    case 'custom-art-styles': return <CustomArtStylesEmbed />;
    case 'project-history': return <ProjectHistoryScreen />;
    case 'video-editor':
      // When a project is selected, render the timeline editor inline.
      // Otherwise render the gateway list of projects.
      return selectedProjectId
        ? <VideoEditorEmbed projectId={selectedProjectId} />
        : <VideoEditorScreen />;
    case 'learning-center': return <LearningCenterScreen />;
    case 'pricing': return <PricingScreen />;
    case 'course': return <ComingSoonScreen route="course (Discord redirect — wire later)" />;
    case 'affiliate': return <ComingSoonScreen route="affiliate" />;
    default: return <ComingSoonScreen route={route} />;
  }
}

/**
 * Thin frame for ex-StudioScreen tab panels that are now standalone sidebar
 * routes (Library / Voices / Feeds / Queue / Recent). Replicates the page
 * heading the old StudioScreen rendered above its tab strip so each panel
 * still gets a clear title and subtitle.
 */
function StudioPanelFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>{subtitle}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ComingSoonScreen({ route }: { route: string }): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
        textAlign: 'center',
        padding: 32,
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          Screen <code style={{ fontFamily: 'monospace' }}>{route}</code> — coming in Phase 2
        </div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          The v2 shell is wired; this screen will land in a follow-up phase.
        </div>
      </div>
    </div>
  );
}
