"use client";

import { useState } from "react";

type MfaSetupDialogProps = {
  onComplete: () => void;
  onCancel: () => void;
};

export function MfaSetupDialog({ onComplete, onCancel }: MfaSetupDialogProps) {
  const [step, setStep] = useState<"loading" | "scan" | "confirm" | "done">("loading");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Setup failed");
        return;
      }
      setQrCode(data.qrCodeDataUrl);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setStep("scan");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid code");
        setCode("");
        return;
      }
      setStep("done");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Auto-start on mount
  if (step === "loading" && !loading && !error) {
    startSetup();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/14 bg-[#120f1c] p-6 space-y-5">
        {step === "loading" && (
          <p className="text-center text-white/60">Setting up two-factor authentication...</p>
        )}

        {step === "scan" && (
          <>
            <h2 className="text-lg font-semibold text-white/95">Scan QR Code</h2>
            <p className="text-sm text-white/60">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="TOTP QR Code" className="rounded-lg" width={200} height={200} />
              </div>
            )}
            <details className="text-xs text-white/40">
              <summary className="cursor-pointer hover:text-white/60">Manual entry code</summary>
              <code className="mt-1 block break-all rounded bg-white/5 p-2 text-white/70">{secret}</code>
            </details>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs font-semibold text-amber-300 mb-2">Save your backup codes:</p>
              <div className="grid grid-cols-2 gap-1">
                {backupCodes.map((c) => (
                  <code key={c} className="text-xs text-amber-200/80 font-mono">{c}</code>
                ))}
              </div>
              <p className="text-[0.65rem] text-amber-200/50 mt-2">Store these somewhere safe. Each can only be used once.</p>
            </div>

            <button
              onClick={() => setStep("confirm")}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              I&apos;ve saved my backup codes
            </button>
            <button onClick={onCancel} className="w-full text-xs text-white/40 hover:text-white/60">
              Cancel
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <h2 className="text-lg font-semibold text-white/95">Confirm Setup</h2>
            <p className="text-sm text-white/60">Enter a code from your authenticator app to confirm.</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-xl border border-white/18 bg-white/[0.06] px-4 py-3 text-center text-2xl tracking-[0.3em] text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none"
              autoFocus
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={confirmCode}
              disabled={loading || code.length < 6}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
            >
              {loading ? "Verifying..." : "Confirm"}
            </button>
            <button onClick={() => setStep("scan")} className="w-full text-xs text-white/40 hover:text-white/60">
              Back
            </button>
          </>
        )}

        {step === "done" && (
          <>
            <div className="text-center space-y-3">
              <div className="text-4xl">&#x2705;</div>
              <h2 className="text-lg font-semibold text-white/95">Two-Factor Authentication Enabled</h2>
              <p className="text-sm text-white/60">Your account is now protected with 2FA.</p>
            </div>
            <button
              onClick={onComplete}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
