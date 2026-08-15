'use client';

/* Sidebar — nav order and icons ported from vater-core.jsx lines 202-280.
 *
 * The item list is NOT static any more: it comes from
 * lib/vater/nav-visibility.ts filtered by the caller's tier (from
 * /api/vater/me). A public customer must never be shown RSS Feeds,
 * Autopilot or the Discord bot — those 401 for them.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme, useRoute } from './theme-context';
import { useTier } from './tier-context';
import { Icon, type IconName } from './Icon';
import { VBtn } from './primitives';
import { visibleRoutes, type NavRouteDef } from '@/lib/vater/nav-visibility';

const SHOW_STUBS = process.env.NEXT_PUBLIC_VATER_BETA_STUBS === '1';

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Below 768px the sidebar leaves the flow and becomes an off-canvas drawer. */
  mobile?: boolean;
  drawerOpen?: boolean;
  onCloseDrawer?: () => void;
}

export function Sidebar({
  collapsed,
  onToggle,
  mobile = false,
  drawerOpen = false,
  onCloseDrawer,
}: SidebarProps): React.ReactElement | null {
  const { t } = useTheme();
  const { route, setRoute, requestNewVideo } = useRoute();
  const { tier, loading } = useTier();

  // While /api/vater/me is in flight we render the public list — the
  // floor, never the ceiling, so nothing gated flashes into view.
  const items = React.useMemo(
    () => visibleRoutes(loading ? 'public' : tier, SHOW_STUBS),
    [tier, loading],
  );
  const primary = items.filter((i) => i.section === 'primary');
  const secondary = items.filter((i) => i.section === 'secondary');

  // Escape closes the mobile drawer.
  React.useEffect(() => {
    if (!mobile || !drawerOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseDrawer?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobile, drawerOpen, onCloseDrawer]);

  // On mobile the rail is always full-width inside the drawer — never the
  // 68px icon rail, which is unusable with a thumb.
  const railCollapsed = mobile ? false : collapsed;

  const NavItem = ({ item }: { item: NavRouteDef }) => {
    const active = route === item.id;
    const [hovered, setHovered] = React.useState(false);
    const go = (): void => {
      setRoute(item.id);
      if (mobile) onCloseDrawer?.();
    };
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        data-testid={`nav-${item.id}`}
        onClick={go}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            go();
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: railCollapsed ? '10px 12px' : '10px 16px',
          borderRadius: JELLY_TOKENS.radius.md,
          margin: '2px 8px',
          cursor: 'pointer',
          background: active
            ? JELLY_TOKENS.brandGhost
            : hovered
              ? t.hover
              : 'transparent',
          color: active ? JELLY_TOKENS.brand : t.text,
          fontWeight: active ? 600 : 400,
          fontSize: 14,
          transition: 'all .15s ease',
          justifyContent: railCollapsed ? 'center' : 'flex-start',
        }}
      >
        <Icon
          name={item.icon as IconName}
          size={20}
          color={active ? JELLY_TOKENS.brand : t.textSecondary}
        />
        {!railCollapsed && <span>{item.label}</span>}
      </div>
    );
  };

  // Off-canvas on phones: nothing in the layout flow, so the main column
  // gets the full 390px instead of 130px.
  if (mobile && !drawerOpen) return null;

  const rail = (
    <div
      data-testid="sidebar"
      style={
        mobile
          ? {
              width: 'min(280px, 85vw)',
              maxWidth: '85vw',
              height: '100dvh',
              position: 'fixed',
              top: 0,
              left: 0,
              background: t.sidebarBg,
              borderRight: `1px solid ${t.border}`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 210,
              boxShadow: JELLY_TOKENS.shadow24,
            }
          : {
              width: railCollapsed ? 68 : 260,
              minWidth: railCollapsed ? 68 : 260,
              height: '100vh',
              position: 'sticky',
              top: 0,
              background: t.sidebarBg,
              borderRight: `1px solid ${t.border}`,
              display: 'flex',
              flexDirection: 'column',
              transition: 'width .2s ease, min-width .2s ease',
              overflow: 'hidden',
              zIndex: 100,
            }
      }
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 16px 8px',
          gap: 10,
          justifyContent: railCollapsed ? 'center' : 'space-between',
        }}
      >
        {!railCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: JELLY_TOKENS.gradCreate,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: '#fff',
                fontWeight: 700,
              }}
            >
              J
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Jelly</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                background: JELLY_TOKENS.brand,
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              AI
            </span>
          </div>
        )}
        {railCollapsed && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: JELLY_TOKENS.gradCreate,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: '#fff',
              fontWeight: 700,
            }}
          >
            V
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label={
            mobile
              ? 'Close navigation'
              : collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
          }
          aria-expanded={mobile ? drawerOpen : !collapsed}
          data-testid="sidebar-toggle"
          onClick={mobile ? () => onCloseDrawer?.() : onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (mobile) onCloseDrawer?.();
              else onToggle();
            }
          }}
          style={{ cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
        >
          <Icon
            name={mobile ? 'close' : collapsed ? 'chevronRight' : 'chevronLeft'}
            size={18}
            color={t.textSecondary}
          />
        </div>
      </div>

      {/* Create Video CTA */}
      <div style={{ padding: railCollapsed ? '12px 8px' : '12px 16px' }}>
        <VBtn
          aria-label="Create Video"
          data-testid="create-video"
          onClick={() => {
            requestNewVideo();
            if (mobile) onCloseDrawer?.();
          }}
          style={{
            width: '100%',
            justifyContent: 'center',
            borderRadius: JELLY_TOKENS.radius.md,
            padding: railCollapsed ? '10px 8px' : '10px 16px',
          }}
          icon={railCollapsed ? 'plus' : undefined}
        >
          {railCollapsed ? '' : '+ Create Video'}
        </VBtn>
      </div>

      {/* Nav — scrolls independently of the header + CTA, which stay pinned.
       * `minHeight: 0` is load-bearing: without it a flex child refuses to
       * shrink below its content height and the overflow never engages, so
       * the tail of the nav (Course Studio, Discord) was unreachable on
       * short viewports. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: `${t.border} transparent`,
        }}
      >
        <div>
          {primary.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 8 }} />
        <div style={{ marginBottom: 16 }}>
          {secondary.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );

  if (!mobile) return rail;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      onClick={() => onCloseDrawer?.()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'contents' }}>
        {rail}
      </div>
    </div>
  );
}
