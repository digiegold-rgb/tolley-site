import type { Metadata } from "next";
import { buildSignatureHtml, JARED_SIGNATURE } from "@/lib/signatures";
import CopyButton from "./CopyButton";

export const metadata: Metadata = {
  title: "Email Signature | tolley.io",
  description:
    "Premium animated email signature for Your KC Homes — hosted on tolley.io.",
  robots: { index: false, follow: false },
};

const STEPS: { client: string; steps: string[] }[] = [
  {
    client: "Gmail (desktop)",
    steps: [
      "Click “Copy Signature” above.",
      "Gmail → gear icon → See all settings → General tab.",
      "Scroll to Signature → Create new → name it “Your KC Homes”.",
      "Click inside the signature box and paste (Ctrl/Cmd+V). The card appears with images.",
      "Below the box, set both “For new emails” and “On reply/forward” to the new signature.",
      "Scroll to the bottom and hit Save Changes.",
    ],
  },
  {
    client: "Outlook (web & new Outlook)",
    steps: [
      "Click “Copy Signature” above.",
      "Outlook → Settings → Mail → Compose and reply.",
      "Under Email signature, click into the editor and paste.",
      "Assign it to new messages and replies/forwards, then Save.",
      "Note: classic Outlook for Windows shows the first frame only (still looks great — that's by design).",
    ],
  },
  {
    client: "iPhone / Apple Mail",
    steps: [
      "iOS Mail's Settings signature field strips images — instead, send yourself an email from Gmail/Outlook with the signature installed.",
      "Open it in Apple Mail, long-press the signature card, Select All → Copy.",
      "Settings → Mail → Signature → paste.",
      "If iOS flattens the layout, just use it on Gmail/Outlook apps — both support the full card.",
    ],
  },
];

export default function SignaturePage() {
  const html = buildSignatureHtml(JARED_SIGNATURE);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-400">
        Your KC Homes
      </p>
      <h1 className="mt-2 text-3xl font-bold text-white">
        Animated Email Signature
      </h1>
      <p className="mt-2 text-sm text-white/60">
        Hosted on tolley.io — clean table HTML, no tracking pixels, assets
        served from your own domain. Works in Gmail, Outlook, Apple Mail and
        1,000+ clients.
      </p>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow-2xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Live preview
        </p>
        <div
          className="overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </section>

      <div className="mt-6 flex items-center gap-4">
        <CopyButton html={html} />
        <span className="text-xs text-white/40">
          Copies rich HTML — paste straight into your email settings.
        </span>
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-bold text-white">Install</h2>
        {STEPS.map((s) => (
          <details
            key={s.client}
            className="group rounded-xl border border-white/10 bg-white/5"
          >
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-white/85 transition group-open:text-sky-300">
              {s.client}
            </summary>
            <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-9 text-sm text-white/65">
              {s.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </details>
        ))}
      </section>

      <p className="mt-10 text-xs text-white/30">
        Animated GIFs play in Gmail, Apple Mail, and Outlook on the web.
        Classic Outlook for Windows shows the first frame — the card is
        designed so frame one is the complete signature.
      </p>
    </main>
  );
}
