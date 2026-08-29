/**
 * Per-user sidebar order for Jelly Studio (/animate) — pure + client-safe.
 *
 * Every account can drag the nav rows (the ≡ grip on each item) into their
 * own order, including across the STUDIO / ACCOUNT halves. The preference is
 * cosmetic-only: `visibleRoutes()` still decides WHAT this tier may see; this
 * module only decides the ORDER of what survived that filter, so a saved
 * pref can never surface a gated route.
 *
 * Storage is localStorage keyed by the account email (v1 — per browser), or
 * by `ws:<tabId>` inside a studio workspace tab so each tab keeps its own
 * order (components/animate/Sidebar.tsx).
 * Promoting it to a column on User is the follow-up if cross-device sync is
 * ever asked for; the shape below is already JSON-ready for that.
 */

import type { NavRouteDef } from './nav-visibility';

export interface NavOrderPrefs {
  v: 1;
  /** Route ids in the user's chosen order (both sections, top to bottom). */
  order: string[];
  /** Per-route section override; missing id = the route's default section. */
  sections: Record<string, NavRouteDef['section']>;
}

const KEY_PREFIX = 'jelly.nav-order.';

/**
 * Renamed routes: saved layouts keep working without a `v` bump. A pref that
 * still says `queue` renders `progress` in that exact slot (2026-08-28).
 */
const ALIASES: Record<string, string> = { queue: 'progress' };

function aliasId(id: string): string {
  return ALIASES[id] ?? id;
}

export function navPrefsKey(email: string | null | undefined): string {
  return `${KEY_PREFIX}${(email || 'anon').toLowerCase()}`;
}

export function loadNavPrefs(email: string | null | undefined): NavOrderPrefs | null {
  try {
    const raw = window.localStorage.getItem(navPrefsKey(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NavOrderPrefs;
    if (parsed?.v !== 1 || !Array.isArray(parsed.order)) return null;
    const order: string[] = [];
    for (const raw of parsed.order) {
      if (typeof raw !== 'string') continue;
      const id = aliasId(raw);
      // A layout saved while both names existed would list the slot twice.
      if (!order.includes(id)) order.push(id);
    }
    const sections: NavOrderPrefs['sections'] = {};
    if (parsed.sections && typeof parsed.sections === 'object') {
      for (const [raw, section] of Object.entries(parsed.sections)) {
        if (section === 'primary' || section === 'secondary') sections[aliasId(raw)] = section;
      }
    }
    return { v: 1, order, sections };
  } catch {
    return null;
  }
}

export function saveNavPrefs(email: string | null | undefined, prefs: NavOrderPrefs): void {
  try {
    window.localStorage.setItem(navPrefsKey(email), JSON.stringify(prefs));
  } catch {
    /* storage full / blocked — the session keeps the in-memory order */
  }
}

export function clearNavPrefs(email: string | null | undefined): void {
  try {
    window.localStorage.removeItem(navPrefsKey(email));
  } catch {
    /* ignore */
  }
}

/**
 * Order the tier-visible items by the user's preference.
 *
 * - Section comes from `prefs.sections[id]`, else the route's default.
 * - Rank comes from `prefs.order`; ids the pref has never seen (new features
 *   shipped after the pref was saved) keep declaration order and land AFTER
 *   the ranked items of their section — a new nav entry appears at the bottom
 *   of its section instead of resetting the user's layout.
 */
export function applyNavPrefs(
  items: readonly NavRouteDef[],
  prefs: NavOrderPrefs | null,
): { primary: NavRouteDef[]; secondary: NavRouteDef[] } {
  const sectionOf = (i: NavRouteDef): NavRouteDef['section'] =>
    prefs?.sections[i.id] === 'primary' || prefs?.sections[i.id] === 'secondary'
      ? (prefs.sections[i.id] as NavRouteDef['section'])
      : i.section;
  const rank = (i: NavRouteDef, declIdx: number): number => {
    const r = prefs ? prefs.order.indexOf(i.id) : -1;
    return r >= 0 ? r : (prefs?.order.length ?? 0) + declIdx;
  };
  const decorated = items.map((item, declIdx) => ({ item, declIdx }));
  const pick = (section: NavRouteDef['section']): NavRouteDef[] =>
    decorated
      .filter((d) => sectionOf(d.item) === section)
      .sort((a, b) => rank(a.item, a.declIdx) - rank(b.item, b.declIdx))
      .map((d) => d.item);
  return { primary: pick('primary'), secondary: pick('secondary') };
}

/**
 * Rebuild a prefs object from the lists as displayed after a drop.
 * Records EVERY visible id (order + section) so future renders are stable.
 */
export function prefsFromLists(
  primary: readonly NavRouteDef[],
  secondary: readonly NavRouteDef[],
): NavOrderPrefs {
  const sections: NavOrderPrefs['sections'] = {};
  for (const i of primary) sections[i.id] = 'primary';
  for (const i of secondary) sections[i.id] = 'secondary';
  return { v: 1, order: [...primary, ...secondary].map((i) => i.id), sections };
}

/** Move `id` from wherever it is to `index` within `toSection` and return new lists. */
export function moveItem(
  primary: readonly NavRouteDef[],
  secondary: readonly NavRouteDef[],
  id: string,
  toSection: NavRouteDef['section'],
  index: number,
): { primary: NavRouteDef[]; secondary: NavRouteDef[] } | null {
  const all = [...primary, ...secondary];
  const item = all.find((i) => i.id === id);
  if (!item) return null;
  const p = primary.filter((i) => i.id !== id);
  const s = secondary.filter((i) => i.id !== id);
  const target = toSection === 'primary' ? p : s;
  const clamped = Math.max(0, Math.min(index, target.length));
  target.splice(clamped, 0, item);
  return { primary: p, secondary: s };
}
