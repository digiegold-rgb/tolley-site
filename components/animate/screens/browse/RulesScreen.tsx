'use client';

/* RulesScreen — the ONLINE Vater rulebook (rule 158, 2026-08-25).
 *
 * Source of truth = the VaterRule table (GET/POST /api/vater/rules,
 * PUT /api/vater/rules/[code]). Every render on the DGX fetches the same JSON
 * at start and stamps its `version` (content hash) into the job, so what you
 * read here is exactly what the planner, the Fable runner and the delivery
 * audit read. Studio users edit inline; rule numbers are permanent.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { useTier } from '../../tier-context';
import { VCard, SectionHeader, VBtn, RetryError } from '../../primitives';
import { relativeTimeLabel } from '@/lib/vater/concierge-client';

export type RuleGate = 'hard' | 'advisory' | 'planner' | 'info';

export interface RuleRow {
  code: string;
  number: number;
  suffix: string;
  section: number;
  sectionTitle: string;
  title: string;
  body: string;
  source: string | null;
  gate: RuleGate;
  retiredAt: string | null;
  retiredNote: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface RulesPayload {
  version: string;
  count: number;
  updatedAt: string | null;
  sections: { number: number; title: string }[];
  rules: RuleRow[];
}

export const GATE_COLOR: Record<RuleGate, string> = {
  hard: '#E0405A',
  advisory: JELLY_TOKENS.warning,
  planner: JELLY_TOKENS.brand,
  info: '#8C8AA3',
};

export const GATE_MEANING: Record<RuleGate, string> = {
  hard: 'the delivery audit BLOCKS the video on it',
  advisory: 'reported in the customer note, never blocks',
  planner: 'injected into every scene-planner prompt',
  info: 'ops / billing doctrine (not a render check)',
};

const GATES: RuleGate[] = ['hard', 'advisory', 'planner', 'info'];

export function GatePill({ gate, small }: { gate: RuleGate; small?: boolean }): React.ReactElement {
  const c = GATE_COLOR[gate] ?? GATE_COLOR.info;
  return (
    <span
      title={GATE_MEANING[gate]}
      style={{
        fontSize: small ? 9 : 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        padding: small ? '1px 6px' : '2px 8px',
        borderRadius: JELLY_TOKENS.radius.pill,
        color: c,
        border: `1px solid ${c}55`,
        background: `${c}14`,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {gate}
    </span>
  );
}

/* Minimal inline markdown: `code` and **bold**; newlines preserved by the container. */
function Inline({ text, color }: { text: string; color: string }): React.ReactElement {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('`') && p.endsWith('`')) {
          return (
            <code key={i} style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.92em', background: `${color}14`, padding: '0 4px', borderRadius: 4 }}>
              {p.slice(1, -1)}
            </code>
          );
        }
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}

export async function fetchRules(): Promise<RulesPayload> {
  const res = await fetch('/api/vater/rules?includeRetired=1', { cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as RulesPayload & { error?: string };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

type Draft = { title: string; body: string; gate: RuleGate; source: string; retired: boolean; retiredNote: string };

export function RulesScreen(): React.ReactElement {
  const { t } = useTheme();
  const { tier, capabilities } = useTier();
  const canEdit = capabilities.rules || tier === 'studio' || tier === 'owner';

  const [data, setData] = React.useState<RulesPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'all' | RuleGate>('all');
  const [q, setQ] = React.useState('');
  const [collapsed, setCollapsed] = React.useState<Set<number>>(new Set());
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [addDraft, setAddDraft] = React.useState<{ section: number; title: string; body: string; gate: RuleGate; source: string }>({ section: 4, title: '', body: '', gate: 'planner', source: '' });

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setData(await fetchRules());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error');
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const lastEdit = React.useMemo(() => {
    if (!data) return null;
    return data.rules.reduce<RuleRow | null>((m, r) => (!m || r.updatedAt > m.updatedAt ? r : m), null);
  }, [data]);

  const visible = React.useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.rules.filter((r) => {
      if (filter !== 'all' && r.gate !== filter) return false;
      if (!needle) return true;
      return `${r.code} ${r.title} ${r.body} ${r.source ?? ''}`.toLowerCase().includes(needle);
    });
  }, [data, filter, q]);

  const bySection = React.useMemo(() => {
    const m = new Map<number, RuleRow[]>();
    for (const r of visible) m.set(r.section, [...(m.get(r.section) ?? []), r]);
    return m;
  }, [visible]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const r of data?.rules ?? []) {
      if (r.retiredAt) continue;
      c.all++;
      c[r.gate] = (c[r.gate] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const startEdit = (r: RuleRow) => {
    if (!canEdit) return;
    setEditing(r.code);
    setSaveError(null);
    setDraft({ title: r.title, body: r.body, gate: r.gate, source: r.source ?? '', retired: !!r.retiredAt, retiredNote: r.retiredNote ?? '' });
  };

  const save = async (r: RuleRow) => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const patch: Record<string, unknown> = { title: draft.title, body: draft.body, gate: draft.gate, source: draft.source || null };
      if (draft.retired !== !!r.retiredAt) patch.retiredAt = draft.retired;
      if (draft.retired) patch.retiredNote = draft.retiredNote || null;
      const res = await fetch(`/api/vater/rules/${encodeURIComponent(r.code)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      const out = (await res.json().catch(() => ({}))) as { rule?: RuleRow; error?: string };
      if (!res.ok || !out.rule) throw new Error(out.error || `HTTP ${res.status}`);
      setEditing(null);
      setDraft(null);
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/vater/rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addDraft),
      });
      const out = (await res.json().catch(() => ({}))) as { rule?: RuleRow; error?: string };
      if (!res.ok || !out.rule) throw new Error(out.error || `HTTP ${res.status}`);
      setAdding(false);
      setAddDraft((d) => ({ ...d, title: '', body: '', source: '' }));
      await load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'add failed');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: JELLY_TOKENS.radius.sm,
    border: `1px solid ${JELLY_TOKENS.brandOutline}`, background: t.hover, color: t.text, fontSize: 13, fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="description"
        title="Rules"
        description="The numbered production rulebook — the ONLINE source of truth. Every render fetches this exact list at start and stamps its version; edits here reach the next render immediately."
        actionLabel="Download PDF"
        onAction={() => { window.open('/api/vater/rules?format=pdf&download=1', '_blank'); }}
      />

      {error && <RetryError message={error} onRetry={() => void load()} />}

      {data && (
        <VCard style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }} data-testid="rules-header">
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, padding: '2px 8px', borderRadius: JELLY_TOKENS.radius.pill, background: JELLY_TOKENS.brandGhost, border: `1px solid ${JELLY_TOKENS.brandOutline}`, color: t.text }} title="Content hash over every active rule — the id each render records">
              v{data.version}
            </span>
            <span style={{ fontSize: 13, color: t.textSecondary }}>{counts.all} active rules</span>
            {lastEdit && (
              <span style={{ fontSize: 12, color: t.textSecondary }}>
                last edit {relativeTimeLabel(lastEdit.updatedAt)} by {lastEdit.updatedBy ?? '—'} (rule {lastEdit.code})
              </span>
            )}
            <span style={{ flex: 1 }} />
            {canEdit && (
              <VBtn variant="primary" size="sm" onClick={() => { setAdding((v) => !v); setSaveError(null); }} data-testid="rules-add">
                {adding ? 'Close' : '+ Add rule'}
              </VBtn>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {(['all', ...GATES] as const).map((g) => {
              const on = filter === g;
              const c = g === 'all' ? JELLY_TOKENS.cyan : GATE_COLOR[g];
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFilter(g)}
                  data-testid={`rules-filter-${g}`}
                  style={{
                    cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                    padding: '4px 10px', borderRadius: JELLY_TOKENS.radius.pill,
                    color: c, border: `1px solid ${c}${on ? '' : '55'}`, background: on ? `${c}26` : `${c}0d`,
                  }}
                >
                  {g} · {counts[g] ?? 0}
                </button>
              );
            })}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search rules (number, words)…"
              data-testid="rules-search"
              style={{ ...inputStyle, width: 260, marginLeft: 'auto' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6, fontSize: 12, color: t.textSecondary }}>
            {GATES.map((g) => (
              <div key={g} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <GatePill gate={g} small />
                <span>{GATE_MEANING[g]}</span>
              </div>
            ))}
          </div>

          {adding && canEdit && (
            <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: JELLY_TOKENS.radius.md, border: `1px dashed ${JELLY_TOKENS.brandOutline}` }} data-testid="rules-add-form">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select value={addDraft.section} onChange={(e) => setAddDraft({ ...addDraft, section: Number(e.target.value) })} style={{ ...inputStyle, width: 320 }}>
                  {data.sections.map((s) => <option key={s.number} value={s.number}>{s.number}. {s.title}</option>)}
                </select>
                <select value={addDraft.gate} onChange={(e) => setAddDraft({ ...addDraft, gate: e.target.value as RuleGate })} style={{ ...inputStyle, width: 140 }}>
                  {GATES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <input value={addDraft.title} onChange={(e) => setAddDraft({ ...addDraft, title: e.target.value })} placeholder="Rule title (one sentence)" style={inputStyle} />
              <textarea value={addDraft.body} onChange={(e) => setAddDraft({ ...addDraft, body: e.target.value })} placeholder="Body — what exactly the renderer must do" rows={4} style={inputStyle} />
              <input value={addDraft.source} onChange={(e) => setAddDraft({ ...addDraft, source: e.target.value })} placeholder="Source (who / date / video #) — optional" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <VBtn variant="primary" size="sm" onClick={() => void add()} disabled={saving || !addDraft.title.trim()}>Add as next number</VBtn>
                <span style={{ fontSize: 12, color: t.textSecondary }}>Gets the next permanent number — numbers are never reused.</span>
              </div>
            </div>
          )}
          {saveError && <div style={{ color: JELLY_TOKENS.error, fontSize: 13 }}>{saveError}</div>}
        </VCard>
      )}

      {data && data.sections.map((s) => {
        const rows = bySection.get(s.number) ?? [];
        if (!rows.length) return null;
        const isCollapsed = collapsed.has(s.number);
        return (
          <VCard key={s.number} style={{ padding: 0, overflow: 'hidden' }} data-testid={`rules-section-${s.number}`}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(s.number)) n.delete(s.number); else n.add(s.number); return n; })}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: t.hover, border: 'none', color: t.text }}
            >
              <span style={{ fontSize: 11.5, letterSpacing: '0.26em', textTransform: 'uppercase', color: JELLY_TOKENS.cyan }}>§{s.number}</span>
              <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{s.title}</span>
              <span style={{ fontSize: 12, color: t.textSecondary }}>{rows.length} · {isCollapsed ? 'show' : 'hide'}</span>
            </button>
            {!isCollapsed && rows.map((r) => {
              const isEditing = editing === r.code;
              const retired = !!r.retiredAt;
              return (
                <div
                  key={r.code}
                  data-testid={`rule-${r.code}`}
                  onClick={() => { if (!isEditing) startEdit(r); }}
                  style={{
                    display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, padding: '10px 16px',
                    borderTop: `1px solid ${JELLY_TOKENS.brandGhost}`,
                    borderLeft: `3px solid ${GATE_COLOR[r.gate]}`,
                    cursor: canEdit && !isEditing ? 'pointer' : 'default',
                    opacity: retired ? 0.55 : 1,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: 13, color: t.text }}>#{r.code}</span>
                    <GatePill gate={r.gate} small />
                  </div>
                  {!isEditing ? (
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: t.text, textDecoration: retired ? 'line-through' : 'none' }}>
                        <Inline text={r.title} color={GATE_COLOR[r.gate]} />
                      </div>
                      {r.body && (
                        <div style={{ fontSize: 13, color: t.textSecondary, whiteSpace: 'pre-wrap', marginTop: 4, textDecoration: retired ? 'line-through' : 'none' }}>
                          <Inline text={r.body} color={GATE_COLOR[r.gate]} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: t.textSecondary, marginTop: 6, opacity: 0.8 }}>
                        {r.source && <span>({r.source})</span>}
                        {retired && <span style={{ color: JELLY_TOKENS.error }}>retired {r.retiredAt?.slice(0, 10)}{r.retiredNote ? ` — ${r.retiredNote}` : ''}</span>}
                        {r.updatedBy && !r.updatedBy.startsWith('seed:') && <span>edited {relativeTimeLabel(r.updatedAt)} by {r.updatedBy}</span>}
                      </div>
                    </div>
                  ) : draft && (
                    <div style={{ display: 'grid', gap: 8 }} onClick={(e) => e.stopPropagation()} data-testid={`rule-editor-${r.code}`}>
                      <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...inputStyle, fontWeight: 700 }} />
                      <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={Math.min(12, Math.max(3, draft.body.split('\n').length + 1))} style={inputStyle} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select value={draft.gate} onChange={(e) => setDraft({ ...draft, gate: e.target.value as RuleGate })} style={{ ...inputStyle, width: 140 }}>
                          {GATES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="source" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
                        <label style={{ fontSize: 12, color: t.textSecondary, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="checkbox" checked={draft.retired} onChange={(e) => setDraft({ ...draft, retired: e.target.checked })} /> retired
                        </label>
                        {draft.retired && (
                          <input value={draft.retiredNote} onChange={(e) => setDraft({ ...draft, retiredNote: e.target.value })} placeholder="why retired" style={{ ...inputStyle, width: 220 }} />
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <VBtn variant="primary" size="sm" onClick={() => void save(r)} disabled={saving || !draft.title.trim()} data-testid={`rule-save-${r.code}`}>{saving ? 'Saving…' : 'Save'}</VBtn>
                        <VBtn variant="ghost" size="sm" onClick={() => { setEditing(null); setDraft(null); }}>Cancel</VBtn>
                        <span style={{ fontSize: 11, color: t.textSecondary, alignSelf: 'center' }}>#{r.code} is permanent · every save is recorded with your name</span>
                      </div>
                      {saveError && <div style={{ color: JELLY_TOKENS.error, fontSize: 12 }}>{saveError}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </VCard>
        );
      })}
    </div>
  );
}
