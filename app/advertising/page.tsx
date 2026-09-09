import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Google Ads integration information | T-Agent",
  description: "Information about the T-Agent Google Ads integration and access.",
  alternates: { canonical: "https://www.tolley.io/advertising" },
  robots: { index: false, follow: true },
};

export default function AdvertisingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-16 text-white">
      <Link href="/agent" className="text-cyan-300 underline">T-Agent</Link>
      <h1 className="mt-8 text-3xl font-bold">Google Ads integration information</h1>
      <p className="mt-5 leading-7 text-white/75">This page describes the Google Ads integration associated with T-Agent. Advertising access depends on account setup and integration availability. Contact Tolley to confirm access before choosing a plan for this feature.</p>
      <p className="mt-5 leading-7 text-white/75">Google Ads media spend is separate from T-Agent platform pricing. This page does not offer sponsored placements on the Tolley network.</p>
      <nav className="mt-8 flex flex-wrap gap-5" aria-label="Integration information">
        <Link href="/leads/pricing" className="text-cyan-300 underline">Current T-Agent plans</Link>
        <Link href="/start#route" className="text-cyan-300 underline">Contact Tolley</Link>
        <Link href="/privacy" className="text-cyan-300 underline">Privacy</Link>
        <Link href="/terms" className="text-cyan-300 underline">Terms</Link>
      </nav>
    </main>
  );
}
