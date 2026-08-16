'use client';

/* API Keys — mint and manage the credentials for the public video API.
 *
 * The one screen where a secret is displayed. It is shown once, in a panel the
 * user has to dismiss, with a Copy button and an explicit warning — because
 * the key is not stored in plaintext anywhere and there is no "show it again".
 * That is the whole reason this screen is not just a table.
 *
 * Everything else here is deliberately boring: a list, a webhook field, a
 * revoke button, and a copy-paste curl example wired to the user's own most
 * recent key prefix so the example is about THEIR account rather than a
 * placeholder they have to mentally substitute into.
 *
 * Server contract: GET/POST /api/vater/me/keys, PATCH/DELETE
 * /api/vater/me/keys/{id}. All session-gated; an API key cannot manage keys.
 */

import * as React from 'react';

import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon } from '../../Icon';
import { VBtn, VCard, VInput } from '../../primitives';

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  webhookUrl: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function when(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ApiKeys(): React.ReactElement {
  const { t } = useTheme();
  const [keys, setKeys] = React.useState<KeyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notReady, setNotReady] = React.useState(false);

  const [newName, setNewName] = React.useState('');
  const [newHook, setNewHook] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  /* The plaintext key, held in component state ONLY until the user dismisses
   * the panel. Never written to localStorage — a secret that survives a tab
   * close is a secret waiting to be found. */
  const [freshKey, setFreshKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const [hookDraft, setHookDraft] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/vater/me/keys', { cache: 'no-store' });
      if (r.status === 503) {
        setNotReady(true);
        setKeys([]);
        return;
      }
      if (!r.ok) {
        setError(
          r.status === 401
            ? 'Your session expired — sign in again.'
            : 'Could not load your API keys.',
        );
        return;
      }
      const data = (await r.json()) as { keys?: KeyRow[] };
      setNotReady(false);
      setKeys(Array.isArray(data.keys) ? data.keys : []);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const copy = React.useCallback(async (value: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(tag);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Your browser blocked clipboard access — select and copy manually.');
    }
  }, []);

  const create = React.useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const r = await fetch('/api/vater/me/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, webhookUrl: newHook || null }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        key?: string;
        message?: string;
        error?: string;
      };
      if (!r.ok) {
        setError(data.message || data.error || 'Could not create that key.');
        return;
      }
      setFreshKey(data.key ?? null);
      setNewName('');
      setNewHook('');
      await load();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setCreating(false);
    }
  }, [newName, newHook, load]);

  const saveHook = React.useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const value = (hookDraft[id] ?? '').trim();
        const r = await fetch(`/api/vater/me/keys/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl: value || null }),
        });
        const data = (await r.json().catch(() => ({}))) as { message?: string };
        if (!r.ok) {
          setError(data.message || 'Could not save that webhook URL.');
          return;
        }
        setHookDraft((d) => {
          const next = { ...d };
          delete next[id];
          return next;
        });
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [hookDraft, load],
  );

  const revoke = React.useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const r = await fetch(`/api/vater/me/keys/${id}`, { method: 'DELETE' });
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { message?: string };
          setError(data.message || 'Could not revoke that key.');
          return;
        }
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const live = keys.filter((k) => !k.revokedAt);
  /* The example uses the freshly-minted key when there is one on screen, so a
   * first-time integrator can paste a command that actually runs. Otherwise it
   * falls back to a placeholder — we cannot reconstruct an old key. */
  const exampleKey = freshKey ?? 'jly_live_YOUR_KEY';
  const curl = [
    `curl -X POST https://www.tolley.io/api/v1/videos \\`,
    `  -H "Authorization: Bearer ${exampleKey}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"script":"Two hundred thirty seven dollars. That is what sits in your checking account the Tuesday after payday...","title":"The Quiet Exit"}'`,
  ].join('\n');

  const mono = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {notReady && (
        <Banner tone="warn">
          The public API is deployed but its database migration has not been
          applied yet. Keys can be created as soon as it runs.
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}

      {/* ── The one-time secret ─────────────────────────────────────────── */}
      {freshKey && (
        <VCard variant="flat" style={{ borderColor: JELLY_TOKENS.brand }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="lock" size={20} color={JELLY_TOKENS.brand} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                Copy this key now
              </div>
              <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4 }}>
                This is the only time it will ever be shown. We store a hash, not
                the key — if you lose it, revoke it and make another.
              </div>
              <div
                style={{
                  ...mono,
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: JELLY_TOKENS.radius.sm,
                  background: t.cardAlt,
                  color: t.text,
                  wordBreak: 'break-all',
                }}
              >
                {freshKey}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <VBtn size="sm" onClick={() => void copy(freshKey, 'fresh')}>
                  {copied === 'fresh' ? 'Copied' : 'Copy key'}
                </VBtn>
                <VBtn size="sm" variant="ghost" onClick={() => setFreshKey(null)}>
                  I&rsquo;ve saved it
                </VBtn>
              </div>
            </div>
          </div>
        </VCard>
      )}

      {/* ── Create ──────────────────────────────────────────────────────── */}
      <VCard variant="flat">
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
          Create a key
        </div>
        <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4 }}>
          One key per integration, so you can revoke one without breaking the
          others.
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            marginTop: 16,
          }}
        >
          <VInput
            label="Name"
            placeholder="n8n production"
            value={newName}
            onChange={setNewName}
            maxLength={80}
            style={{ flex: '1 1 220px' }}
          />
          <VInput
            label="Webhook URL (optional)"
            placeholder="https://example.com/hooks/jelly"
            helper="POSTed when a render finishes or fails. https only."
            value={newHook}
            onChange={setNewHook}
            maxLength={500}
            style={{ flex: '1 1 300px' }}
          />
          <VBtn
            onClick={() => void create()}
            disabled={creating || notReady}
            icon="plus"
          >
            {creating ? 'Creating…' : 'Create key'}
          </VBtn>
        </div>
      </VCard>

      {/* ── The list ────────────────────────────────────────────────────── */}
      <VCard variant="flat">
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>
          Your keys
        </div>
        <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
          {loading
            ? 'Loading…'
            : live.length === 0
              ? 'No active keys yet.'
              : `${live.length} active.`}
        </div>

        {keys.map((k) => {
          const revoked = !!k.revokedAt;
          const draft = hookDraft[k.id];
          const dirty = draft !== undefined && draft !== (k.webhookUrl ?? '');
          return (
            <div
              key={k.id}
              style={{
                padding: '14px 0',
                borderTop: `1px solid ${t.border}`,
                opacity: revoked ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                    {k.name}
                    {revoked && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          fontWeight: 500,
                          color: JELLY_TOKENS.error,
                        }}
                      >
                        revoked
                      </span>
                    )}
                  </div>
                  <div style={{ ...mono, color: t.textSecondary, marginTop: 2 }}>
                    {k.prefix}…
                  </div>
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, flex: '0 0 auto' }}>
                  created {when(k.createdAt)} · last used {when(k.lastUsedAt)}
                </div>
                {!revoked && (
                  <VBtn
                    size="sm"
                    variant="ghost"
                    disabled={busyId === k.id}
                    onClick={() => void revoke(k.id)}
                  >
                    Revoke
                  </VBtn>
                )}
              </div>

              {!revoked && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-end',
                    marginTop: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <VInput
                    label="Webhook URL"
                    placeholder="https://example.com/hooks/jelly"
                    value={draft ?? k.webhookUrl ?? ''}
                    onChange={(v) => setHookDraft((d) => ({ ...d, [k.id]: v }))}
                    maxLength={500}
                    style={{ flex: '1 1 320px' }}
                  />
                  <VBtn
                    size="sm"
                    variant="outlined"
                    disabled={!dirty || busyId === k.id}
                    onClick={() => void saveHook(k.id)}
                  >
                    Save
                  </VBtn>
                </div>
              )}
            </div>
          );
        })}
      </VCard>

      {/* ── Copy-paste example ──────────────────────────────────────────── */}
      <VCard variant="flat">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
              Make a video from the command line
            </div>
            <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4 }}>
              Returns an id straight away; the render takes 10&ndash;40 minutes.
              Poll <code style={mono}>GET /api/v1/videos/{'{id}'}</code> or set a
              webhook above.
            </div>
          </div>
          <VBtn size="sm" variant="ghost" onClick={() => void copy(curl, 'curl')}>
            {copied === 'curl' ? 'Copied' : 'Copy curl'}
          </VBtn>
        </div>
        <pre
          style={{
            ...mono,
            marginTop: 14,
            marginBottom: 0,
            padding: 14,
            borderRadius: JELLY_TOKENS.radius.sm,
            background: t.cardAlt,
            color: t.text,
            overflowX: 'auto',
            whiteSpace: 'pre',
          }}
        >
          {curl}
        </pre>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 12 }}>
          Full reference for agents:{' '}
          <a
            href="/llms.txt"
            style={{ color: JELLY_TOKENS.brand }}
            target="_blank"
            rel="noopener noreferrer"
          >
            /llms.txt
          </a>{' '}
          ·{' '}
          <a
            href="/api/v1/mcp"
            style={{ color: JELLY_TOKENS.brand }}
            target="_blank"
            rel="noopener noreferrer"
          >
            tool manifest
          </a>
        </div>
      </VCard>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: 'warn' | 'error';
  children: React.ReactNode;
}): React.ReactElement {
  const color = tone === 'error' ? JELLY_TOKENS.error : JELLY_TOKENS.warning;
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${color}`,
        background:
          tone === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)',
        color,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
