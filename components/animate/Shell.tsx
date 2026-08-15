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
 * Routes the caller's tier can't reach render <NotAvailableScreen /> rather
 * than a screen that 401s on every fetch.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import {
  ThemeProvider,
  RouteContext,
  type RouteContextValue,
} from './theme-context';
import { TierProvider, useTier } from './tier-context';
import { Toast, VBtn } from './primitives';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { HelpFAB } from './HelpFAB';
import { HelpDrawer } from './HelpDrawer';
import { ObserverSlot } from './ObserverSlot';
import { BetaAccessBanner } from './BetaAccessBanner';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProjectShell } from './screens/editor/ProjectShell';
import { ScriptReviewScreen } from './screens/review/ScriptReviewScreen';
import { CourseScreen } from './screens/course/CourseScreen';
import { Library } from './screens/studio/Library';
import { DirectScreen } from './screens/studio/DirectScreen';
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
import { RulesScreen } from './screens/browse/RulesScreen';
import { PricingScreen } from './screens/browse/PricingScreen';
import { canSeeRoute } from '@/lib/vater/nav-visibility';

export function Shell(): React.ReactElement {
  return (
    <TierProvider>
      <ShellInner />
    </TierProvider>
  );
}

function ShellInner(): React.ReactElement {
  const [dark, setDark] = React.useState(true);
  const [route, setRouteState] = React.useState('dashboard');
  const [editorStep, setEditorStep] = React.useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  // AN-02: the 260px sidebar forced every screen into horizontal scroll on a
  // 390px viewport. Below 768px the sidebar becomes an off-canvas drawer;
  // between 768 and 1024 it starts collapsed to icons.
  const [isMobile, setIsMobile] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)');
    const narrow = window.matchMedia('(max-width: 1024px)');
    const sync = (): void => {
      setIsMobile(mobile.matches);
      if (mobile.matches) setDrawerOpen(false);
      else setSidebarCollapsed(narrow.matches);
    };
    sync();
    mobile.addEventListener('change', sync);
    narrow.addEventListener('change', sync);
    return () => {
      mobile.removeEventListener('change', sync);
      narrow.removeEventListener('change', sync);
    };
  }, []);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = React.useState<string | null>(null);
  // Bumps each time something outside the dashboard asks for a new video.
  // Dashboard watches this and pops the StylePickerModal.
  const [newVideoRequest, setNewVideoRequest] = React.useState(0);
  const [toast, setToast] = React.useState<
    { message: string; kind: 'success' | 'error' | 'info' } | null
  >(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const { tier, loading: tierLoading } = useTier();

  const requestNewVideo = React.useCallback(() => {
    setRouteState('dashboard');
    setNewVideoRequest((n) => n + 1);
  }, []);

  const consumeNewVideoRequest = React.useCallback(() => {
    setNewVideoRequest(0);
  }, []);

  // Any navigation closes the mobile drawer — otherwise it covers the screen
  // the user just asked for.
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [route]);

  const openHelp = React.useCallback(() => {
    setHelpOpen(true);
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

      /* Stripe's card-on-file redirect comes back with QUERY params, not a
       * hash (?card_added=1 / ?card_cancelled=1). Before this, apply() read
       * only the hash, so the user landed silently on the Dashboard with no
       * confirmation that their card was saved. Consume the params, flash a
       * toast, route to Billing, then strip them from the URL. */
      const search = new URLSearchParams(window.location.search);
      const added = search.get('card_added');
      const cancelled = search.get('card_cancelled');
      const legacyScreen = search.get('screen');
      if (added || cancelled || legacyScreen) {
        if (added) {
          setToast({
            message: 'Card saved. You can render without trial caps now.',
            kind: 'success',
          });
          // PricingScreen mounts after the query string is stripped, so hand
          // the confirmation over via sessionStorage — it reads and clears it.
          try {
            window.sessionStorage.setItem('vater-card-added', '1');
          } catch {
            /* private mode — the toast still fires */
          }
        } else if (cancelled) {
          setToast({ message: 'Card setup cancelled — nothing was charged.', kind: 'info' });
        }
        search.delete('card_added');
        search.delete('card_cancelled');
        search.delete('session_id');
        search.delete('screen');
        const rest = search.toString();
        const hashPart = window.location.hash;
        window.history.replaceState(
          { v2: true },
          '',
          `${window.location.pathname}${rest ? `?${rest}` : ''}${hashPart}`,
        );
        setRouteState('pricing');
        setEditorStep(0);
        setSelectedProjectId(null);
        setSelectedStyleId(null);
        return;
      }

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
    // hashchange too: a plain `#r=…` link (or the user editing the hash in
    // the address bar) fires hashchange but NOT popstate, so those
    // navigations used to leave the shell on the old screen.
    window.addEventListener('hashchange', apply);
    return () => {
      window.removeEventListener('popstate', apply);
      window.removeEventListener('hashchange', apply);
    };
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
      openHelp,
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
      openHelp,
    ],
  );

  const t = dark ? JELLY_TOKENS.dark : JELLY_TOKENS.light;

  const effectiveTier = tierLoading ? 'public' : tier;
  const screen = canSeeRoute(effectiveTier, route)
    ? renderScreen(route, selectedProjectId, selectedStyleId)
    : <NotAvailableScreen onHome={() => setRoute('dashboard')} />;

  return (
    <ThemeProvider dark={dark} toggle={toggleDark}>
      <RouteContext.Provider value={routeValue}>
        <div
          className="animate-shell"
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            width: '100%',
            maxWidth: '100%',
            overflowX: 'hidden',
            background: t.body,
            color: t.text,
            fontFamily: JELLY_TOKENS.font,
          }}
        >
          <BetaAccessBanner />
          <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((prev) => !prev)}
              mobile={isMobile}
              drawerOpen={drawerOpen}
              onCloseDrawer={() => setDrawerOpen(false)}
            />
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
            >
              <Header
                mobile={isMobile}
                onOpenNav={() => setDrawerOpen(true)}
              />
              <main
                key={route}
                style={{
                  flex: 1,
                  // minWidth:0 keeps a wide child (scene grid, queue row) from
                  // forcing the whole page into horizontal scroll.
                  minWidth: 0,
                  padding: isMobile ? '16px 16px 32px' : '24px 32px',
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
        <HelpFAB onClick={openHelp} />
        <HelpDrawer
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          onGoBilling={() => {
            setHelpOpen(false);
            setRoute('pricing');
          }}
        />
        {toast && (
          <Toast
            message={toast.message}
            kind={toast.kind}
            onDismiss={() => setToast(null)}
          />
        )}
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
    case 'script-review': return <ScriptReviewScreen />;
    case 'direct': return <DirectScreen />;
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
    case 'course': return <CourseScreen />;
    case 'rules': return <RulesScreen />;
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
          Not built yet
        </div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          <code style={{ fontFamily: 'monospace' }}>{route}</code> isn&apos;t part of the
          studio yet. Everything you need to make and publish a video already is.
        </div>
      </div>
    </div>
  );
}

/**
 * Shown when the URL hash points at a route above the caller's tier — e.g.
 * a public customer pasting `#r=autopilot`. Better than rendering a screen
 * whose every fetch 401s.
 */
function NotAvailableScreen({ onHome }: { onHome: () => void }): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          This area is part of the studio tier
        </div>
        <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 20, lineHeight: 1.6 }}>
          Your account doesn&apos;t have access to this screen. Everything you need to
          write, render and publish a video is on your dashboard.
        </div>
        <VBtn onClick={onHome}>Back to Dashboard</VBtn>
      </div>
    </div>
  );
}
