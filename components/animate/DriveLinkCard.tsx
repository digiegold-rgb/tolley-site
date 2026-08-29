'use client';

/* DriveLinkCard — the per-user Google Drive link (2026-08-28).
 *
 * Reads GET /api/vater/drive/status on mount and renders one of:
 *   loading      · skeleton line
 *   not linked   · "Link Google Drive" → navigates to the OAuth start URL
 *                  (Google bounces back to /animate?drive=connected#<hash>)
 *   linked       · Google email · "Jelly Scripts ↗" folder · Disconnect
 *                  (inline confirm → POST disconnect → refetch)
 *   error        · amber note with lastError + "Try again" (re-link)
 *   revoked      · "Google disconnected this link" + Reconnect
 *
 * The Shell consumes the `?drive=` return params and toasts; this card only
 * needs to refetch when it mounts, which it does because the return lands
 * on a fresh page load.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { GlassCard } from './cinema';
import { VBtn } from './primitives';
import { Icon } from './Icon';
import { TINT_BG, TINT_BORDER } from './screens/tint';
import { createApi, driveStartUrl, errorMessage, type DriveStatus } from './screens/create/create-api';

const BLURB = 'Approved scripts are saved as Google Docs in a "Jelly Scripts" folder in your Drive.';

/** Copy for a status "error" row. `api_not_enabled` is ours to fix, not theirs. */
function errorLine(lastError: string | null): string {
  const raw = (lastError ?? '').trim();
  if (/not.?enabled|accessNotConfigured|has not been used/i.test(raw)) {
    return 'The Google Drive API is not enabled for this app yet — the owner has been notified.';
  }
  return raw ? `Drive link error: ${raw}` : 'Something went wrong with the Drive link.';
}

function currentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '');
}

export function DriveLinkCard({ style }: { style?: React.CSSProperties }): React.ReactElement {
  const { t } = useTheme();
  const [status, setStatus] = React.useState<DriveStatus | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState<'disconnect' | 'link' | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const s = await createApi.driveStatus();
      setStatus(s);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not read the Drive link'));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const link = (): void => {
    setBusy('link');
    window.location.assign(driveStartUrl(currentHash()));
  };

  const disconnect = async (): Promise<void> => {
    setBusy('disconnect');
    setActionError(null);
    try {
      await createApi.driveDisconnect();
      setConfirming(false);
      await load();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not disconnect'));
    } finally {
      setBusy(null);
    }
  };

  const linked = !!status?.connected && status.status === 'active';
  const state: 'loading' | 'unlinked' | 'linked' | 'error' | 'revoked' = !status
    ? 'loading'
    : linked
      ? 'linked'
      : status.status === 'error'
        ? 'error'
        : status.status === 'revoked'
          ? 'revoked'
          : 'unlinked';

  const warn = state === 'error' || state === 'revoked';

  // GlassCard forwards data-testid only; the state attribute lives on a wrapper.
  return (
    <div data-testid="drive-card" data-state={state} style={style}>
      <GlassCard
        padding={16}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          ...(warn ? { ...TINT_BG.warning, border: `1px solid ${TINT_BORDER.warning}` } : {}),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Icon name="folder" size={18} color={warn ? JELLY_TOKENS.warning : linked ? JELLY_TOKENS.success : t.textSecondary} />
          <div
            style={{
              flex: 1,
              minWidth: 200,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: t.text,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              Google Drive
            </div>
            {state === 'loading' && !loadError && <div style={{ fontSize: 12.5, color: t.textFaint }}>Checking your Drive link…</div>}
            {loadError && <div style={{ fontSize: 12.5, color: t.textSecondary }}>{loadError}</div>}
            {state === 'unlinked' && (
              <div
                style={{
                  fontSize: 12.5,
                  color: t.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                {BLURB}
              </div>
            )}
            {state === 'linked' && (
              <div
                style={{
                  fontSize: 12.5,
                  color: t.textSecondary,
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <span data-testid="drive-linked-email" style={{ color: t.text }}>
                  {status?.email ?? 'Linked'}
                </span>
                {status?.folderUrl && (
                  <a
                    href={status.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="drive-folder"
                    style={{
                      color: t.link,
                      textDecoration: 'underline',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Jelly Scripts ↗
                  </a>
                )}
              </div>
            )}
            {state === 'error' && (
              <div
                data-testid="drive-error"
                style={{
                  fontSize: 12.5,
                  color: JELLY_TOKENS.warning,
                  lineHeight: 1.5,
                }}
              >
                {errorLine(status?.lastError ?? null)}
              </div>
            )}
            {state === 'revoked' && (
              <div
                data-testid="drive-error"
                style={{
                  fontSize: 12.5,
                  color: JELLY_TOKENS.warning,
                  lineHeight: 1.5,
                }}
              >
                Google disconnected this link — reconnect to keep saving scripts.
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {(state === 'unlinked' || loadError) && (
              <VBtn size="sm" variant="outlined" onClick={link} disabled={busy !== null} data-testid="drive-link">
                {busy === 'link' ? 'Opening Google…' : 'Link Google Drive'}
              </VBtn>
            )}
            {state === 'error' && (
              <VBtn size="sm" variant="outlined" onClick={link} disabled={busy !== null} data-testid="drive-link">
                {busy === 'link' ? 'Opening Google…' : 'Try again'}
              </VBtn>
            )}
            {state === 'revoked' && (
              <VBtn size="sm" variant="outlined" onClick={link} disabled={busy !== null} data-testid="drive-link">
                {busy === 'link' ? 'Opening Google…' : 'Reconnect'}
              </VBtn>
            )}
            {state === 'linked' && !confirming && (
              <VBtn size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={busy !== null} data-testid="drive-disconnect">
                Disconnect
              </VBtn>
            )}
            {state === 'linked' && confirming && (
              <>
                <span style={{ fontSize: 12, color: t.textSecondary }}>Stop saving to Drive?</span>
                <VBtn
                  size="sm"
                  variant="danger"
                  onClick={() => void disconnect()}
                  disabled={busy !== null}
                  data-testid="drive-disconnect-confirm"
                >
                  {busy === 'disconnect' ? 'Disconnecting…' : 'Yes, disconnect'}
                </VBtn>
                <VBtn size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={busy !== null}>
                  Keep
                </VBtn>
              </>
            )}
          </div>
        </div>
        {actionError && (
          <div role="alert" style={{ fontSize: 12.5, color: JELLY_TOKENS.error }}>
            {actionError}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
