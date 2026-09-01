'use client';

/* CopyCharacterToStudio — destination picker for an already-minted character.
 *
 * Shown when the account-global `characterStudioCopy` setting is on. Posts
 * to the existing adopt route (free): name, description, imageUrl,
 * permanent: true, placeInEveryImage: false. Prefers the Postgres row on
 * the source style when we know it, so imageUrl is copied as-is.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn } from '../../primitives';
import { canCopyOntoStyle } from '@/lib/vater/character-studio-copy';

export interface CopyableCharacter {
  name: string;
  description: string;
  imageUrl: string | null;
  sourceStyleId?: string | null;
}

interface OwnStyle {
  id: string;
  name: string;
  isSystem: boolean;
  userId?: string | null;
}

interface CopyCharacterToStudioProps {
  character: CopyableCharacter;
  /** Session user id — destinations must be this owner. */
  ownerUserId?: string | null;
  onCopied?: (dest: { id: string; name: string; updated: boolean }) => void;
}

export function CopyCharacterToStudio({
  character,
  ownerUserId,
  onCopied,
}: CopyCharacterToStudioProps): React.ReactElement {
  const { t } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [styles, setStyles] = React.useState<OwnStyle[] | null>(null);
  const [destId, setDestId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const dests = React.useMemo(() => {
    const rows = styles ?? [];
    return rows.filter((s) => {
      if (character.sourceStyleId && s.id === character.sourceStyleId) return false;
      if (s.isSystem) return false;
      if (ownerUserId) {
        return canCopyOntoStyle({
          isSystem: s.isSystem,
          userId: s.userId ?? ownerUserId,
          ownerUserId,
        });
      }
      return true;
    });
  }, [styles, character.sourceStyleId, ownerUserId]);

  const loadStyles = React.useCallback(async () => {
    if (styles) return;
    try {
      const r = await fetch('/api/vater/youtube/styles', { cache: 'no-store' });
      const data = (await r.json().catch(() => ({}))) as { styles?: OwnStyle[] };
      const own = (data.styles ?? []).filter((s) => !s.isSystem);
      setStyles(own);
      const first = own.find((s) => s.id !== character.sourceStyleId);
      if (first) setDestId(first.id);
    } catch {
      setStyles([]);
    }
  }, [styles, character.sourceStyleId]);

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    setNotice(null);
    setOpen((prev) => !prev);
    void loadStyles();
  };

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!destId || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let name = character.name.trim();
      let description = character.description.trim();
      let imageUrl = character.imageUrl;

      if (character.sourceStyleId) {
        try {
          const src = await fetch(
            `/api/vater/youtube/styles/${encodeURIComponent(character.sourceStyleId)}/characters`,
            { cache: 'no-store' },
          );
          if (src.ok) {
            const data = (await src.json()) as {
              characters?: Array<{ name: string; description: string; imageUrl: string | null }>;
            };
            const row = (data.characters ?? []).find(
              (c) => c.name.trim().toLowerCase() === name.toLowerCase(),
            );
            if (row) {
              name = row.name;
              if (row.description.trim().length >= 50) description = row.description.trim();
              if (row.imageUrl) imageUrl = row.imageUrl;
            }
          }
        } catch {
          /* adopt with the library fields we already have */
        }
      }

      const r = await fetch(
        `/api/vater/youtube/styles/${encodeURIComponent(destId)}/characters/adopt`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            imageUrl,
            permanent: true,
            placeInEveryImage: false,
          }),
        },
      );
      const data = (await r.json().catch(() => ({}))) as {
        error?: string;
        updated?: boolean;
      };
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const dest = dests.find((s) => s.id === destId);
      const destName = dest?.name ?? 'that studio';
      const updated = data.updated === true;
      setNotice(
        updated
          ? `Updated “${name}” on ${destName}.`
          : `Copied “${name}” to ${destName}.`,
      );
      onCopied?.({ id: destId, name: destName, updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy the character');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <VBtn
        size="sm"
        variant="ghost"
        icon="duplicate"
        data-testid="copy-character-to-studio"
        onClick={openPicker}
      >
        {open ? 'Cancel copy' : 'Copy to studio'}
      </VBtn>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {styles === null ? (
            <div style={{ fontSize: 12, color: t.textFaint }}>Loading studios…</div>
          ) : dests.length === 0 ? (
            <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
              No other studio you own to copy onto. Clone or create one under Styles
              first — system studios can&apos;t receive a copy.
            </div>
          ) : (
            <>
              <label
                style={{
                  fontSize: 12,
                  color: t.textSecondary,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                Destination studio
                <select
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                  data-testid="copy-character-dest"
                  style={{
                    padding: '9px 12px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: `1px solid ${t.borderStrong}`,
                    background: t.cardAlt,
                    color: t.text,
                    fontSize: 13,
                    fontFamily: JELLY_TOKENS.font,
                  }}
                >
                  {dests.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <VBtn size="sm" variant="outlined" disabled={busy || !destId} onClick={(e) => void copy(e)}>
                {busy ? 'Copying…' : 'Copy — no charge'}
              </VBtn>
            </>
          )}
        </div>
      )}
      {notice ? (
        <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>{notice}</div>
      ) : null}
      {error ? (
        <div style={{ fontSize: 12, color: JELLY_TOKENS.error, lineHeight: 1.5 }}>{error}</div>
      ) : null}
    </div>
  );
}
