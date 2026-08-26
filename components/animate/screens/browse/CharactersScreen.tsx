'use client';

/* CharactersScreen — the cast you've minted, in one place.
 *
 * Characters live on the DGX (one library per owner), not in Postgres, so
 * this is a read-only view over GET /api/vater/characters. A character can
 * be carried into a NEW style — that's what "Use in new project" does: it
 * opens the Style wizard with the character preselected, and the wizard
 * mints it onto the style it creates.
 *
 * Two empty states, deliberately different:
 *   - the box hasn't shipped the endpoint yet (`unavailable`) → say the
 *     library is coming online, don't imply the user has no characters.
 *   - the call worked and returned nothing → say how to make one.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard, RetryError, SectionHeader } from '../../primitives';
import { Icon } from '../../Icon';
import {
  StyleWizardModal,
  type CreatedStyle,
  type PreselectedCharacter,
} from '../dashboard/StyleWizardModal';
import { CharacterLab } from './CharacterLab';
import { HouseCastPanel } from './HouseCastPanel';
import { RulesBanner } from './RulesBanner';
import { CharacterRulesDrawer, useOwnerRules, type CharacterRef } from './CharacterRules';
import { ImageLightbox } from '../../ImageLightbox';

interface VaterCharacter {
  id: string;
  name: string;
  descriptor: string;
  previewUrl: string | null;
  styleId: string | null;
}

export function CharactersScreen(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute, setEditorStep, setSelectedProjectId } = useRoute();

  const [characters, setCharacters] = React.useState<VaterCharacter[] | null>(
    null,
  );
  const [unavailable, setUnavailable] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [wizardFor, setWizardFor] = React.useState<PreselectedCharacter | null>(
    null,
  );
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<{ src: string; caption?: string } | null>(null);
  /* Cards with no preview image expand their descriptor in place instead. */
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  /* Per-character rule subset (2026-08-25 PM): owner-scope rules pinned to
     the character; the drawer edits them and seeds the template. */
  const ownerRules = useOwnerRules();
  const [rulesFor, setRulesFor] = React.useState<CharacterRef | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vater/characters', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as {
        characters?: VaterCharacter[];
        unavailable?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCharacters(Array.isArray(data.characters) ? data.characters : []);
      setUnavailable(data.unavailable === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* Wizard finished → open a project on the new style and drop the user at
     the Script step, same landing as every other "start a video" path. */
  const handleStyleCreated = React.useCallback(
    async (style: CreatedStyle) => {
      setWizardFor(null);
      setCreating(true);
      setCreateError(null);
      try {
        const res = await fetch('/api/vater/youtube/new-from-style', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ styleId: style.id }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          project?: { id?: string };
          error?: string;
        };
        const projectId = data.project?.id;
        if (!res.ok || !projectId) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setSelectedProjectId(projectId);
        setEditorStep(1);
        setRoute('editor');
      } catch (err) {
        setCreateError(
          err instanceof Error
            ? `Style created, but the project didn't open: ${err.message}. Start it from the Dashboard.`
            : 'Could not open a project from the new style',
        );
      } finally {
        setCreating(false);
      }
    },
    [setRoute, setEditorStep, setSelectedProjectId],
  );

  const isEmpty = !loading && !error && (characters?.length ?? 0) === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="styles"
        title="Characters"
        description="Your locked house cast first, then every character you've minted. Reuse one in a new video and it keeps the same face across every scene."
      />

      {/* Online rulebook pointer (2026-08-25) — for everyone since the scopes
          landed: the Global rulebook + your own rules, the same JSON every
          render fetches, so the version shown here is what the next render
          will obey. */}
      <RulesBanner />

      {/* Canon roster (2026-08-22). Pinned ABOVE the Lab because it is the
          answer to "who is in my videos" — the minted library below is the
          scratch space. Renders nothing on accounts with no house cast. */}
      <HouseCastPanel onClone={setWizardFor} cloning={creating} />

      <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary }}>
        Your minted characters
      </div>

      {/* Character Lab (2026-08-20): generate 3 priced portrait takes or
          import a character image — the cheap audition instead of $7 test
          renders. */}
      <CharacterLab onCharacterSaved={() => void load()} />

      {loading && (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            fontSize: 13,
            color: t.textSecondary,
          }}
        >
          Loading your characters…
        </div>
      )}

      {error && (
        <RetryError
          message={`Could not load your characters — ${error}`}
          onRetry={load}
        />
      )}

      {createError && (
        <div style={{ fontSize: 13, color: JELLY_TOKENS.error }}>
          {createError}
        </div>
      )}

      {isEmpty && (
        <VCard variant="flat" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>
            {unavailable
              ? 'The character library is coming online'
              : 'No characters yet'}
          </div>
          <div
            style={{
              fontSize: 13,
              color: t.textSecondary,
              marginTop: 6,
              lineHeight: 1.6,
            }}
          >
            {unavailable
              ? "Your render box doesn't serve the character library yet. Characters you add to a Style still work exactly as before."
              : 'Characters are minted on a Style. Open a Style and add one — it then shows up here for every future video.'}
          </div>
          <VBtn
            variant="outlined"
            size="sm"
            onClick={() => setRoute('styles')}
            style={{ marginTop: 14 }}
          >
            Go to Styles
          </VBtn>
        </VCard>
      )}

      {characters && characters.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {characters.map((c) => (
            <VCard
              key={c.id}
              variant="flat"
              onClick={() => {
                // The whole card views the character — not just the image
                // (2026-08-20 walkthrough: "when I click on the character it
                // doesn't show me anything").
                if (c.previewUrl) {
                  setLightbox({ src: c.previewUrl, caption: `${c.name} — ${c.descriptor}` });
                } else {
                  setExpandedId((prev) => (prev === c.id ? null : c.id));
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer' }}
            >
              <div
                style={{
                  height: 150,
                  borderRadius: JELLY_TOKENS.radius.md,
                  background: t.cardAlt,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {c.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={c.previewUrl}
                    alt={`${c.name} — click to view full screen`}
                    title="Click to view full screen"
                    onClick={() =>
                      setLightbox({ src: c.previewUrl!, caption: `${c.name} — ${c.descriptor}` })
                    }
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                  />
                ) : (
                  <Icon name="image" size={28} color={t.textSecondary} />
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>
                {c.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: t.textSecondary,
                  lineHeight: 1.5,
                  ...(expandedId === c.id
                    ? {}
                    : {
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                      }),
                }}
              >
                {c.descriptor || 'No descriptor recorded.'}
              </div>
              <VBtn
                size="sm"
                variant="ghost"
                data-testid={`character-rules-${c.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setRulesFor({ id: c.id, name: c.name, descriptor: c.descriptor });
                }}
              >
                {`Rules (${(ownerRules.byCharacter.get(c.id) ?? []).filter((r) => !r.retiredAt).length})`}
              </VBtn>
              <VBtn
                size="sm"
                variant="outlined"
                icon="sparkle"
                disabled={creating}
                onClick={(e) => {
                  e.stopPropagation();
                  setWizardFor({
                    name: c.name,
                    // The wizard's character endpoint expects a brief it can
                    // expand; the stored descriptor IS that brief, and it has
                    // to clear the route's 8-character minimum.
                    brief:
                      c.descriptor.trim().length >= 8
                        ? c.descriptor.trim()
                        : `${c.name} — recurring character carried over from the character library.`,
                  });
                }}
              >
                {creating ? 'Opening…' : 'Use in new project'}
              </VBtn>
            </VCard>
          ))}
        </div>
      )}

      {rulesFor && (
        <CharacterRulesDrawer
          character={rulesFor}
          rules={ownerRules.byCharacter.get(rulesFor.id) ?? []}
          onChanged={ownerRules.reload}
          onClose={() => setRulesFor(null)}
        />
      )}
      <ImageLightbox
        src={lightbox?.src ?? null}
        caption={lightbox?.caption}
        onClose={() => setLightbox(null)}
      />
      <StyleWizardModal
        open={wizardFor !== null}
        onClose={() => setWizardFor(null)}
        onCreated={(style) => void handleStyleCreated(style)}
        initialCharacters={wizardFor ? [wizardFor] : undefined}
      />
    </div>
  );
}
