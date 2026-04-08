import type { Metadata } from "next";
import Link from "next/link";
import { JetBrains_Mono, Sora } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthSessionProvider } from "@/components/providers/auth-session-provider";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://tolley.io'),
  title: "t-agent | Real Estate Unlocked",
  description:
    "T-Agent is a premium search portal for real estate agents to unlock trusted vendors, guidance, and deal-closing momentum.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${jetBrainsMono.variable} antialiased`}>
        <AuthSessionProvider>
          {children}
          <SpeedInsights />
          <footer className="site-legal-footer fixed inset-x-0 bottom-4 z-40 flex items-center justify-center px-4">
            <nav
              aria-label="Legal links"
              className="rounded-full border border-white/18 bg-black/35 px-4 py-2 backdrop-blur-xl"
            >
              <ul className="flex items-center gap-4 text-[0.7rem] tracking-[0.08em] text-white/72 uppercase">
                <li>
                  <Link className="transition hover:text-white" href="/privacy">
                    Privacy Policy
                  </Link>
                </li>
                <li aria-hidden="true" className="text-white/45">
                  |
                </li>
                <li>
                  <Link className="transition hover:text-white" href="/terms">
                    Terms &amp; Conditions
                  </Link>
                </li>
                <li aria-hidden="true" className="text-white/45">
                  |
                </li>
                <li>
                  <Link className="transition hover:text-white" href="/wd">
                    Wash &amp; Dry Rental
                  </Link>
                </li>
                <li aria-hidden="true" className="text-white/45">
                  |
                </li>
                <li>
                  <Link className="transition hover:text-white" href="/trailer">
                    Trailer Rental
                  </Link>
                </li>
                <li aria-hidden="true" className="text-white/45">
                  |
                </li>
                <li>
                  <Link className="transition hover:text-white" href="/generator">
                    Generator Rental
                  </Link>
                </li>
                <li aria-hidden="true" className="text-white/45">
                  |
                </li>
                <li>
                  <Link className="transition hover:text-white" href="/pools">
                    Pool Supplies
                  </Link>
                </li>
              </ul>
            </nav>
          </footer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
