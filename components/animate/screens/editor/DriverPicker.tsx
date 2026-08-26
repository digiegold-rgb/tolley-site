'use client';

/**
 * DriverPicker — the driver-clip chooser for the "Wan Animate-2 Motion" tier.
 *
 * Animate-2 is MOTION TRANSFER: the character in the still copies a real
 * clip's movement, full-body and continuous (the "Paw Patrol" motion Jared
 * asked for on 8/16) instead of I2V drift. So the tier needs a driver clip.
 * This picker shows the caller's own uploads, the shared starter library,
 * and — on the house lane — Trey's performance drivers, with a hover preview,
 * an "Auto" mode (rotate through the library by scene) and an upload.
 *
 * Mounted under the Animation Quality dropdown in VisualsStep whenever the
 * selected tier is modal-animate2. The chosen id rides on every
 * /scene/animate and /animate-all call (`driverId`).
 */

import * as React from 'react';

import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { PillButton } from '../../cinema';

export interface DriverClip {
  id: string;
  name: string;
  owner: string;
  bytes: number;
  modifiedAt: string;
  url: string;
}

interface DriverPickerProps {
  value: string | null; // null = Auto
  onChange: (id: string | null) => void;
}

const OWNER_LABEL: Record<string, string> = {
  shared: 'Starter library',
  house: 'House performances',
};

export function DriverPicker({ value, onChange }: DriverPickerProps): React.ReactElement {
  const { t } = useTheme();
  const [drivers, setDrivers] = React.useState<DriverClip[] | null>(null);
  const [ownerKey, setOwnerKey] = React.useState<string>('');
  const [max, setMax] = React.useState(20);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch('/api/vater/drivers', { cache: 'no-store' });
      const data = (await r.json().catch(() => ({}))) as {
        drivers?: DriverClip[];
        ownerKey?: string;
        max?: number;
        error?: string;
      };
      if (!r.ok) {
        setError(data.error || 'Could not load driver clips.');
        setDrivers([]);
        return;
      }
      setDrivers(Array.isArray(data.drivers) ? data.drivers : []);
      setOwnerKey(data.ownerKey ?? '');
      if (typeof data.max === 'number') setMax(data.max);
      setError(null);
    } catch {
      setError('Could not load driver clips.');
      setDrivers([]);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('video', file, file.name);
      form.append('name', file.name.replace(/\.[^.]+$/, ''));
      const r = await fetch('/api/vater/drivers', { method: 'POST', body: form });
      const data = (await r.json().catch(() => ({}))) as { driver?: DriverClip; error?: string };
      if (!r.ok || !data.driver) {
        setError(data.error || 'Upload failed.');
        return;
      }
      await load();
      onChange(data.driver.id);
    } catch {
      setError('Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (d: DriverClip) => {
    if (!window.confirm(`Delete driver clip “${d.name}”?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/vater/drivers/${encodeURIComponent(d.id)}`, { method: 'DELETE' });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        setError(data.error || 'Delete failed.');
      } else {
        if (value === d.id) onChange(null);
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const own = (drivers ?? []).filter((d) => d.owner === ownerKey);
  const groups = React.useMemo(() => {
    const byOwner = new Map<string, DriverClip[]>();
    for (const d of drivers ?? []) {
      const list = byOwner.get(d.owner) ?? [];
      list.push(d);
      byOwner.set(d.owner, list);
    }
    return [...byOwner.entries()];
  }, [drivers]);

  const tile = (d: DriverClip) => {
    const selected = value === d.id;
    return (
      <div
        key={d.id}
        role="radio"
        aria-checked={selected}
        data-testid={`driver-${d.id}`}
        onClick={() => onChange(selected ? null : d.id)}
        title={`${d.name} — click to ${selected ? 'go back to Auto' : 'use for every animated scene'}`}
        style={{
          position: 'relative',
          width: 96,
          borderRadius: JELLY_TOKENS.radius.md,
          border: `2px solid ${selected ? JELLY_TOKENS.brand : t.border}`,
          background: t.cardAlt,
          overflow: 'hidden',
          cursor: 'pointer',
          boxShadow: selected ? JELLY_TOKENS.brandGlow : 'none',
          flexShrink: 0,
        }}
      >
        <video
          src={d.url}
          muted
          loop
          playsInline
          preload="metadata"
          onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }}
          style={{ width: 96, height: 60, objectFit: 'cover', display: 'block', background: '#000' }}
        />
        <div
          style={{
            fontSize: 10.5,
            padding: '4px 6px',
            color: selected ? t.text : t.textSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: selected ? 700 : 500,
          }}
        >
          {d.name}
        </div>
        {d.owner === ownerKey ? (
          <span
            role="button"
            aria-label={`Delete ${d.name}`}
            onClick={(e) => {
              e.stopPropagation();
              void remove(d);
            }}
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              width: 18,
              height: 18,
              borderRadius: 9,
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: 11,
              lineHeight: '18px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            ×
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div
      data-testid="driver-picker"
      style={{
        marginTop: 10,
        padding: 12,
        border: `1px solid ${t.border}`,
        borderRadius: JELLY_TOKENS.radius.md,
        background: t.card,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>Driver clip</div>
        <div style={{ fontSize: 11.5, color: t.textSecondary, flex: 1, minWidth: 200 }}>
          The character copies this clip’s movement. <strong>Auto</strong> rotates through the library
          scene by scene; pick one to use it everywhere.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <PillButton
          variant="outline"
          size="sm"
          disabled={busy || own.length >= max}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? 'Uploading…' : `Upload clip (${own.length}/${max})`}
        </PillButton>
      </div>
      {drivers === null ? (
        <div style={{ fontSize: 12, color: t.textFaint }}>Loading driver clips…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <div
              role="radio"
              aria-checked={value === null}
              data-testid="driver-auto"
              onClick={() => onChange(null)}
              style={{
                width: 96,
                minHeight: 84,
                borderRadius: JELLY_TOKENS.radius.md,
                border: `2px solid ${value === null ? JELLY_TOKENS.brand : t.border}`,
                background: value === null ? JELLY_TOKENS.gradChipOn : t.cardAlt,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: t.text,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Auto
            </div>
            {groups.map(([owner, list]) => (
              <React.Fragment key={owner}>
                <div
                  style={{
                    alignSelf: 'center',
                    fontSize: 10,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: t.textFaint,
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    padding: '0 2px',
                  }}
                >
                  {owner === ownerKey ? 'Mine' : OWNER_LABEL[owner] ?? owner}
                </div>
                {list.map(tile)}
              </React.Fragment>
            ))}
          </div>
          {drivers.length === 0 ? (
            <div style={{ fontSize: 12, color: JELLY_TOKENS.warning }}>
              No driver clips yet — upload a 3–6 second clip of the motion you want (a person walking,
              gesturing, turning). Animate-2 can’t run without one.
            </div>
          ) : null}
        </div>
      )}
      {error ? <div style={{ marginTop: 8, fontSize: 12, color: JELLY_TOKENS.error }}>{error}</div> : null}
    </div>
  );
}
