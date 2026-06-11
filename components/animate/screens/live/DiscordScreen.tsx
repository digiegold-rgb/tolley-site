'use client';

/* DiscordScreen — ClaudeCode bot status on DGX Spark + chat copilot.
 *
 * Pulls overall pipeline status (we can re-use /api/vater/pipeline-status)
 * for the bot health bits. Wires /api/vater/chat for the AI copilot.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, VInput, SectionHeader } from '../../primitives';

interface ChatMsg { role: 'user' | 'assistant'; text: string; }

export function DiscordScreen(): React.ReactElement {
  const { t } = useTheme();
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [status, setStatus] = React.useState<any>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/pipeline-status', { cache: 'no-store' });
        if (r.ok && !cancelled) setStatus(await r.json());
      } catch { /* swallow */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    try {
      const r = await fetch('/api/vater/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text }),
      });
      if (r.ok) {
        const data = await r.json();
        setMessages(prev => [...prev, { role: 'assistant', text: data.reply ?? data.message ?? '(no reply)' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: `Error: HTTP ${r.status}` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err instanceof Error ? err.message : 'unknown'}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="help"
        title="Discord Bot"
        description="ClaudeCode bot status on DGX Spark + AI copilot chat."
      />

      <VCard variant="flat">
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>Bot Status</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'DGX Pipeline', val: status?.pipelineHealthy ? 'healthy' : status ? 'degraded' : '…' },
            { label: 'ComfyUI :8188', val: status?.comfy8188 ?? '…' },
            { label: 'ComfyUI :8189', val: status?.comfy8189 ?? '…' },
            {
              label: 'Active Jobs',
              val:
                Array.isArray(status?.activeJobs)
                  ? status.activeJobs.length
                  : (typeof status?.activeJobs === 'number' ? status.activeJobs : '…'),
            },
          ].map(k => (
            <div key={k.label} style={{
              padding: '8px 14px', borderRadius: JELLY_TOKENS.radius.sm,
              background: t.cardAlt, border: `1px solid ${t.border}`,
            }}>
              <div style={{ fontSize: 11, color: t.textSecondary }}>{k.label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginTop: 2 }}>{String(k.val)}</div>
            </div>
          ))}
        </div>
      </VCard>

      <VCard variant="flat">
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 12 }}>Vater Copilot</div>
        <div style={{
          height: 360, overflowY: 'auto', padding: 12,
          background: t.cardAlt, borderRadius: JELLY_TOKENS.radius.sm,
          border: `1px solid ${t.border}`, marginBottom: 12,
        }}>
          {messages.length === 0 ? (
            <div style={{ color: t.textSecondary, fontSize: 13 }}>Ask anything about your videos, pipeline status, or Vater workflows.</div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{
                marginBottom: 12, padding: 8, borderRadius: JELLY_TOKENS.radius.sm,
                background: m.role === 'user' ? JELLY_TOKENS.brandGhost : 'transparent',
                color: t.text, fontSize: 14,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, marginBottom: 4 }}>
                  {m.role === 'user' ? 'You' : 'Vater'}
                </div>
                {m.text}
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <VInput value={input} onChange={setInput} placeholder="Type a message…" />
          </div>
          <VBtn onClick={send} disabled={sending || !input.trim()}>
            {sending ? '…' : 'Send'}
          </VBtn>
        </div>
      </VCard>
    </div>
  );
}
