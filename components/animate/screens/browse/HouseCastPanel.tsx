'use client';

/* HouseCastPanel — the canon cast, pinned above the minted-character library.
 *
 * Jeff Whitfield is not "a character you made in the app": he is the locked
 * host of every Vater video, hand-built over months, and his identity lives in
 * ~/vater-studio/characters/<slug>/ + VATER-STANDING-SPEC.json. Until now only
 * the renderer could read that — the Characters screen listed the Character Lab
 * sidecar registry, so the studio UI showed QA smoke tests and auto-minted
 * mentors while the one character that matters was invisible. Trey could not
 * see who a render would use, and every create-video run made him re-pick a
 * style with no signal that the wrong pick swaps the host.
 *
 * This panel is READ-ONLY on canon by design: the spec files stay the single
 * source of truth. "Clone & tweak" copies the descriptor into a NEW character
 * on a NEW style — the green-hair-for-a-day path — and never mutates Jeff.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, RetryError } from '../../primitives';
import { Icon } from '../../Icon';
import { ImageLightbox } from '../../ImageLightbox';
import type { PreselectedCharacter } from '../dashboard/StyleWizardModal';

export interface CanonCastMember {
  id: string;
  slug: string;
  name: string;
  role: 'host' | 'supporting';
  gender: string;
  aliases: string[];
  age: string;
  occupation: string;
  descriptor: string;
  wardrobe: { rule: string; outfits: string[]; count: number };
  invariants: string[];
  referenceUrl: string | null;
  placeInEveryImage: boolean;
  status: string;
  approved: boolean;
  note: string;
  formerNames: string[];
}

interface RosterPayload {
  available?: boolean;
  unavailable?: boolean;
  specVersion?: number;
  specUpdated?: string;
  lockedStyleName?: string;
  artStyle?: string;
  roster?: CanonCastMember[];
  error?: string;
}

const GOLD = JELLY_TOKENS.canon;

export interface HouseCastPanelProps {
  /** Opens the style wizard with this character prefilled (clone & tweak). */
  onClone: (c: PreselectedCharacter) => void;
  cloning?: boolean;
}

export function HouseCastPanel({
  onClone,
  cloning,
}: HouseCastPanelProps): React.ReactElement | null {
  const { t } = useTheme();
  const [data, setData] = React.useState<RosterPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<{ src: string; caption?: string } | null>(
    null,
  );
  /* Clone editor: a verbatim copy of the canon descriptor the user edits by
     hand. Canon itself is never touched — that is the whole point. */
  const [clone, setClone] = React.useState<{
    source: string;
    name: string;
    descriptor: string;
  } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vater/roster', { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as RosterPayload;
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const roster = data?.roster ?? [];

  // A tenant with no house cast gets no panel at all — never an empty box.
  if (loading) return null;
  if (error) {
    return <RetryError message={`Could not load the house cast — ${error}`} onRetry={load} />;
  }
  if (!data?.available || roster.length === 0) return null;

  const host = roster.find((c) => c.role === 'host') ?? roster[0];
  const supporting = roster.filter((c) => c.id !== host.id);

  const briefFor = (c: CanonCastMember): string =>
    c.descriptor.trim().length >= 8
      ? c.descriptor.trim()
      : `${c.name} — locked cast member carried over from the standing spec.`;

  const card = (c: CanonCastMember, isHost: boolean): React.ReactElement => {
    const open = openId === c.id;
    return (
      <VCard
        key={c.id}
        variant="flat"
        data-testid={`house-cast-${c.slug}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          border: isHost
            ? `1px solid ${GOLD}`
            : `1px solid ${c.approved ? t.border : JELLY_TOKENS.warning}`,
          boxShadow: isHost ? `0 0 0 1px ${GOLD}22, 0 10px 30px ${GOLD}14` : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div
            style={{
              width: isHost ? 132 : 84,
              height: isHost ? 132 : 84,
              flex: '0 0 auto',
              borderRadius: JELLY_TOKENS.radius.md,
              background: t.cardAlt,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {c.referenceUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={c.referenceUrl}
                alt={`${c.name} — locked reference`}
                title="Click to view full screen"
                onClick={() =>
                  setLightbox({ src: c.referenceUrl!, caption: `${c.name} — locked reference` })
                }
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  cursor: 'zoom-in',
                }}
              />
            ) : (
              <Icon name="lock" size={isHost ? 30 : 22} color={t.textSecondary} />
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {isHost && <span style={{ fontSize: 15, lineHeight: 1 }}>⭐</span>}
              <span style={{ fontSize: isHost ? 17 : 15, fontWeight: 700, color: t.text }}>
                {c.name}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  padding: '2px 8px',
                  borderRadius: JELLY_TOKENS.radius.pill,
                  color: isHost ? GOLD : c.approved ? JELLY_TOKENS.success : JELLY_TOKENS.warning,
                  border: `1px solid ${
                    isHost ? GOLD : c.approved ? JELLY_TOKENS.success : JELLY_TOKENS.warning
                  }55`,
                  background: `${
                    isHost ? GOLD : c.approved ? JELLY_TOKENS.success : JELLY_TOKENS.warning
                  }14`,
                  textTransform: 'uppercase',
                }}
              >
                {isHost
                  ? 'Locked host · every video'
                  : c.approved
                    ? 'Locked'
                    : 'Pending critique'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>
              {[c.occupation, c.age, c.wardrobe.count ? `${c.wardrobe.count} outfits` : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.textSecondary,
                lineHeight: 1.55,
                marginTop: 8,
                ...(open
                  ? {}
                  : {
                      display: '-webkit-box',
                      WebkitLineClamp: isHost ? 4 : 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }),
              }}
            >
              {c.descriptor || 'No descriptor file found for this cast member.'}
            </div>
          </div>
        </div>

        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
            {c.invariants.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                  Never changes
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12,
                    color: t.textSecondary,
                    lineHeight: 1.6,
                  }}
                >
                  {c.invariants.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            )}
            {c.wardrobe.outfits.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                  Wardrobe — one outfit per act ({c.wardrobe.count})
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12,
                    color: t.textSecondary,
                    lineHeight: 1.6,
                  }}
                >
                  {c.wardrobe.outfits.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
            {c.formerNames.length > 0 && (
              <div style={{ fontSize: 11, color: t.textFaint }}>
                Formerly: {c.formerNames.join(', ')}
              </div>
            )}
            {c.note && (
              <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>{c.note}</div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          <VBtn
            size="sm"
            variant="text"
            onClick={() => setOpenId((prev) => (prev === c.id ? null : c.id))}
          >
            {open ? 'Hide details' : 'Full identity, wardrobe & rules'}
          </VBtn>
          <VBtn
            size="sm"
            variant="outlined"
            icon="duplicate"
            disabled={cloning}
            onClick={() =>
              setClone({
                source: c.name,
                name: `${c.name} (variant)`,
                descriptor: c.descriptor,
              })
            }
          >
            {cloning ? 'Opening…' : 'Clone & tweak'}
          </VBtn>
        </div>
      </VCard>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <VCard
        variant="flat"
        style={{
          padding: 16,
          border: `1px solid ${GOLD}44`,
          background: `linear-gradient(120deg, ${GOLD}0F, transparent 60%)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>⭐</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
            House cast — locked canon
          </span>
          {data.lockedStyleName && (
            <span
              style={{
                fontSize: 11,
                color: t.textSecondary,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.pill,
                padding: '2px 8px',
              }}
            >
              {data.lockedStyleName}
              {data.artStyle ? ` · ${data.artStyle}` : ''}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: t.textSecondary, marginTop: 8, lineHeight: 1.6 }}>
          These are the characters every Vater video is built around. Their faces, hair, skin and
          build are locked and identical in every scene — only wardrobe varies, one outfit per act.
          They are read-only here on purpose: identity lives in the standing spec, so nothing in the
          studio can drift it. Use <strong>Clone &amp; tweak</strong> for a one-off variant.
        </div>
        {(data.specVersion || data.specUpdated) && (
          <div style={{ fontSize: 11, color: t.textFaint, marginTop: 6 }}>
            Standing spec v{data.specVersion ?? '?'}
            {data.specUpdated ? ` · updated ${data.specUpdated}` : ''}
          </div>
        )}
      </VCard>

      {card(host, true)}

      {supporting.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, marginTop: 2 }}>
            Supporting cast — appears only when the script names them
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 12,
            }}
          >
            {supporting.map((c) => card(c, false))}
          </div>
        </>
      )}

      {clone && (
        <VCard variant="flat" style={{ padding: 16, border: `1px solid ${GOLD}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            Clone {clone.source} — edit anything you like
          </div>
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 6, lineHeight: 1.6 }}>
            This is {clone.source}&apos;s locked identity, copied word for word. Change what you want
            (&ldquo;salt-and-pepper hair&rdquo; → &ldquo;bright green hair&rdquo;) and it is saved
            exactly as you type it — nothing is re-written by a model, and nothing here touches the
            canon {clone.source} your real videos use.
          </div>
          <input
            value={clone.name}
            onChange={(e) => setClone({ ...clone, name: e.target.value })}
            placeholder="Name for the variant"
            style={{
              width: '100%',
              marginTop: 12,
              padding: '9px 11px',
              fontSize: 13,
              color: t.text,
              background: t.cardAlt,
              border: `1px solid ${t.border}`,
              borderRadius: JELLY_TOKENS.radius.md,
            }}
          />
          <textarea
            value={clone.descriptor}
            onChange={(e) => setClone({ ...clone, descriptor: e.target.value })}
            rows={8}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '9px 11px',
              fontSize: 12.5,
              lineHeight: 1.6,
              color: t.text,
              background: t.cardAlt,
              border: `1px solid ${t.border}`,
              borderRadius: JELLY_TOKENS.radius.md,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ fontSize: 11, color: t.textFaint, marginTop: 6 }}>
            {clone.descriptor.trim().length} characters — describe what the frame should CONTAIN;
            never use &ldquo;not&rdquo; or &ldquo;never&rdquo;, image models summon what you negate.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <VBtn
              size="sm"
              disabled={
                cloning ||
                clone.descriptor.trim().length < 50 ||
                clone.name.trim().length === 0
              }
              onClick={() => {
                onClone({
                  name: clone.name.trim(),
                  brief: briefFor({ ...host, name: clone.name, descriptor: clone.descriptor }),
                  exactDescriptor: clone.descriptor.trim(),
                });
                setClone(null);
              }}
            >
              Use in a new style
            </VBtn>
            <VBtn size="sm" variant="text" onClick={() => setClone(null)}>
              Cancel
            </VBtn>
          </div>
        </VCard>
      )}

      <ImageLightbox
        src={lightbox?.src ?? null}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
