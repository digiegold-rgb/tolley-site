'use client';

/* CharacterRules — a character's OWN rule subset (2026-08-25 PM).
 *
 * When a user builds a character it gets its own rules, instantiated from the
 * character template (name / attire / role / invariants) as owner-scope rules
 * pinned to the character. This drawer lists + edits them and offers "Seed
 * rules" when a character has none. Every render for this owner fetches these
 * alongside the Global rulebook.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, RetryError } from '../../primitives';
import { AddRuleForm, RuleRowView, fetchRules, type RuleRow } from './RulesScreen';

export interface CharacterRef {
  id: string;
  name: string;
  descriptor?: string;
}

export async function seedCharacterRules(c: CharacterRef): Promise<{ created: number; skipped: number }> {
  const res = await fetch('/api/vater/rules/character-seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId: c.id, name: c.name, descriptor: c.descriptor ?? '' }),
  });
  const out = (await res.json().catch(() => ({}))) as { created?: number; skipped?: number; error?: string };
  if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
  return { created: out.created ?? 0, skipped: out.skipped ?? 0 };
}

/** Hook: owner rules grouped by characterId (null key = "every video"). */
export function useOwnerRules() {
  const [rules, setRules] = React.useState<RuleRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    setError(null);
    try {
      const d = await fetchRules('owner');
      setRules(d.rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error');
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  const byCharacter = React.useMemo(() => {
    const m = new Map<string, RuleRow[]>();
    for (const r of rules ?? []) {
      const k = r.characterId ?? '';
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [rules]);
  return { rules, byCharacter, error, reload: load };
}

export function CharacterRulesDrawer({
  character, rules, onChanged, onClose,
}: { character: CharacterRef; rules: RuleRow[]; onChanged: () => Promise<void> | void; onClose: () => void }): React.ReactElement {
  const { t } = useTheme();
  const [seeding, setSeeding] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const active = rules.filter((r) => !r.retiredAt);

  const seed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const r = await seedCharacterRules(character);
      setNotice(`${r.created} rules created for ${character.name}${r.skipped ? ` (${r.skipped} already existed)` : ''} — review them in Rules → My rules.`);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'seed failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={`Rules for ${character.name}`}
      data-testid="character-rules-drawer"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,4,16,0.55)', display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(680px, 100%)', height: '100%', overflowY: 'auto', background: t.card, borderLeft: `1px solid ${JELLY_TOKENS.brandOutline}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, letterSpacing: '0.26em', textTransform: 'uppercase', color: JELLY_TOKENS.cyan }}>Character rules</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{character.name}</div>
            <div style={{ fontSize: 12, color: t.textSecondary }}>{active.length} active rule{active.length === 1 ? '' : 's'} — layered on the Global rulebook for every video with {character.name}.</div>
          </div>
          <VBtn variant="ghost" size="sm" onClick={onClose}>Close</VBtn>
        </div>

        {error && <RetryError message={error} onRetry={() => void seed()} />}
        {notice && <div style={{ fontSize: 13, color: JELLY_TOKENS.success }}>{notice}</div>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!active.length && (
            <VBtn variant="primary" size="sm" onClick={() => void seed()} disabled={seeding} data-testid="character-rules-seed">
              {seeding ? 'Seeding…' : `Seed rules for ${character.name}`}
            </VBtn>
          )}
          <VBtn variant="outlined" size="sm" onClick={() => setAdding((v) => !v)} data-testid="character-rules-add">{adding ? 'Close' : '+ Add rule'}</VBtn>
          {!!active.length && (
            <VBtn variant="ghost" size="sm" onClick={() => void seed()} disabled={seeding}>
              {seeding ? 'Seeding…' : 'Add missing template rules'}
            </VBtn>
          )}
        </div>

        {adding && (
          <AddRuleForm scope="owner" sections={[{ number: 2, title: 'Character rules' }]} characterId={character.id} characterName={character.name} onAdded={onChanged} onClose={() => setAdding(false)} />
        )}

        {!rules.length ? (
          <VCard variant="flat" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>No rules yet for {character.name}</div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 6, lineHeight: 1.6 }}>
              Seed the standard character rules (identity lock, one outfit per act, never cloned, name never printed on a prop…) written for {character.name}, then edit them however you like.
            </div>
          </VCard>
        ) : (
          <VCard style={{ padding: 0, overflow: 'hidden' }}>
            {rules.map((r) => <RuleRowView key={r.code} r={r} canEdit onSaved={onChanged} />)}
          </VCard>
        )}
      </div>
    </div>
  );
}
