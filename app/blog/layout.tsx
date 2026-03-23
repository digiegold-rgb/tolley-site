import type { Metadata } from "next";
import Link from "next/link";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Blog | T-Agent — Real Estate AI Insights",
    template: "%s | T-Agent Blog",
  },
  description:
    "AI tools, Kansas City real estate market insights, lead management strategies, and productivity guides for real estate professionals.",
  openGraph: {
    siteName: "T-Agent by Tolley.io",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@tolleyio",
  },
  alternates: {
    canonical: "https://tolley.io/blog",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-screen bg-[#06050a] ${poppins.variable}`}>
      <header className="border-b border-white/8">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="text-[0.75rem] font-semibold uppercase tracking-widest text-white/60 transition hover:text-white">
            ← t-agent
          </Link>
          <Link
            href="/leads/pricing"
            className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-4 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500/20"
          >
            Start Free Trial
          </Link>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/8 mt-20">
        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 text-center text-xs text-white/35">
          <p>© 2026 Tolley.io · T-Agent Real Estate AI · Kansas City, MO</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/privacy" className="hover:text-white/60 transition">Privacy</Link>
            <Link href="/blog" className="hover:text-white/60 transition">Blog</Link>
            <Link href="/leads/pricing" className="hover:text-white/60 transition">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
