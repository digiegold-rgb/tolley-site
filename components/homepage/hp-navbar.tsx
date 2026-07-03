"use client";

import Link from "next/link";
import { useState } from "react";

type HpNavbarProps = {
  isAuthenticated: boolean;
};

export function HpNavbar({ isAuthenticated }: HpNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-center px-4 pt-4">
      <div className="flex w-full max-w-6xl items-center justify-between rounded-full border border-white/18 bg-black/35 px-5 py-2.5 backdrop-blur-xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[0.72rem] font-medium tracking-[0.42em] text-white/90 uppercase">
            t-agent
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          <a
            href="#features"
            className="text-xs tracking-[0.1em] text-white/68 uppercase transition hover:text-white"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-xs tracking-[0.1em] text-white/68 uppercase transition hover:text-white"
          >
            Pricing
          </a>
          <Link
            href="/tools/lead-follow-up-audit"
            className="text-xs tracking-[0.1em] text-white/68 uppercase transition hover:text-white"
          >
            Free Tools
          </Link>
          <Link
            href="/blog"
            className="text-xs tracking-[0.1em] text-white/68 uppercase transition hover:text-white"
          >
            Blog
          </Link>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <Link
                href="/agents"
                className="text-xs tracking-[0.1em] text-white/72 uppercase transition hover:text-white"
              >
                Agents
              </Link>
              <Link
                href="/leads/dashboard"
                className="rounded-full border border-violet-200/45 bg-violet-300/20 px-5 py-2 text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase transition hover:bg-violet-300/28"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs tracking-[0.1em] text-white/72 uppercase transition hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/signup?callbackUrl=%2Fleads%2Fdashboard"
                className="rounded-full border border-violet-200/45 bg-violet-300/20 px-5 py-2 text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase transition hover:bg-violet-300/28"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="grid h-8 w-8 place-items-center rounded-lg md:hidden"
          aria-label="Toggle menu"
        >
          <svg
            width="18"
            height="14"
            viewBox="0 0 18 14"
            fill="none"
            className="text-white/80"
          >
            {menuOpen ? (
              <path
                d="M1 1l16 12M1 13L17 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <>
                <path d="M0 1h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M0 7h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M0 13h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full right-4 left-4 mt-2 rounded-2xl border border-white/18 bg-[rgba(8,7,15,0.92)] p-5 backdrop-blur-2xl md:hidden">
          <div className="flex flex-col gap-4">
            <a
              href="#features"
              onClick={() => setMenuOpen(false)}
              className="text-sm tracking-[0.08em] text-white/72 uppercase transition hover:text-white"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={() => setMenuOpen(false)}
              className="text-sm tracking-[0.08em] text-white/72 uppercase transition hover:text-white"
            >
              Pricing
            </a>
            <Link
              href="/tools/lead-follow-up-audit"
              onClick={() => setMenuOpen(false)}
              className="text-sm tracking-[0.08em] text-white/72 uppercase transition hover:text-white"
            >
              Free Tools
            </Link>
            <Link
              href="/blog"
              onClick={() => setMenuOpen(false)}
              className="text-sm tracking-[0.08em] text-white/72 uppercase transition hover:text-white"
            >
              Blog
            </Link>
            <hr className="border-white/12" />
            {isAuthenticated ? (
              <>
                <Link
                  href="/agents"
                  onClick={() => setMenuOpen(false)}
                  className="text-sm tracking-[0.08em] text-white/72 uppercase transition hover:text-white"
                >
                  Agents
                </Link>
                <Link
                  href="/leads/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-violet-200/45 bg-violet-300/20 px-5 py-2.5 text-center text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase transition hover:bg-violet-300/28"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm tracking-[0.08em] text-white/72 uppercase transition hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup?callbackUrl=%2Fleads%2Fdashboard"
                  className="rounded-full border border-violet-200/45 bg-violet-300/20 px-5 py-2.5 text-center text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase transition hover:bg-violet-300/28"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
