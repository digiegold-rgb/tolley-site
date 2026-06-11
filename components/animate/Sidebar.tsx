'use client';

/* Sidebar — ported from vater-core.jsx lines 202-280.
 * Nav order, icon names, and brand "V" logo identical to the prototype.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme, useRoute } from './theme-context';
import { Icon, type IconName } from './Icon';
import { VBtn } from './primitives';

interface NavItemDef {
  id: string;
  label: string;
  icon: IconName;
  /** Hide unless NEXT_PUBLIC_VATER_BETA_STUBS === '1'. Stage 0 gate for half-built tabs. */
  stub?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'library', label: 'Library', icon: 'videoEditor' },
  { id: 'queue', label: 'Queue', icon: 'history' },
  { id: 'recent', label: 'Recent', icon: 'sparkle' },
  { id: 'voices', label: 'Voices', icon: 'help' },
  { id: 'feeds', label: 'RSS Feeds', icon: 'web' },
  { id: 'autopilot', label: 'Autopilot', icon: 'sparkle' },
  { id: 'publishing', label: 'Publishing', icon: 'upload' },
  { id: 'animation', label: 'AI Animation', icon: 'image', stub: true },
  { id: 'analytics', label: 'Analytics', icon: 'niche', stub: true },
  { id: 'niche-finder', label: 'Niche Finder', icon: 'search' },
  { id: 'styles', label: 'Styles', icon: 'styles' },
  { id: 'project-history', label: 'Project History', icon: 'history' },
  { id: 'video-editor', label: 'Video Editor', icon: 'videoEditor' },
  { id: 'learning-center', label: 'Learning Center', icon: 'learning', stub: true },
];

const SECONDARY_ITEMS: NavItemDef[] = [
  { id: 'discord', label: 'Discord Bot', icon: 'help' },
  { id: 'course', label: 'Course', icon: 'course', stub: true },
  { id: 'affiliate', label: 'Affiliate', icon: 'affiliate', stub: true },
];

const SHOW_STUBS = process.env.NEXT_PUBLIC_VATER_BETA_STUBS === '1';
const filterStubs = (items: NavItemDef[]) =>
  SHOW_STUBS ? items : items.filter((item) => !item.stub);

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps): React.ReactElement {
  const { t } = useTheme();
  const { route, setRoute, requestNewVideo } = useRoute();

  const NavItem = ({ item }: { item: NavItemDef }) => {
    const active = route === item.id;
    const [hovered, setHovered] = React.useState(false);
    return (
      <div
        onClick={() => setRoute(item.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: collapsed ? '10px 12px' : '10px 16px',
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
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <Icon
          name={item.icon}
          size={20}
          color={active ? JELLY_TOKENS.brand : t.textSecondary}
        />
        {!collapsed && <span>{item.label}</span>}
      </div>
    );
  };

  return (
    <div
      style={{
        width: collapsed ? 68 : 260,
        minWidth: collapsed ? 68 : 260,
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
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 16px 8px',
          gap: 10,
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        {!collapsed && (
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
        {collapsed && (
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
          onClick={onToggle}
          style={{ cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}
        >
          <Icon
            name={collapsed ? 'chevronRight' : 'chevronLeft'}
            size={18}
            color={t.textSecondary}
          />
        </div>
      </div>

      {/* Create Video CTA */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px' }}>
        <VBtn
          onClick={() => {
            requestNewVideo();
          }}
          style={{
            width: '100%',
            justifyContent: 'center',
            borderRadius: JELLY_TOKENS.radius.md,
            padding: collapsed ? '10px 8px' : '10px 16px',
          }}
          icon={collapsed ? 'plus' : undefined}
        >
          {collapsed ? '' : '+ Create Video'}
        </VBtn>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div>
          {filterStubs(NAV_ITEMS).map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ marginBottom: 16 }}>
          {filterStubs(SECONDARY_ITEMS).map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
