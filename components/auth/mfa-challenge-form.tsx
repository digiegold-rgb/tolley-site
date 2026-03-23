"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function MfaChallengeForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), isBackupCode: useBackup }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        setCode("");
        inputRef.current?.focus();
        return;
      }

      // MFA cleared — redirect to dashboard
      router.push("/account");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">
          {useBackup ? "Backup Code" : "6-Digit Code"}
        </label>
        <input
          ref={inputRef}
          type="text"
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          maxLength={useBackup ? 8 : 6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(useBackup ? /[^a-f0-9]/gi : /\D/g, ""))}
          placeholder={useBackup ? "Enter backup code" : "000000"}
          className="w-full rounded-xl border border-white/18 bg-white/[0.06] px-4 py-3 text-center text-2xl tracking-[0.3em] text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30"
          autoFocus
        />
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || code.length < (useBackup ? 8 : 6)}
        className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Verifying..." : "Verify"}
      </button>

      <button
        type="button"
        onClick={() => { setUseBackup(!useBackup); setCode(""); setError(""); }}
        className="w-full text-center text-xs text-white/50 hover:text-white/70 transition"
      >
        {useBackup ? "Use authenticator app instead" : "Use a backup code instead"}
      </button>
    </form>
  );
}
