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
 *
 * Cinema pass (2026-08-16): the shell is a stage. <CinemaBackdrop/> paints the
 * fixed nebula + space-dust ground at z0; the sidebar/main column ride above it
 * in a transparent z1 layer. The light/dark choice persists in localStorage
 * under `jelly.theme` so a customer who picked light doesn't get flash-banged
 * on every reload.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import {
  ThemeProvider,
  RouteContext,
  useTheme,
  type RouteContextValue,
} from './theme-context';
import { TierProvider, useTier } from './tier-context';
import { VBtn } from './primitives';
import { ToastHost, ToastViewport, useToast } from './ToastHost';
import { ProgressBadgeProvider } from './ProgressBadgeProvider';
import { CinemaBackdrop, GlassCard, MicroLabel } from './cinema';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { HelpFAB } from './HelpFAB';
import { HelpDrawer, type HelpFocus } from './HelpDrawer';
import { ObserverSlot } from './ObserverSlot';
import { BetaAccessBanner } from './BetaAccessBanner';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProjectShell } from './screens/editor/ProjectShell';
import { ScriptReviewScreen } from './screens/review/ScriptReviewScreen';
import { CourseScreen } from './screens/course/CourseScreen';
import { Library } from './screens/studio/Library';
import { ShortsLibrary } from './screens/studio/ShortsLibrary';
import { DirectScreen } from './screens/studio/DirectScreen';
import { Voices } from './screens/studio/Voices';
import { Feeds } from './screens/studio/Feeds';
import { Progress } from './screens/studio/Progress';
import { CreateScreen } from './screens/create/CreateScreen';
import { Recent } from './screens/studio/Recent';
import { SystemLog } from './screens/studio/SystemLog';
import { ApiKeys } from './screens/studio/ApiKeys';
import { Team } from './screens/studio/Team';
import { ViewAsBanner } from './ViewAsBanner';
import { WorkspaceTabs } from './WorkspaceTabs';
import { BetaGate } from './BetaGate';
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
import { CharactersScreen } from './screens/browse/CharactersScreen';
import { StyleEditEmbed } from './screens/browse/StyleEditEmbed';
import { CustomArtStylesEmbed } from './screens/browse/CustomArtStylesEmbed';
import { LearningCenterScreen } from './screens/browse/LearningCenterScreen';
import { RulesScreen } from './screens/browse/RulesScreen';
import { PricingScreen } from './screens/browse/PricingScreen';
import { canSeeRoute, NAV_ROUTES } from '@/lib/vater/nav-visibility';
import { useProduct } from './product-context';
import type { Brand } from './brands';
import type { Product } from '@/lib/vater/product';
import ListingWizard from './screens/listing/ListingWizard';
import ListingLibrary from './screens/listing/ListingLibrary';

/** Where the light/dark choice lives between visits. */
const THEME_KEY = 'jelly.theme';

/** Section id → the first half of a screen eyebrow ("STUDIO — LIBRARY"),
 *  per front door (Listing Studio says so on every screen). */
const SECTION_EYEBROW: Record<Product, Record<'primary' | 'secondary', string>> = {
  jelly: { primary: 'STUDIO', secondary: 'ACCOUNT' },
  realestate: { primary: 'LISTING STUDIO', secondary: 'ACCOUNT' },
};

/** "STUDIO — LIBRARY" from the route's own NAV_ROUTES entry. */
function eyebrowFor(routeId: string, fallbackLabel: string, product: Product = 'jelly'): string {
  const def = NAV_ROUTES.find((r) => r.id === routeId);
  const section = SECTION_EYEBROW[product][def?.section ?? 'primary'];
  return `${section} — ${(def?.label ?? fallbackLabel).toUpperCase()}`;
}

export interface ShellProps {
  /** Route the shell opens on when the URL carries no `#r=`. Defaults to the
   *  brand's `defaultRoute` (dashboard on /animate, listing on
   *  /realestateanimated). */
  initialRoute?: string;
}

export function Shell({ initialRoute }: ShellProps = {}): React.ReactElement {
  return (
    <TierProvider>
      {/* Toasts + the progress poll sit ABOVE the shell so any screen (and the
          poller itself) can raise a toast; the viewport renders inside the
          theme below. */}
      <ToastHost>
        <ProgressBadgeProvider>
          <ShellInner initialRoute={initialRoute} />
        </ProgressBadgeProvider>
      </ToastHost>
    </TierProvider>
  );
}

/**
 * Mirror the brand's `--jb-*` variables onto <html> while a non-Jelly shell
 * is mounted. The product layout sets them on its wrapper, which covers the
 * shell tree — but ten modals portal to document.body (RenderConfirmModal,
 * StylePickerModal, ImageLightbox…) and would fall back to violet. Cleared
 * on unmount so a client-side hop to /animate is never tinted.
 */
function useBrandVarsOnRoot(brand: Brand, dark: boolean): void {
  React.useEffect(() => {
    if (brand.product === 'jelly' || typeof document === 'undefined') return;
    const root = document.documentElement;
    const vars: Record<string, string> = { ...brand.cssVars, ...(dark ? {} : brand.cssVarsLight ?? {}) };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
      root.removeAttribute('data-theme');
    };
  }, [brand, dark]);
}

function ShellInner({ initialRoute }: ShellProps): React.ReactElement {
  const brand = useProduct();
  /** Route an empty hash means — the brand's home screen. */
  const home = initialRoute ?? brand.defaultRoute;
  // Dark is the default and the SSR value — reading localStorage during render
  // would desync hydration, so the stored preference is applied on mount.
  const [dark, setDark] = React.useState(true);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === 'light') setDark(false);
      else if (stored === 'dark') setDark(true);
    } catch {
      /* private mode — dark stays the default */
    }
  }, []);
  const [route, setRouteState] = React.useState(home);
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
  // Legacy counter — the stepped Create flow (2026-08-28) routes to `create`
  // instead of popping a modal, so nothing bumps this any more. Kept on the
  // context so older consumers keep compiling.
  const [newVideoRequest, setNewVideoRequest] = React.useState(0);
  const { toast: pushToast } = useToast();
  const [helpOpen, setHelpOpen] = React.useState(false);
  // Which Help section the drawer should scroll to on open. The FAB and the
  // dashboard tutorial card want the top; the header version pill wants the
  // release notes.
  const [helpFocus, setHelpFocus] = React.useState<HelpFocus>(null);
  const { tier, loading: tierLoading } = useTier();

  /** "+ Create Video" from anywhere: the stepped flow, fresh (no project). */
  const requestNewVideo = React.useCallback(() => {
    setSelectedProjectId(null);
    setEditorStep(0);
    setRouteState('create');
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
    setHelpFocus(null);
    setHelpOpen(true);
  }, []);

  const openWhatsNew = React.useCallback(() => {
    setHelpFocus('whats-new');
    setHelpOpen(true);
  }, []);

  const toggleDark = React.useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      } catch {
        /* private mode — the choice just doesn't survive the reload */
      }
      return next;
    });
  }, []);

  // Wrapping setRoute so leaving the editor / styles routes clears the
  // selected ID (otherwise switching to Dashboard while on a style would
  // leave a stale id floating around when the user comes back).
  const setRoute = React.useCallback((next: string) => {
    setRouteState((prev) => {
      if (prev === next) return prev;
      const wasEditor = prev === 'editor' || prev === 'video-editor' || prev === 'create';
      const goingEditor = next === 'editor' || next === 'video-editor' || next === 'create';
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

  /** `step` lands the editor somewhere other than Title (0). Used when the
   *  caller already knows what the user came to do — e.g. "Jelly writes the
   *  script" should open ON the Script step, not on a blank title field that
   *  reads as "nothing happened" (Trey 2026-08-27). ProjectShell's
   *  auto-advance only fires when a step flips to done, so seeding the step
   *  here is not fought by it. */
  const openProjectInEditor = React.useCallback((projectId: string, step = 0) => {
    setSelectedProjectId(projectId);
    setEditorStep(step);
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

      /* Google Drive OAuth return (2026-08-28): the callback lands on
       * `/animate?drive=connected#<hash>` or `?drive=error&reason=…#<hash>`.
       * Toast, strip the query, and fall through so the hash (usually
       * `#r=create&p=…&s=5`) still applies and the DriveLinkCard refetches. */
      const drive = search.get('drive');
      if (drive) {
        if (drive === 'connected') {
          pushToast('Google Drive linked', { kind: 'success' });
        } else {
          const reason = search.get('reason') || 'unknown';
          const why =
            reason === 'denied'
              ? 'access was declined'
              : reason === 'api_not_enabled'
                ? 'Drive API not enabled — the owner has been notified'
                : reason === 'revoked'
                  ? 'Google revoked the link'
                  : reason;
          pushToast(`Google Drive link failed: ${why}`, { kind: 'error', duration: 9000 });
        }
        search.delete('drive');
        search.delete('reason');
        const rest = search.toString();
        window.history.replaceState(
          { v2: true },
          '',
          `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`,
        );
      }

      const added = search.get('card_added');
      const cancelled = search.get('card_cancelled');
      const legacyScreen = search.get('screen');
      if (added || cancelled || legacyScreen) {
        if (added) {
          pushToast('Card saved. You can render without trial caps now.', { kind: 'success' });
          // PricingScreen mounts after the query string is stripped, so hand
          // the confirmation over via sessionStorage — it reads and clears it.
          try {
            window.sessionStorage.setItem('vater-card-added', '1');
          } catch {
            /* private mode — the toast still fires */
          }
        } else if (cancelled) {
          pushToast('Card setup cancelled — nothing was charged.', { kind: 'info' });
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
        setRouteState(home);
        setEditorStep(0);
        setSelectedProjectId(null);
        setSelectedStyleId(null);
        return;
      }
      const params = new URLSearchParams(hash);
      // 'queue' was renamed to 'progress' (2026-08-28); old links, saved
      // sidebar orders and bookmarks still say queue — normalise here so the
      // nav item highlights and the hash writer emits the new id.
      const rawRoute = params.get('r') || home;
      setRouteState(rawRoute === 'queue' ? 'progress' : rawRoute);
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
    // `home` is fixed for the life of the shell (brand + initialRoute prop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (route !== home) params.set('r', route);
    // `s` = editor step, or the Create flow's step (1–8) so Back walks steps.
    if ((route === 'editor' || route === 'video-editor' || route === 'create') && editorStep > 0) {
      params.set('s', String(editorStep));
    }
    if (selectedProjectId) params.set('p', selectedProjectId);
    if (selectedStyleId) params.set('y', selectedStyleId);
    const target = params.toString() ? `#${params.toString()}` : '';
    if (window.location.hash === target) return;
    const url = `${window.location.pathname}${window.location.search}${target}`;
    window.history.pushState({ v2: true }, '', url);
  }, [route, editorStep, selectedProjectId, selectedStyleId, home]);

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
      // Catch-all: ANY other legacy /vater page link stays in the studio.
      // Found 2026-08-20: EditorShell's "← Channel" (/vater/youtube) fell
      // through the specific matches above and hard-navigated users into the
      // old Vater chrome. /api/vater/* (downloads, streams) is not touched.
      if (href === '/vater' || (href.startsWith('/vater/') && !href.startsWith('/vater/api'))) {
        e.preventDefault();
        const projectsHome = /^\/vater\/youtube(?:[/?#].*)?$/.test(href);
        setRouteState(projectsHome ? 'project-history' : 'dashboard');
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
  useBrandVarsOnRoot(brand, dark);

  const effectiveTier = tierLoading ? 'public' : tier;
  const screen = canSeeRoute(effectiveTier, route, brand.product)
    ? renderScreen(route, selectedProjectId, selectedStyleId)
    : <NotAvailableScreen onHome={() => setRoute(home)} />;

  return (
    <ThemeProvider dark={dark} toggle={toggleDark}>
      {/* The stage: fixed, click-through, z0. The shell below is transparent
          and rides above it, so `t.body` is painted exactly once. */}
      <CinemaBackdrop density="sparse" />
      <RouteContext.Provider value={routeValue}>
        <div
          className="animate-shell jelly-cinema"
          data-theme={dark ? 'dark' : 'light'}
          data-product={brand.product}
          style={
            {
              /* Brand palette: the product layout sets the dark `--jb-*` set;
               * the shell re-asserts it here and layers the light overrides
               * on top when the customer flips the theme. Jelly sets nothing
               * (tokens.ts fallbacks are the Jelly palette). */
              ...brand.cssVars,
              ...(dark ? {} : brand.cssVarsLight ?? {}),
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100vh',
              width: '100%',
              maxWidth: '100%',
              overflowX: 'hidden',
              /* Positioned so the shell paints after the fixed z0 backdrop —
               * but deliberately WITHOUT a z-index. A z-index here would make
               * the shell a stacking context and trap every overlay inside it
               * at that one level: BetaGate (9999) would fall behind the Help
               * FAB (80) and the drawer (250), and the FAB would float over
               * the open mobile nav (210). `position: relative` + z-index auto
               * lifts the content above the backdrop and leaves every existing
               * overlay relationship exactly as it was. */
              position: 'relative',
              background: 'transparent',
              color: t.text,
              fontFamily: JELLY_TOKENS.font,
              /* Legacy skin hooks: .jelly-legacy / .jc-link read these, so the
                 Tailwind-era components inside the studio follow the theme. */
              '--jelly-text': t.text,
              '--jelly-text-2': t.textSecondary,
              '--jelly-link': t.link,
              '--jelly-card': t.card,
              '--jelly-border': t.border,
            } as React.CSSProperties
          }
        >
          {/* Above everything, including the beta banner: an admin must never
              be one scroll away from forgetting whose account they are in. */}
          <BetaGate />
          <ViewAsBanner />
          <BetaAccessBanner />
          {/* Studio TABS — above the logo, full width. One login, many fully
              separate studios (lib/vater/workspaces.ts). Renders nothing until
              the workspace table exists. */}
          <WorkspaceTabs />
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
                onOpenWhatsNew={openWhatsNew}
              />
              <main
                key={route}
                className="jc-fadein"
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
          focus={helpFocus}
          route={route}
          projectId={selectedProjectId}
          onClose={() => setHelpOpen(false)}
          onGoBilling={() => {
            setHelpOpen(false);
            setRoute('pricing');
          }}
        />
        <ToastViewport />
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
    // Stepped Create flow (2026-08-28) — components/animate/screens/create/*
    case 'create': return <CreateScreen />;
    // Listing Studio (/realestateanimated) — components/animate/screens/listing/*
    case 'listing': return <ListingWizard jobId={selectedProjectId} />;
    case 'listing-library': return <ListingLibrary />;
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
      return <StudioPanelFrame routeId="library" title="Library" subtitle="Queued → in progress → done. Play the ones that have landed."><Library /></StudioPanelFrame>;
    case 'shorts-library':
      return <StudioPanelFrame routeId="shorts-library" title="Shorts Library" subtitle="Chop any finished video into short-form segments and post them anywhere."><ShortsLibrary /></StudioPanelFrame>;
    case 'voices':
      return <StudioPanelFrame routeId="voices" title="Voices" subtitle="F5-TTS clone management and ElevenLabs audition rail."><Voices /></StudioPanelFrame>;
    case 'feeds':
      return <StudioPanelFrame routeId="feeds" title="Feeds" subtitle="RSS feeds — auto-pipeline new items into projects."><Feeds /></StudioPanelFrame>;
    // `queue` is the pre-2026-08-28 name — old links and saved nav layouts.
    case 'queue':
    case 'progress':
      return <StudioPanelFrame routeId="progress" title="Progress" subtitle="Every video, step by step — what needs you, what is being made, what landed."><Progress /></StudioPanelFrame>;
    case 'recent':
      return <StudioPanelFrame routeId="recent" title="Recent" subtitle="Recently-completed and failed projects."><Recent /></StudioPanelFrame>;
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
    case 'characters': return <CharactersScreen />;
    case 'project-history': return <ProjectHistoryScreen />;
    case 'video-editor':
      // When a project is selected, render the timeline editor inline.
      // Otherwise render the gateway list of projects.
      return selectedProjectId
        ? <VideoEditorEmbed projectId={selectedProjectId} />
        : <VideoEditorScreen />;
    case 'system-log': return <SystemLog />;
    case 'learning-center': return <LearningCenterScreen />;
    case 'pricing': return <PricingScreen />;
    case 'course': return <CourseScreen />;
    case 'rules': return <RulesScreen />;
    case 'affiliate': return <ComingSoonScreen route="affiliate" />;
    case 'api-keys':
      return <StudioPanelFrame routeId="api-keys" title="API Keys" subtitle="Drive Jelly from your own code or an agent — create a key, set a webhook."><ApiKeys /></StudioPanelFrame>;
    case 'team':
      return <StudioPanelFrame routeId="team" title="Team" subtitle="Share your videos with teammates. Seats share visibility, not credits."><Team /></StudioPanelFrame>;
    default: return <ComingSoonScreen route={route} />;
  }
}

/**
 * Thin frame for ex-StudioScreen tab panels that are now standalone sidebar
 * routes (Library / Voices / Feeds / Queue / Recent). Replicates the page
 * heading the old StudioScreen rendered above its tab strip so each panel
 * still gets a clear title and subtitle.
 *
 * Cinema pattern: cyan micro-label eyebrow ("STUDIO — LIBRARY", derived from
 * the route's own NAV_ROUTES section) over a Space Grotesk H2 and a secondary
 * subtitle. Same heading rhythm as every section on the landing page.
 */
function StudioPanelFrame({
  routeId,
  title,
  subtitle,
  children,
}: {
  routeId: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}): React.ReactElement {
  const { t } = useTheme();
  const brand = useProduct();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100, width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MicroLabel tone="cyan">{eyebrowFor(routeId, title, brand.product)}</MicroLabel>
        <h2
          style={{
            margin: 0,
            fontFamily: JELLY_TOKENS.font,
            fontWeight: 600,
            fontSize: 'clamp(28px, 3vw, 34px)',
            letterSpacing: '-0.02em',
            color: t.text,
            lineHeight: 1.15,
          }}
        >
          {title}
        </h2>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: t.textSecondary, maxWidth: 640 }}>
          {subtitle}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ComingSoonScreen({ route }: { route: string }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
        padding: 32,
      }}
    >
      <GlassCard variant="glass" padding={32} shadow style={{ maxWidth: 460, textAlign: 'center' }}>
        <MicroLabel tone="faint" style={{ marginBottom: 10 }}>— NOT IN THE PROGRAMME —</MicroLabel>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8, color: t.text }}>
          Not built yet
        </div>
        <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>
          <code style={{ fontFamily: JELLY_TOKENS.fontMono, color: JELLY_TOKENS.cyan }}>{route}</code>{' '}
          isn&apos;t part of the studio yet. Everything you need to make and publish a
          video already is.
        </div>
      </GlassCard>
    </div>
  );
}

/**
 * Shown when the URL hash points at a route above the caller's tier — e.g.
 * a public customer pasting `#r=autopilot`. Better than rendering a screen
 * whose every fetch 401s.
 */
function NotAvailableScreen({ onHome }: { onHome: () => void }): React.ReactElement {
  const { t } = useTheme();
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
      <GlassCard variant="glass" padding={32} shadow halo style={{ maxWidth: 440, textAlign: 'center' }}>
        <MicroLabel tone="violet" style={{ marginBottom: 10 }}>— PRIVATE SCREENING —</MicroLabel>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginBottom: 8,
            color: t.text,
          }}
        >
          This area is part of the studio tier
        </div>
        <div style={{ fontSize: 14, color: t.textSecondary, marginBottom: 22, lineHeight: 1.6 }}>
          Your account doesn&apos;t have access to this screen. Everything you need to
          write, render and publish a video is on your dashboard.
        </div>
        <VBtn onClick={onHome}>Back to Dashboard</VBtn>
      </GlassCard>
    </div>
  );
}
