"use client";

import { useState } from "react";
import { MfaSetupDialog } from "./mfa-setup-dialog";

type MfaSettingsSectionProps = {
  mfaEnabled: boolean;
};

export function MfaSettingsSection({ mfaEnabled }: MfaSettingsSectionProps) {
  const [enabled, setEnabled] = useState(mfaEnabled);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  async function handleDisable() {
    setDisableError("");
    setDisableLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisableError(data.error || "Failed");
        return;
      }
      setEnabled(false);
      setShowDisable(false);
      setDisableCode("");
    } catch {
      setDisableError("Something went wrong");
    } finally {
      setDisableLoading(false);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-white/10 bg-white/5 p-6 mb-6">
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">
          Two-Factor Authentication
        </h2>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-white/90">
              {enabled ? "Enabled" : "Not enabled"}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {enabled
                ? "Your account is protected with an authenticator app"
                : "Add an extra layer of security to your account"}
            </p>
          </div>
          {enabled ? (
            <button
              onClick={() => setShowDisable(!showDisable)}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 transition"
            >
              Disable 2FA
            </button>
          ) : (
            <button
              onClick={() => setShowSetup(true)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition"
            >
              Enable 2FA
            </button>
          )}
        </div>

        {showDisable && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <p className="text-xs text-white/50">Enter your authenticator code to disable 2FA:</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="flex-1 rounded-lg border border-white/18 bg-white/[0.06] px-3 py-2 text-sm text-white text-center tracking-widest placeholder:text-white/30 focus:outline-none focus:border-violet-400/50"
              />
              <button
                onClick={handleDisable}
                disabled={disableLoading || disableCode.length < 6}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
              >
                {disableLoading ? "..." : "Confirm"}
              </button>
            </div>
            {disableError && <p className="text-xs text-red-400">{disableError}</p>}
          </div>
        )}
      </section>

      {showSetup && (
        <MfaSetupDialog
          onComplete={() => { setShowSetup(false); setEnabled(true); }}
          onCancel={() => setShowSetup(false)}
        />
      )}
    </>
  );
}
