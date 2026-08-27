'use client';

/* RulesScreen — the ONLINE rulebook (rule 158, 2026-08-25), three scopes:
 *
 *   Global   — de-branded production principles every render on Jelly Studio
 *              reads (codes G<n>). Everyone sees them; studio/admin edits.
 *   My rules — the signed-in user's own rules (#<n>), incl. the per-character
 *              rules instantiated when they build a character. Anyone edits
 *              their own.
 *   House    — Trey's studio rulebook (1…158). Studio only.
 *
 * Source of truth = the VaterRule table (GET/POST /api/vater/rules,
 * PUT /api/vater/rules/[code], POST /api/vater/rules/character-seed). Every
 * render fetches the same JSON at start and stamps its `version`, so what you
 * read here is exactly what the planner, the Fable runner and the delivery
 * audit read. Rule numbers are permanent.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { useTier } from '../../tier-context';
import { VCard, SectionHeader, VBtn, RetryError } from '../../primitives';
import { relativeTimeLabel } from '@/lib/vater/concierge-client';

export type RuleGate = 'hard' | 'advisory' | 'planner' | 'info';
export type RuleScope = 'global' | 'house' | 'owner';
export type RuleKind = 'video' | 'script';

export interface RuleRow {
  code: string;
  display: string;
  scope: RuleScope;
  kind: RuleKind;
  ownerId: string | null;
  characterId: string | null;
  templateKey: string | null;
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
  scopes: RuleScope[];
  ownerId: string | null;
  sections: { scope: RuleScope; number: number; title: string }[];
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
export function Inline({ text, color }: { text: string; color: string }): React.ReactElement {
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

export async function fetchRules(scope: RuleScope | RuleScope[] = ['global', 'house', 'owner']): Promise<RulesPayload> {
  const s = Array.isArray(scope) ? scope.join(',') : scope;
  // kind=video,script — this screen is the ONE place that shows both buckets.
  // Every other caller (planner, audit, Fable runner) omits `kind` and keeps
  // getting video only.
  const res = await fetch(`/api/vater/rules?includeRetired=1&kind=video,script&scope=${encodeURIComponent(s)}`, { cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as RulesPayload & { error?: string };
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export type Draft = { title: string; body: string; gate: RuleGate; source: string; retired: boolean; retiredNote: string };

export function useInputStyle(): React.CSSProperties {
  const { t } = useTheme();
  return {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: JELLY_TOKENS.radius.sm,
    border: `1px solid ${JELLY_TOKENS.brandOutline}`, background: t.hover, color: t.text, fontSize: 13, fontFamily: 'inherit',
  };
}

/** One rule row with the inline editor — shared by the Rules tabs and the character drawer. */
export function RuleRowView({
  r, canEdit, onSaved, groupLabel,
}: { r: RuleRow; canEdit: boolean; onSaved: () => Promise<void> | void; groupLabel?: string }): React.ReactElement {
  const { t } = useTheme();
  const inputStyle = useInputStyle();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const retired = !!r.retiredAt;

  const startEdit = () => {
    if (!canEdit || editing) return;
    setSaveError(null);
    setDraft({ title: r.title, body: r.body, gate: r.gate, source: r.source ?? '', retired, retiredNote: r.retiredNote ?? '' });
    setEditing(true);
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      const patch: Record<string, unknown> = { title: draft.title, body: draft.body, gate: draft.gate, source: draft.source || null };
      if (draft.retired !== retired) patch.retiredAt = draft.retired;
      if (draft.retired) patch.retiredNote = draft.retiredNote || null;
      const res = await fetch(`/api/vater/rules/${encodeURIComponent(r.code)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      const out = (await res.json().catch(() => ({}))) as { rule?: RuleRow; error?: string };
      if (!res.ok || !out.rule) throw new Error(out.error || `HTTP ${res.status}`);
      setEditing(false);
      setDraft(null);
      await onSaved();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid={`rule-${r.code}`}
      onClick={startEdit}
      style={{
        display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12, padding: '10px 16px',
        borderTop: `1px solid ${JELLY_TOKENS.brandGhost}`,
        borderLeft: `3px solid ${GATE_COLOR[r.gate]}`,
        cursor: canEdit && !editing ? 'pointer' : 'default',
        opacity: retired ? 0.55 : 1,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 700, fontSize: 13, color: t.text }}>{r.scope === 'house' ? `#${r.display}` : r.display}</span>
        <GatePill gate={r.gate} small />
      </div>
      {!editing ? (
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
            {groupLabel && <span style={{ color: JELLY_TOKENS.cyan }}>{groupLabel}</span>}
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
            <VBtn variant="primary" size="sm" onClick={() => void save()} disabled={saving || !draft.title.trim()} data-testid={`rule-save-${r.code}`}>{saving ? 'Saving…' : 'Save'}</VBtn>
            <VBtn variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(null); }}>Cancel</VBtn>
            <span style={{ fontSize: 11, color: t.textSecondary, alignSelf: 'center' }}>{r.display} is permanent · every save is recorded with your name</span>
          </div>
          {saveError && <div style={{ color: JELLY_TOKENS.error, fontSize: 12 }}>{saveError}</div>}
        </div>
      )}
    </div>
  );
}

/** Add-rule form (scope-aware). */
export function AddRuleForm({
  scope, kind = 'video', sections, characterId, characterName, onAdded, onClose,
}: {
  scope: RuleScope;
  /** Which bucket the new rule joins. Numbering is per (scope, kind), so a new
   *  script rule is S29 and a new house video rule is 160. */
  kind?: RuleKind;
  sections: { number: number; title: string }[];
  characterId?: string | null;
  characterName?: string;
  onAdded: () => Promise<void> | void;
  onClose: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const inputStyle = useInputStyle();
  const [draft, setDraft] = React.useState<{ section: number; title: string; body: string; gate: RuleGate; source: string }>({
    section: sections[0]?.number ?? (characterId ? 2 : 1), title: '', body: '', gate: 'planner', source: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const add = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/vater/rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, scope, kind, ...(characterId ? { characterId } : {}) }),
      });
      const out = (await res.json().catch(() => ({}))) as { rule?: RuleRow; error?: string };
      if (!res.ok || !out.rule) throw new Error(out.error || `HTTP ${res.status}`);
      await onAdded();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'add failed');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: JELLY_TOKENS.radius.md, border: `1px dashed ${JELLY_TOKENS.brandOutline}` }} data-testid="rules-add-form">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {scope !== 'owner' && (
          <select value={draft.section} onChange={(e) => setDraft({ ...draft, section: Number(e.target.value) })} style={{ ...inputStyle, width: 320 }}>
            {sections.map((s) => <option key={s.number} value={s.number}>{s.number}. {s.title}</option>)}
          </select>
        )}
        {scope === 'owner' && (
          <span style={{ fontSize: 12, color: t.textSecondary, alignSelf: 'center' }}>{characterName ? `Rule for ${characterName}` : 'A rule for all your videos'}</span>
        )}
        <select value={draft.gate} onChange={(e) => setDraft({ ...draft, gate: e.target.value as RuleGate })} style={{ ...inputStyle, width: 140 }}>
          {GATES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Rule title (one sentence)" style={inputStyle} data-testid="rules-add-title" />
      <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Body — what exactly the renderer must do" rows={4} style={inputStyle} />
      <input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="Source (who / why) — optional" style={inputStyle} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <VBtn variant="primary" size="sm" onClick={() => void add()} disabled={saving || !draft.title.trim()} data-testid="rules-add-submit">Add as next number</VBtn>
        <VBtn variant="ghost" size="sm" onClick={onClose}>Cancel</VBtn>
        <span style={{ fontSize: 12, color: t.textSecondary }}>Gets the next permanent number — numbers are never reused.</span>
      </div>
      {err && <div style={{ color: JELLY_TOKENS.error, fontSize: 13 }}>{err}</div>}
    </div>
  );
}

/* Four tabs, two axes. 'global' | 'owner' | 'house' select a SCOPE within the
 * video rulebook; 'script' is the other KIND — the Script Rules 2.0 rewriting
 * pack the script writer injects before it rewrites a transcript (Trey brief
 * 2026-08-27, ship item 6: two buckets he edits himself). */
type Tab = 'global' | 'owner' | 'house' | 'script';

const TAB_SCOPE: Record<Tab, RuleScope> = { global: 'global', owner: 'owner', house: 'house', script: 'house' };
const TAB_KIND: Record<Tab, RuleKind> = { global: 'video', owner: 'video', house: 'video', script: 'script' };

const TAB_COPY: Record<Tab, { label: string; blurb: string }> = {
  global: { label: 'Global', blurb: 'Global production rules — every render on Jelly Studio reads these. Your own rules (My rules) and your character rules are layered on top.' },
  owner: { label: 'My rules', blurb: 'Your rules, layered on top of the Global rulebook for every video you render — including the rules created for each character you build. Only you (and your renders) see them.' },
  house: { label: 'House', blurb: 'The studio rulebook — the numbered house rules (locked host, keys, billing, infra). Studio accounts only.' },
  script: { label: 'Script rules', blurb: 'How a source transcript gets rewritten — length, host and cast names, the standing greeting, number handling, punctuation, what to cut, and the originality bar. The writer reads these verbatim before it writes a word. Edit one and re-run the rewrite; nothing else in the pipeline changes.' },
};

export function RulesScreen(): React.ReactElement {
  const { t } = useTheme();
  const { tier, capabilities, loading: tierLoading } = useTier();
  const studio = capabilities.houseRules || tier === 'studio' || tier === 'owner';

  const [tab, setTab] = React.useState<Tab>('global');
  const [data, setData] = React.useState<RulesPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'all' | RuleGate>('all');
  const [q, setQ] = React.useState('');
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setData(await fetchRules(studio ? ['global', 'house', 'owner'] : ['global', 'owner']));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error');
    }
  }, [studio]);
  React.useEffect(() => { if (!tierLoading) void load(); }, [load, tierLoading]);

  const canEdit = tab === 'owner' ? true : studio;
  const tabRules = React.useMemo(
    () => (data?.rules ?? []).filter((r) => r.scope === TAB_SCOPE[tab] && (r.kind ?? 'video') === TAB_KIND[tab]),
    [data, tab],
  );
  const lastEdit = React.useMemo(() => tabRules.reduce<RuleRow | null>((m, r) => (!m || r.updatedAt > m.updatedAt ? r : m), null), [tabRules]);

  const visible = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tabRules.filter((r) => {
      if (filter !== 'all' && r.gate !== filter) return false;
      if (!needle) return true;
      return `${r.display} ${r.title} ${r.body} ${r.source ?? ''}`.toLowerCase().includes(needle);
    });
  }, [tabRules, filter, q]);

  /* Group key: section for global/house; for owner rules, the character (or "My rules"). */
  const groups = React.useMemo(() => {
    const m = new Map<string, { key: string; title: string; rows: RuleRow[] }>();
    for (const r of visible) {
      const key = tab === 'owner' ? (r.characterId ? `c:${r.characterId}` : 'mine') : `s:${r.section}`;
      if (!m.has(key)) {
        const title = tab === 'owner'
          ? (r.characterId ? `Character · ${(r.source ?? '').replace(/^character template · /, '') || r.characterId}` : 'My rules — every video')
          : `§${r.section} ${r.sectionTitle}`;
        m.set(key, { key, title, rows: [] });
      }
      m.get(key)!.rows.push(r);
    }
    return [...m.values()];
  }, [visible, tab]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const r of tabRules) {
      if (r.retiredAt) continue;
      c.all++;
      c[r.gate] = (c[r.gate] ?? 0) + 1;
    }
    return c;
  }, [tabRules]);

  const tabCounts = React.useMemo(() => {
    const c: Record<Tab, number> = { global: 0, owner: 0, house: 0, script: 0 };
    for (const r of data?.rules ?? []) {
      if (r.retiredAt) continue;
      const k = (r.kind ?? 'video') === 'script' ? 'script' : (r.scope as Tab);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const sectionsForTab = (data?.sections ?? []).filter((s) => s.scope === TAB_SCOPE[tab]);
  const inputStyle = useInputStyle();
  const tabs: Tab[] = studio ? ['global', 'owner', 'house', 'script'] : ['global', 'owner'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="description"
        title="Rules"
        description="The numbered production rulebook — the ONLINE source of truth. Every render fetches the Global rules plus your own at start and stamps the version it obeyed."
        actionLabel={studio ? 'Download house PDF' : undefined}
        onAction={studio ? () => { window.open('/api/vater/rules?format=pdf&download=1', '_blank'); } : undefined}
      />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-testid="rules-tabs">
        {tabs.map((tb) => {
          const on = tab === tb;
          return (
            <button
              key={tb}
              type="button"
              data-testid={`rules-tab-${tb}`}
              onClick={() => { setTab(tb); setFilter('all'); setAdding(false); }}
              style={{
                cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: JELLY_TOKENS.radius.pill,
                color: on ? JELLY_TOKENS.brandLight : t.textSecondary,
                border: `1px solid ${on ? JELLY_TOKENS.brand : JELLY_TOKENS.brandOutline}`,
                background: on ? JELLY_TOKENS.brandGhost : 'transparent',
              }}
            >
              {TAB_COPY[tb].label} · {tabCounts[tb]}
            </button>
          );
        })}
      </div>

      {error && <RetryError message={error} onRetry={() => void load()} />}

      {data && (
        <VCard style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{TAB_COPY[tab].blurb}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }} data-testid="rules-header">
            <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, padding: '2px 8px', borderRadius: JELLY_TOKENS.radius.pill, background: JELLY_TOKENS.brandGhost, border: `1px solid ${JELLY_TOKENS.brandOutline}`, color: t.text }} title="Content hash over every active rule you can see — the id each of your renders records">
              v{data.version}
            </span>
            <span style={{ fontSize: 13, color: t.textSecondary }}>{counts.all} active {TAB_COPY[tab].label.toLowerCase()} rules</span>
            {lastEdit && (
              <span style={{ fontSize: 12, color: t.textSecondary }}>
                last edit {relativeTimeLabel(lastEdit.updatedAt)} by {lastEdit.updatedBy ?? '—'} ({lastEdit.display})
              </span>
            )}
            <span style={{ flex: 1 }} />
            {canEdit && (
              <VBtn variant="primary" size="sm" onClick={() => setAdding((v) => !v)} data-testid="rules-add">
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
            <AddRuleForm scope={TAB_SCOPE[tab]} kind={TAB_KIND[tab]} sections={sectionsForTab} onAdded={load} onClose={() => setAdding(false)} />
          )}
        </VCard>
      )}

      {data && tab === 'owner' && !tabRules.length && (
        <VCard variant="flat" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>No rules of your own yet</div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 6, lineHeight: 1.6 }}>
            Build a character on the Characters tab and it gets its own rules automatically — or add a rule here that applies to every video you render.
          </div>
        </VCard>
      )}

      {data && groups.map((g) => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <VCard key={g.key} style={{ padding: 0, overflow: 'hidden' }} data-testid={`rules-group-${g.key}`}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: t.hover, border: 'none', color: t.text }}
            >
              <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{g.title}</span>
              <span style={{ fontSize: 12, color: t.textSecondary }}>{g.rows.length} · {isCollapsed ? 'show' : 'hide'}</span>
            </button>
            {!isCollapsed && g.rows.map((r) => <RuleRowView key={r.code} r={r} canEdit={canEdit} onSaved={load} />)}
          </VCard>
        );
      })}
    </div>
  );
}
