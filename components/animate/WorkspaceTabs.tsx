'use client';

/**
 * WorkspaceTabs — the studio TAB STRIP above the Jelly logo (2026-08-27).
 *
 * One login, many fully separate studios. Each tab is its own library, cast,
 * voices, connections, rules and balance (lib/vater/workspaces.ts). The strip
 * is the ONLY place the user sees the concept: everything below it is the
 * ordinary studio, unchanged, acting as whichever tab is lit.
 *
 * Behaviour:
 *   click        → POST /api/vater/workspaces/switch, then a FULL reload.
 *                  The session identity changes, so every cached client
 *                  fetch under it has to be thrown away (same rule as exiting
 *                  "view as" — ViewAsBanner.tsx).
 *   double-click → rename inline (Enter saves, Esc cancels)
 *   drag         → reorder (DragEvents, the same pattern as the sidebar rows,
 *                  so Playwright can drive it)
 *   +            → new studio (asks for a name; refuses at the limit)
 *   ⋯ on active  → rename / archive (archive never deletes anything)
 *
 * Hidden entirely while /api/vater/workspaces answers 503 (migration not run
 * yet) — the studio then behaves exactly as before: one implicit tab.
 */

import * as React from 'react';

import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { useTier } from './tier-context';
import { useProduct } from './product-context';

export interface WorkspaceTab {
  id: string;
  name: string;
  sortOrder: number;
  isPrimary: boolean;
  active: boolean;
  archivedAt: string | null;
}

interface ListPayload {
  workspaces?: WorkspaceTab[];
  activeId?: string;
  max?: number;
  error?: string;
}

export const WORKSPACE_STRIP_HEIGHT = 40;

export function WorkspaceTabs(): React.ReactElement | null {
  const { t, dark } = useTheme();
  const { loading: tierLoading, beta } = useTier();
  const brand = useProduct();
  const [tabs, setTabs] = React.useState<WorkspaceTab[] | null>(null);
  const [max, setMax] = React.useState(10);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropIdx, setDropIdx] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch('/api/vater/workspaces', { cache: 'no-store' });
      if (r.status === 503 || r.status === 401) {
        setTabs(null);
        return;
      }
      const data = (await r.json()) as ListPayload;
      if (!r.ok || !Array.isArray(data.workspaces)) {
        setTabs(null);
        return;
      }
      setTabs(data.workspaces);
      if (typeof data.max === 'number') setMax(data.max);
    } catch {
      setTabs(null);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Close the ⋯ menu on any outside click.
  React.useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuFor]);

  const flash = (msg: string) => {
    setError(msg);
    window.setTimeout(() => setError(null), 4000);
  };

  const switchTo = async (id: string) => {
    if (busy) return;
    const target = tabs?.find((w) => w.id === id);
    if (!target || target.active) return;
    setBusy(id);
    try {
      const r = await fetch('/api/vater/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
        flash(data.message || (r.status === 403 ? 'Read-only support session.' : "Couldn't switch studios."));
        setBusy(null);
        return;
      }
      // Identity changed: hard reload, land on the dashboard of the new tab.
      window.location.assign(brand.homePath);
    } catch {
      flash("Couldn't switch studios.");
      setBusy(null);
    }
  };

  const create = async () => {
    if (busy || !tabs) return;
    if (tabs.length >= max) {
      flash(`You can have up to ${max} studios. Archive one to add another.`);
      return;
    }
    const name = window.prompt('Name your new studio (you can rename it any time):', `Studio ${tabs.length + 1}`);
    if (name === null) return;
    setBusy('new');
    try {
      const r = await fetch('/api/vater/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = (await r.json().catch(() => ({}))) as { workspace?: WorkspaceTab; message?: string };
      if (!r.ok || !data.workspace) {
        flash(data.message || "Couldn't create that studio.");
        setBusy(null);
        return;
      }
      // Straight into the new studio — that is what "open a new tab" means.
      await fetch('/api/vater/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.workspace.id }),
      });
      window.location.assign(brand.homePath);
    } catch {
      flash("Couldn't create that studio.");
      setBusy(null);
    }
  };

  const rename = async (id: string, name: string) => {
    setRenaming(null);
    const clean = name.replace(/\s+/g, ' ').trim();
    const current = tabs?.find((w) => w.id === id);
    if (!clean || !current || clean === current.name) return;
    setTabs((prev) => prev?.map((w) => (w.id === id ? { ...w, name: clean } : w)) ?? prev);
    try {
      const r = await fetch(`/api/vater/workspaces/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      });
      if (!r.ok) {
        flash(r.status === 403 ? 'Read-only support session.' : "Couldn't rename that studio.");
        void load();
      }
    } catch {
      flash("Couldn't rename that studio.");
      void load();
    }
  };

  const archive = async (id: string) => {
    setMenuFor(null);
    const target = tabs?.find((w) => w.id === id);
    if (!target || target.isPrimary) return;
    if (
      !window.confirm(
        `Archive “${target.name}”?\n\nNothing is deleted — its videos, cast and balance stay put and you can restore it from Settings → Studios.`,
      )
    ) {
      return;
    }
    setBusy(id);
    try {
      const r = await fetch(`/api/vater/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = (await r.json().catch(() => ({}))) as { switched?: boolean; message?: string };
      if (!r.ok) {
        flash(data.message || "Couldn't archive that studio.");
        setBusy(null);
        return;
      }
      if (data.switched) {
        window.location.assign(brand.homePath);
        return;
      }
      setBusy(null);
      void load();
    } catch {
      flash("Couldn't archive that studio.");
      setBusy(null);
    }
  };

  // ── Drag-reorder (DragEvents, mirrors Sidebar.tsx) ───────────────────────
  const commitOrder = async (ordered: WorkspaceTab[]) => {
    setTabs(ordered);
    try {
      await fetch('/api/vater/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: ordered.map((w) => w.id) }),
      });
    } catch {
      void load();
    }
  };

  const onDrop = () => {
    if (!tabs || !dragId || dropIdx === null) {
      setDragId(null);
      setDropIdx(null);
      return;
    }
    const from = tabs.findIndex((w) => w.id === dragId);
    if (from < 0) return;
    let to = dropIdx;
    if (from < to) to -= 1;
    // The primary studio is always first — reorder happens among the rest.
    const next = tabs.slice();
    const [moved] = next.splice(from, 1);
    next.splice(Math.max(1, Math.min(next.length, to)), 0, moved);
    setDragId(null);
    setDropIdx(null);
    if (next.some((w, i) => w.id !== tabs[i]?.id)) void commitOrder(next);
  };

  // Before the migration, or before we know: render nothing at all.
  if (!tabs || tabs.length === 0) return null;
  // Behind the beta gate there is no studio to tab between.
  if (!tierLoading && !beta.accessAllowed) return null;

  const stripBg = dark ? 'rgba(6,6,12,0.86)' : 'rgba(240,238,252,0.9)';

  return (
    <div
      data-testid="workspace-tabs"
      role="tablist"
      aria-label="Studios"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        minHeight: WORKSPACE_STRIP_HEIGHT,
        padding: '6px 10px 0',
        background: stripBg,
        backdropFilter: t.glassBlur,
        WebkitBackdropFilter: t.glassBlur,
        borderBottom: `1px solid ${t.border}`,
        overflowX: 'auto',
        overflowY: 'hidden',
        fontFamily: JELLY_TOKENS.font,
        position: 'relative',
        zIndex: 95,
      }}
    >
      {tabs.map((w, i) => {
        const isActive = w.active;
        const isDragging = dragId === w.id;
        const showInsert = dropIdx === i && dragId && dragId !== w.id;
        return (
          <React.Fragment key={w.id}>
            {showInsert ? <InsertMark color={JELLY_TOKENS.brand} /> : null}
            <div
              role="tab"
              aria-selected={isActive}
              data-testid={`workspace-tab-${w.id}`}
              data-active={isActive ? '1' : '0'}
              title={isActive ? `${w.name} — double-click to rename` : `Switch to ${w.name}`}
              draggable={!w.isPrimary && renaming !== w.id}
              onDragStart={(e) => {
                if (w.isPrimary) return;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', w.id);
                setDragId(w.id);
              }}
              onDragOver={(e) => {
                if (!dragId || w.isPrimary) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const before = e.clientX < rect.left + rect.width / 2;
                setDropIdx(before ? i : i + 1);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDrop();
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropIdx(null);
              }}
              onClick={() => {
                if (renaming === w.id) return;
                if (isActive) return;
                void switchTo(w.id);
              }}
              onDoubleClick={() => {
                if (isActive) setRenaming(w.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 32,
                padding: isActive ? '0 8px 0 14px' : '0 14px',
                borderRadius: '10px 10px 0 0',
                border: `1px solid ${isActive ? t.borderStrong : 'transparent'}`,
                borderBottom: isActive ? `1px solid ${dark ? '#0E0D19' : '#FFFFFF'}` : '1px solid transparent',
                marginBottom: -1,
                background: isActive
                  ? JELLY_TOKENS.gradChipOn
                  : dark
                    ? 'rgba(240,238,248,0.04)'
                    : 'rgba(20,18,42,0.04)',
                color: isActive ? t.text : t.textSecondary,
                fontSize: 12.5,
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
                cursor: isActive ? 'default' : busy ? 'progress' : 'pointer',
                opacity: isDragging ? 0.4 : busy && busy !== w.id ? 0.7 : 1,
                boxShadow: isActive ? `0 -6px 22px ${JELLY_TOKENS.brandGhost}` : 'none',
                userSelect: 'none',
                transition: 'background 120ms, color 120ms',
                flexShrink: 0,
                maxWidth: 260,
              }}
            >
              {w.isPrimary ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: isActive ? JELLY_TOKENS.cyan : t.textFaint,
                    flexShrink: 0,
                  }}
                />
              ) : null}
              {renaming === w.id ? (
                <RenameInput
                  initial={w.name}
                  color={t.text}
                  onDone={(name) => void rename(w.id, name)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
              )}
              {isActive && renaming !== w.id ? (
                <span
                  role="button"
                  aria-label="Studio options"
                  data-testid={`workspace-menu-${w.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(menuFor === w.id ? null : w.id);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    color: t.textSecondary,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>⋯</span>
                  {menuFor === w.id ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: 24,
                        right: 0,
                        minWidth: 160,
                        background: t.panel,
                        border: `1px solid ${t.border}`,
                        borderRadius: JELLY_TOKENS.radius.md,
                        boxShadow: JELLY_TOKENS.shadow24,
                        padding: 6,
                        zIndex: 120,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        fontWeight: 500,
                        fontSize: 13,
                        color: t.text,
                        textAlign: 'left',
                      }}
                    >
                      <MenuRow
                        label="Rename"
                        onClick={() => {
                          setMenuFor(null);
                          setRenaming(w.id);
                        }}
                        hover={t.hover}
                      />
                      {!w.isPrimary ? (
                        <MenuRow
                          label="Archive studio"
                          tone={JELLY_TOKENS.error}
                          onClick={() => void archive(w.id)}
                          hover={t.hover}
                        />
                      ) : (
                        <div style={{ padding: '6px 10px', fontSize: 11.5, color: t.textFaint }}>
                          Your main studio can’t be archived.
                        </div>
                      )}
                    </div>
                  ) : null}
                </span>
              ) : null}
            </div>
          </React.Fragment>
        );
      })}
      {dragId && dropIdx === tabs.length ? <InsertMark color={JELLY_TOKENS.brand} /> : null}
      <div
        role="button"
        aria-label="New studio"
        data-testid="workspace-new"
        title={tabs.length >= max ? `Limit of ${max} studios` : 'Open a new, separate studio'}
        onClick={() => void create()}
        onDragOver={(e) => {
          if (!dragId) return;
          e.preventDefault();
          setDropIdx(tabs.length);
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          marginBottom: 2,
          marginLeft: 2,
          borderRadius: 8,
          color: tabs.length >= max ? t.textDisabled : t.textSecondary,
          cursor: tabs.length >= max ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          fontSize: 18,
          lineHeight: 1,
          fontWeight: 400,
        }}
      >
        +
      </div>
      <div style={{ flex: 1 }} />
      {error ? (
        <div
          role="alert"
          style={{
            alignSelf: 'center',
            fontSize: 12,
            color: JELLY_TOKENS.error,
            padding: '0 8px 4px',
            whiteSpace: 'nowrap',
          }}
        >
          {error}
        </div>
      ) : (
        <div
          style={{
            alignSelf: 'center',
            fontSize: 10.5,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: t.textFaint,
            padding: '0 8px 4px',
            whiteSpace: 'nowrap',
          }}
        >
          {tabs.length} / {max} studios
        </div>
      )}
    </div>
  );
}

function InsertMark({ color }: { color: string }): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      style={{ width: 2, height: 26, borderRadius: 1, background: color, alignSelf: 'center', flexShrink: 0 }}
    />
  );
}

function MenuRow({
  label,
  onClick,
  hover,
  tone,
}: {
  label: string;
  onClick: () => void;
  hover: string;
  tone?: string;
}): React.ReactElement {
  const [over, setOver] = React.useState(false);
  return (
    <div
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      style={{
        padding: '7px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        background: over ? hover : 'transparent',
        color: tone ?? 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  );
}

function RenameInput({
  initial,
  color,
  onDone,
  onCancel,
}: {
  initial: string;
  color: string;
  onDone: (name: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [value, setValue] = React.useState(initial);
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      data-testid="workspace-rename"
      value={value}
      maxLength={40}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(value);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onDone(value)}
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: `1px solid ${JELLY_TOKENS.brand}`,
        outline: 'none',
        color,
        font: 'inherit',
        fontWeight: 600,
        width: Math.max(80, Math.min(240, value.length * 8 + 16)),
        padding: 0,
      }}
    />
  );
}
