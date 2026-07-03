"use client";

import { useState } from "react";

export function SiriSetupCard({ keyConfigured }: { keyConfigured: boolean }) {
  const [reveal, setReveal] = useState(false);
  const [keyValue, setKeyValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleReveal() {
    if (reveal) {
      setReveal(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/vater/budget/voice/key");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setKeyValue(j.key ?? null);
      setReveal(true);
    } catch (err) {
      alert(`Failed to fetch key: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
    }
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <section className="vater-card p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-2xl" aria-hidden>🎙️</span>
        <h2 className="text-lg font-bold text-slate-100">Hey Siri, log spending</h2>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Two iOS Shortcuts give Siri your voice budget. Build them once on your iPhone and use forever.
      </p>

      {!keyConfigured ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Set <code className="rounded bg-black/40 px-1">VATER_BUDGET_VOICE_KEY</code> in your env
          (32+ chars) and restart to enable voice endpoints.
        </div>
      ) : (
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <div className="mb-1 font-semibold text-slate-100">1. Get your voice key</div>
            <div className="flex items-center gap-2">
              <code className="block flex-1 truncate rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300">
                {reveal && keyValue ? keyValue : "•••••••••••••••••••••••••"}
              </code>
              <button
                type="button"
                onClick={handleReveal}
                disabled={loading}
                className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-sky-500 hover:text-sky-300 disabled:opacity-50"
              >
                {loading ? "…" : reveal ? "Hide" : "Reveal"}
              </button>
              {reveal && keyValue && (
                <button
                  type="button"
                  onClick={() => copy(keyValue)}
                  className="rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-sky-500 hover:text-sky-300"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1 font-semibold text-slate-100">2. Build "Log Spending" shortcut on iPhone</div>
            <ol className="list-decimal space-y-1 pl-5 text-slate-400">
              <li>Open Shortcuts → New Shortcut → name it "Log Spending"</li>
              <li>Add action: <span className="text-slate-200">Dictate Text</span></li>
              <li>
                Add: <span className="text-slate-200">Get Contents of URL</span> →{" "}
                <code className="rounded bg-black/40 px-1 text-[11px]">https://tolley.io/api/vater/budget/voice/log</code>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  <li>Method: POST</li>
                  <li>Headers: <code className="bg-black/40 px-1">Authorization: Bearer YOUR_KEY</code></li>
                  <li>Headers: <code className="bg-black/40 px-1">Content-Type: application/json</code></li>
                  <li>Request body (JSON): <code className="bg-black/40 px-1">{`{"text": <Dictated Text>}`}</code></li>
                </ul>
              </li>
              <li>Add: <span className="text-slate-200">Get Dictionary Value</span> → key <code className="bg-black/40 px-1">spoken</code></li>
              <li>Add: <span className="text-slate-200">Speak Text</span> → Dictionary Value</li>
              <li>Set Siri phrase: "log spending"</li>
            </ol>
          </div>

          <div>
            <div className="mb-1 font-semibold text-slate-100">3. Build "Budget Check" shortcut</div>
            <p className="text-slate-400">
              Same recipe but POST to{" "}
              <code className="rounded bg-black/40 px-1 text-[11px]">
                https://tolley.io/api/vater/budget/voice/ask
              </code>{" "}
              and set the Siri phrase to "budget check".
            </p>
          </div>

          <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-xs text-sky-200">
            Try it: "Hey Siri, log spending" → <em>"I spent $45 at UDF for gas in the jeep"</em>
          </div>
        </div>
      )}
    </section>
  );
}
