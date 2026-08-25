'use client';

/* Sidebar — nav order and icons ported from vater-core.jsx lines 202-280.
 *
 * The item list is NOT static any more: it comes from
 * lib/vater/nav-visibility.ts filtered by the caller's tier (from
 * /api/vater/me). A public customer must never be shown RSS Feeds,
 * Autopilot or the Discord bot — those 401 for them.
 *
 * Cinema pass (2026-08-16): glass rail (t.sidebarBg + blur + hairline), the
 * Jelly mark with a violet glow over a "JELLY STUDIO" wordmark, micro-label
 * section headers, and an active row that wears the violet→cyan chip tint.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme, useRoute } from './theme-context';
import { useTier } from './tier-context';
import { Icon, type IconName } from './Icon';
import { VBtn } from './primitives';
import { MicroLabel } from './cinema';
import { visibleRoutes, type NavRouteDef } from '@/lib/vater/nav-visibility';
import {
  applyNavPrefs,
  clearNavPrefs,
  loadNavPrefs,
  moveItem,
  prefsFromLists,
  saveNavPrefs,
  type NavOrderPrefs,
} from '@/lib/vater/nav-order';

const SHOW_STUBS = process.env.NEXT_PUBLIC_VATER_BETA_STUBS === '1';

/** Violet halo on the brand mark — the one place the logo gets a glow. */
const LOGO_GLOW = 'drop-shadow(0 0 14px rgba(143,125,255,0.55))';
/** Active-row outline. Brighter than brandOutline so "you are here" reads at a glance. */
const ACTIVE_BORDER = 'rgba(143,125,255,0.7)';
/** Modal scrim — the ink base at 66%, not a palette hue. Shared with the Header/Help drawers. */
const SCRIM = 'rgba(8,7,15,0.66)';
/** Section headers, keyed to NavRouteDef['section']. */
const SECTION_LABEL: Record<NavRouteDef['section'], string> = {
  primary: 'Studio',
  secondary: 'Account',
};

/** "STUDIO" / "ACCOUNT" micro-label above each half of the rail. */
function SectionHeader({ section }: { section: NavRouteDef['section'] }): React.ReactElement {
  const { t } = useTheme();
  return (
    <MicroLabel
      tone="faint"
      color={t.textFaint}
      size={10.5}
      tracking="0.26em"
      style={{ padding: '14px 17px 6px' }}
    >
      {SECTION_LABEL[section]}
    </MicroLabel>
  );
}

/** Where a dragged row would land. Insertion index is counted with the
 *  dragged row still in place (commitDrop corrects for that). */
interface DropTarget { section: NavRouteDef['section']; index: number }

interface NavItemProps {
  item: NavRouteDef;
  section: NavRouteDef['section'];
  index: number;
  active: boolean;
  railCollapsed: boolean;
  dragId: string | null;
  drop: DropTarget | null;
  onGo: (id: string) => void;
  onDropAt: (target: DropTarget) => void;
  onCommitDrop: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onMoveByKey: (id: string, dir: -1 | 1) => void;
}

/* Module-scope on purpose (2026-08-25): this used to be declared INSIDE
 * Sidebar, so React saw a brand-new component type on every render and
 * unmounted/remounted every row each time drag state changed — which
 * destroys the HTML5 drag source mid-gesture (Chrome tolerated it, Firefox
 * and Safari aborted the drag). Stable type = rows survive the drag. */
function NavItem({
  item,
  section,
  index,
  active,
  railCollapsed,
  dragId,
  drop,
  onGo,
  onDropAt,
  onCommitDrop,
  onDragStart,
  onDragEnd,
  onMoveByKey,
}: NavItemProps): React.ReactElement {
  const { t } = useTheme();
  const [hovered, setHovered] = React.useState(false);
  const go = (): void => onGo(item.id);
  const showIndicator = drop?.section === section && drop.index === index && dragId !== null;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      data-testid={`nav-${item.id}`}
      data-nav-row={item.id}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      }}
      onDragOver={(e) => {
        if (!dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const box = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > box.top + box.height / 2;
        onDropAt({ section, index: index + (after ? 1 : 0) });
      }}
      onDrop={(e) => {
        e.preventDefault();
        onCommitDrop();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: railCollapsed ? '9px 11px' : '9px 15px',
        borderRadius: JELLY_TOKENS.radius.md,
        margin: '2px 8px',
        cursor: 'pointer',
        opacity: dragId === item.id ? 0.35 : 1,
        // Insertion line: a 2px brand rule ABOVE the row the drop lands before.
        boxShadow: showIndicator ? `0 -2px 0 0 ${JELLY_TOKENS.brand}` : undefined,
        background: active
          ? JELLY_TOKENS.gradChipOn
          : hovered
            ? t.hover
            : 'transparent',
        // 1px border always, transparent when idle — otherwise the row jumps
        // 2px wide the moment it goes active.
        border: `1px solid ${active ? ACTIVE_BORDER : 'transparent'}`,
        color: active ? t.text : t.textSecondary,
        fontWeight: active ? 600 : 500,
        fontSize: 13.5,
        letterSpacing: '-0.005em',
        transition: 'all .15s ease',
        justifyContent: railCollapsed ? 'center' : 'flex-start',
      }}
    >
      <Icon
        name={item.icon as IconName}
        size={18}
        color={active ? JELLY_TOKENS.brandLight : t.textFaint}
      />
      {!railCollapsed && <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>}
      {/* ≡ grip — drag to reorder (works across STUDIO/ACCOUNT too);
          focused, ArrowUp/ArrowDown move the row. Hidden on the collapsed
          icon rail where there is nowhere to show it. */}
      {!railCollapsed && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Reorder ${item.label} (drag, or arrow keys)`}
          title="Drag to reorder"
          draggable
          data-testid={`nav-grip-${item.id}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              e.stopPropagation();
              onMoveByKey(item.id, e.key === 'ArrowUp' ? -1 : 1);
            }
          }}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.id);
            onDragStart(item.id);
          }}
          onDragEnd={onDragEnd}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            padding: '6px 4px',
            marginRight: -6,
            cursor: 'grab',
            opacity: hovered || dragId === item.id ? 0.75 : 0.22,
            transition: 'opacity .15s ease',
            flexShrink: 0,
            touchAction: 'none',
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                display: 'block',
                width: 12,
                height: 1.5,
                borderRadius: 1,
                background: t.textFaint,
              }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

/** Insertion index for a drag hovering somewhere in a section wrapper that is
 *  NOT over a row — the STUDIO/ACCOUNT header, the side gutters, the 2px gaps
 *  between rows, or the empty space below. Picks the row boundary nearest the
 *  pointer instead of "the end" (which is what sent Library to the BOTTOM
 *  when you tried to drag it to the top). */
function indexFromPointer(wrapper: HTMLElement, clientY: number): number {
  const rows = Array.from(wrapper.querySelectorAll<HTMLElement>('[data-nav-row]'));
  for (let i = 0; i < rows.length; i += 1) {
    const box = rows[i].getBoundingClientRect();
    if (clientY < box.top + box.height / 2) return i;
  }
  return rows.length;
}

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
  const { tier, loading, email } = useTier();

  // While /api/vater/me is in flight we render the public list — the
  // floor, never the ceiling, so nothing gated flashes into view.
  const items = React.useMemo(
    () => visibleRoutes(loading ? 'public' : tier, SHOW_STUBS),
    [tier, loading],
  );

  // ── Per-user order (2026-08-23) ─────────────────────────────────────────
  // Every account can drag rows (the ≡ grip) into its own order, across the
  // STUDIO/ACCOUNT halves too. Order-only: visibleRoutes still gates WHAT is
  // shown. Persisted in localStorage keyed by account email (nav-order.ts).
  const [prefs, setPrefs] = React.useState<NavOrderPrefs | null>(null);
  React.useEffect(() => {
    if (loading) return;
    setPrefs(loadNavPrefs(email));
  }, [email, loading]);
  const { primary, secondary } = React.useMemo(
    () => applyNavPrefs(items, prefs),
    [items, prefs],
  );

  // Drag state. `drop` = where the dragged row would land (insertion index
  // within that section, counted with the dragged row still in place).
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [drop, setDrop] = React.useState<DropTarget | null>(null);

  const persist = (p: NavRouteDef[], sList: NavRouteDef[]): void => {
    const next = prefsFromLists(p, sList);
    setPrefs(next);
    saveNavPrefs(email, next);
  };

  const commitDrop = (): void => {
    if (!dragId || !drop) return;
    const fromList = primary.some((i) => i.id === dragId) ? 'primary' : 'secondary';
    const list = fromList === 'primary' ? primary : secondary;
    const fromIdx = list.findIndex((i) => i.id === dragId);
    let index = drop.index;
    // The insertion index was computed with the dragged row still present —
    // removing it first shifts everything after it up by one.
    if (fromList === drop.section && fromIdx >= 0 && fromIdx < index) index -= 1;
    const moved = moveItem(primary, secondary, dragId, drop.section, index);
    if (moved) persist(moved.primary, moved.secondary);
  };

  /** Grip keyboard support: ArrowUp/ArrowDown walk the combined list, so a
   *  row naturally crosses the STUDIO/ACCOUNT boundary at the seam. */
  const moveByKey = (id: string, dir: -1 | 1): void => {
    const inPrimary = primary.some((i) => i.id === id);
    const list = inPrimary ? primary : secondary;
    const idx = list.findIndex((i) => i.id === id);
    if (idx < 0) return;
    let section: NavRouteDef['section'] = inPrimary ? 'primary' : 'secondary';
    let to = idx + dir;
    if (inPrimary && to >= list.length) { section = 'secondary'; to = 0; }
    else if (!inPrimary && to < 0) { section = 'primary'; to = primary.length; }
    else if (to < 0) return; // already at the very top
    const moved = moveItem(primary, secondary, id, section, to);
    if (moved) persist(moved.primary, moved.secondary);
  };

  const goTo = (id: string): void => {
    setRoute(id);
    if (mobile) onCloseDrawer?.();
  };
  const finishDrop = (): void => {
    commitDrop();
    setDragId(null);
    setDrop(null);
  };
  const endDrag = (): void => {
    setDragId(null);
    setDrop(null);
  };
  /** Section-wrapper dragover: rows handle themselves (data-nav-row); anything
   *  else in the wrapper — header, gutters, gaps, tail — resolves by pointer. */
  const wrapperDragOver = (section: NavRouteDef['section']) => (e: React.DragEvent<HTMLDivElement>): void => {
    if (!dragId) return;
    if ((e.target as HTMLElement).closest?.('[data-nav-row]')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDrop({ section, index: indexFromPointer(e.currentTarget, e.clientY) });
  };
  const wrapperDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest?.('[data-nav-row]')) return;
    e.preventDefault();
    finishDrop();
  };

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
              backdropFilter: t.glassBlur,
              WebkitBackdropFilter: t.glassBlur,
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
              backdropFilter: t.glassBlur,
              WebkitBackdropFilter: t.glassBlur,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/animate/brand/logo.svg"
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              style={{ width: 28, height: 28, flexShrink: 0, filter: LOGO_GLOW }}
            />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: t.text,
                whiteSpace: 'nowrap',
              }}
            >
              JELLY STUDIO
            </span>
          </div>
        )}
        {railCollapsed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/animate/brand/logo.svg"
            alt="Jelly Studio"
            width={28}
            height={28}
            style={{ width: 28, height: 28, filter: LOGO_GLOW }}
          />
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
            borderRadius: JELLY_TOKENS.radius.pill,
            padding: railCollapsed ? '10px 8px' : '10px 16px',
            fontSize: 13.5,
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
        <div
          data-testid="nav-section-primary"
          onDragOver={wrapperDragOver('primary')}
          onDrop={wrapperDrop}
        >
          {/* The STUDIO label is a drop target too: dragging a row onto it (or
              anywhere above row 0) lands at the top. It used to be a dead zone. */}
          {!railCollapsed && primary.length > 0 && (
            <div data-testid="nav-header-primary">
              <SectionHeader section="primary" />
            </div>
          )}
          {dragId !== null && drop?.section === 'primary' && drop.index === 0 && (
            <div style={{ height: 2, margin: '0 8px', borderRadius: 1, background: JELLY_TOKENS.brand }} />
          )}
          {primary.map((item, i) => (
            <NavItem
              key={item.id}
              item={item}
              section="primary"
              index={i}
              active={route === item.id}
              railCollapsed={railCollapsed}
              dragId={dragId}
              drop={drop}
              onGo={goTo}
              onDropAt={setDrop}
              onCommitDrop={finishDrop}
              onDragStart={setDragId}
              onDragEnd={endDrag}
              onMoveByKey={moveByKey}
            />
          ))}
          {dragId !== null && drop?.section === 'primary' && drop.index === primary.length && (
            <div style={{ height: 2, margin: '0 8px', borderRadius: 1, background: JELLY_TOKENS.brand }} />
          )}
        </div>
        <div
          style={{ flex: 1, minHeight: 8 }}
          onDragOver={(e) => {
            // The gap between the halves reads as "top of ACCOUNT".
            if (!dragId) return;
            e.preventDefault();
            setDrop({ section: 'secondary', index: 0 });
          }}
          onDrop={(e) => {
            e.preventDefault();
            finishDrop();
          }}
        />
        <div
          style={{ marginBottom: 16 }}
          data-testid="nav-section-secondary"
          onDragOver={wrapperDragOver('secondary')}
          onDrop={wrapperDrop}
        >
          {!railCollapsed && secondary.length > 0 && (
            <div data-testid="nav-header-secondary">
              <SectionHeader section="secondary" />
            </div>
          )}
          {dragId !== null && drop?.section === 'secondary' && drop.index === 0 && (
            <div style={{ height: 2, margin: '0 8px', borderRadius: 1, background: JELLY_TOKENS.brand }} />
          )}
          {secondary.map((item, i) => (
            <NavItem
              key={item.id}
              item={item}
              section="secondary"
              index={i}
              active={route === item.id}
              railCollapsed={railCollapsed}
              dragId={dragId}
              drop={drop}
              onGo={goTo}
              onDropAt={setDrop}
              onCommitDrop={finishDrop}
              onDragStart={setDragId}
              onDragEnd={endDrag}
              onMoveByKey={moveByKey}
            />
          ))}
          {dragId !== null && drop?.section === 'secondary' && drop.index === secondary.length && (
            <div style={{ height: 2, margin: '0 8px', borderRadius: 1, background: JELLY_TOKENS.brand }} />
          )}
          {/* Custom order active → offer the way back. */}
          {!railCollapsed && prefs !== null && (
            <button
              type="button"
              data-testid="nav-reset-order"
              onClick={() => {
                clearNavPrefs(email);
                setPrefs(null);
              }}
              style={{
                display: 'block',
                background: 'transparent',
                border: 'none',
                color: t.textFaint,
                fontSize: 11,
                padding: '8px 17px 0',
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              ↺ Reset menu order
            </button>
          )}
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
        background: SCRIM,
        backdropFilter: 'blur(2px)',
        zIndex: 200,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'contents' }}>
        {rail}
      </div>
    </div>
  );
}
