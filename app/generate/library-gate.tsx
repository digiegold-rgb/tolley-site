"use client";

import { useState, type FormEvent, type ReactNode } from "react";

/**
 * Gates Modal stills / prior-job galleries. Default = hidden so NSFW thumbs
 * never flash on first paint. Unlock is a server-verified library passcode
 * (httpOnly cookie). Unauthenticated visitors get no library UI at all.
 */
export function GenerateLibraryGate({
  authed,
  unlocked,
  onUnlocked,
  onLocked,
  children,
}: {
  authed: boolean | null;
  unlocked: boolean;
  onUnlocked: () => void;
  onLocked: () => void;
  children: ReactNode;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authed !== true) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/generate/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!r.ok) {
        setError(r.status === 403 ? "Incorrect passcode." : "Could not unlock library.");
        return;
      }
      setPin("");
      onUnlocked();
    } catch {
      setError("Could not unlock library.");
    } finally {
      setBusy(false);
    }
  }

  async function hide() {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/generate/library", { method: "DELETE" });
    } catch {
      /* still lock locally */
    }
    setBusy(false);
    onLocked();
  }

  return (
    <div className="gen-library-gate" data-testid="generate-library-gate">
      <div className="gen-library-bar">
        <p className="gen-library-status">
          {unlocked ? "Library unlocked" : "Library locked"}
        </p>
        {unlocked ? (
          <button
            type="button"
            className="gen-library-toggle"
            data-testid="generate-library-toggle"
            aria-pressed={true}
            aria-expanded={true}
            disabled={busy}
            onClick={() => void hide()}
          >
            Hide library
          </button>
        ) : null}
      </div>
      {unlocked ? (
        children
      ) : (
        <form className="gen-library-unlock" data-testid="generate-library-unlock" onSubmit={(e) => void submit(e)}>
          <p className="gen-hint gen-library-hint">
            Prior jobs and model stills stay off this page until you enter the library
            passcode. Motion / generate forms above keep working.
          </p>
          <label className="gen-library-pin-label" htmlFor="generate-library-pin">
            Library passcode
          </label>
          <div className="gen-library-pin-row">
            <input
              id="generate-library-pin"
              className="gen-library-pin"
              data-testid="generate-library-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="gen-library-toggle"
              data-testid="generate-library-unlock-submit"
              disabled={busy || !pin.trim()}
            >
              {busy ? "Checking…" : "Unlock library"}
            </button>
          </div>
          {error ? <p className="gen-err">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
