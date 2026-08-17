'use client';

/* ElevenLabsConnect — bring your own ElevenLabs account (2026-08-17).
 *
 * Self-serve for every tier: a customer pastes their own ElevenLabs API key
 * and from then on ElevenLabs narration bills THEIR subscription. Nobody edits
 * a server env file to onboard an account, which is the whole point — the
 * studio should never be the bottleneck between a user and a voice.
 *
 * Contract: GET/PUT/DELETE /api/vater/me/elevenlabs-key. The tenant is always
 * the session user; the key is validated against ElevenLabs before it is
 * stored, encrypted, on the render box. It is never sent back to the browser,
 * so this screen shows status ("connected · ends c18c · creator") and never a
 * "reveal" affordance — there is nothing to reveal.
 */

import * as React from 'react';

import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn } from '../../primitives';
import { TINT_BG, TINT_BORDER } from '../tint';

interface KeyStatus {
  configured: boolean;
  last4?: string;
  houseKey?: boolean;
  updatedAt?: string;
  meta?: {
    tier?: string;
    status?: string;
    characterCount?: number;
    characterLimit?: number;
    charactersRemaining?: number;
    voiceCount?: number;
    verifiedAt?: string;
  };
}

const KEYS_URL = 'https://elevenlabs.io/app/settings/api-keys';

function num(n: number | undefined): string {
  return typeof n === 'number' ? n.toLocaleString() : '—';
}

export function ElevenLabsConnect({
  onChanged,
}: {
  /** Fired after a connect/disconnect so the caller can refetch voice lists. */
  onChanged?: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [status, setStatus] = React.useState<KeyStatus | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/vater/me/elevenlabs-key', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as KeyStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your connection');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    const key = draft.trim();
    if (!key) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/vater/me/elevenlabs-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = (await res.json().catch(() => ({}))) as KeyStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus(data);
      setDraft('');
      setEditing(false);
      setSaved(true);
      onChanged?.();
      window.setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that key');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/vater/me/elevenlabs-key', { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus({ configured: false });
      setEditing(false);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect');
    } finally {
      setBusy(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    padding: 16,
    borderRadius: JELLY_TOKENS.radius.lg,
    background: t.card,
    border: `1px solid ${t.border}`,
  };
  const label: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: t.text,
    marginBottom: 6,
  };
  const body: React.CSSProperties = {
    fontSize: 11.5,
    color: t.textSecondary,
    margin: '0 0 12px',
    lineHeight: 1.6,
  };

  // Owner accounts narrate on the studio's own ElevenLabs account. Telling
  // them to connect a key would be a lie, so say what is actually true.
  if (status?.houseKey) {
    return (
      <div style={cardStyle}>
        <div style={label}>ElevenLabs account</div>
        <p style={{ ...body, margin: 0 }}>
          This account narrates on the studio&apos;s own ElevenLabs
          subscription — nothing to connect.
        </p>
      </div>
    );
  }

  const keyField = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <input
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !busy) void connect();
        }}
        placeholder="sk_…"
        autoComplete="off"
        spellCheck={false}
        aria-label="ElevenLabs API key"
        style={{
          flex: '1 1 260px',
          minWidth: 0,
          fontSize: 14,
          fontFamily: JELLY_TOKENS.font,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.md,
          background: t.card,
          color: t.text,
          outline: 'none',
          boxSizing: 'border-box',
          padding: '11px 12px',
        }}
      />
      <VBtn size="sm" onClick={() => void connect()} disabled={busy || !draft.trim()}>
        {busy ? 'Checking…' : status?.configured ? 'Replace key' : 'Connect'}
      </VBtn>
      {status?.configured && (
        <VBtn size="sm" variant="text" onClick={() => { setEditing(false); setDraft(''); }}>
          Cancel
        </VBtn>
      )}
    </div>
  );

  return (
    <div style={cardStyle}>
      <div style={label}>Your ElevenLabs account</div>
      <p style={body}>
        Connect your own ElevenLabs key and every ElevenLabs voice in your
        projects narrates on <strong>your</strong> subscription — the
        characters come off your plan, and Jelly bills you nothing for the
        narration. Your own voice clones stay free either way.{' '}
        <a
          href={KEYS_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: t.link }}
        >
          Get your key →
        </a>{' '}
        (ElevenLabs → profile → API Keys)
      </p>

      {status === null && !loadError && (
        <div style={{ fontSize: 12, color: t.textSecondary }}>Loading…</div>
      )}

      {loadError && (
        <div style={{ fontSize: 12, color: JELLY_TOKENS.error, marginBottom: 8 }}>
          {loadError}
        </div>
      )}

      {status?.configured && !editing && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            ...TINT_BG.success,
            border: `1px solid ${TINT_BORDER.success}`,
            fontSize: 12,
            color: t.textSecondary,
            lineHeight: 1.7,
            marginBottom: 12,
          }}
        >
          <div style={{ color: t.text, fontWeight: 600 }}>
            Connected · key ending {status.last4 || '••••'}
            {status.meta?.tier ? ` · ${status.meta.tier} plan` : ''}
          </div>
          <div>
            {num(status.meta?.charactersRemaining)} of{' '}
            {num(status.meta?.characterLimit)} characters left
            {typeof status.meta?.voiceCount === 'number'
              ? ` · ${status.meta.voiceCount} voices`
              : ''}
          </div>
        </div>
      )}

      {saved && (
        <div style={{ fontSize: 12, color: JELLY_TOKENS.success, marginBottom: 8 }}>
          Key verified and saved.
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: JELLY_TOKENS.error, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {status && !status.configured && keyField}

      {status?.configured && editing && keyField}

      {status?.configured && !editing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <VBtn size="sm" variant="outlined" onClick={() => setEditing(true)} disabled={busy}>
            Replace key
          </VBtn>
          <VBtn size="sm" variant="text" onClick={() => void disconnect()} disabled={busy}>
            {busy ? 'Working…' : 'Disconnect'}
          </VBtn>
        </div>
      )}

      <p style={{ ...body, margin: '12px 0 0', fontSize: 11 }}>
        The key is verified with ElevenLabs, then stored encrypted on the
        render machine. It is never shown again here and never leaves that
        box — disconnect any time and ElevenLabs voices simply stop being
        available to your projects.
      </p>
    </div>
  );
}
