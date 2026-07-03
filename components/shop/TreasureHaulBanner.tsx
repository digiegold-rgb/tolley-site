"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { TREASURE_HAUL_FB_URL } from "@/lib/shop";

const STORAGE_KEY = "treasureHaulBannerDismissed";
const REDISPLAY_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export default function TreasureHaulBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    let dismissedAt: number | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) dismissedAt = parsed;
      }
    } catch {
      // storage unavailable — show banner
    }
    if (dismissedAt && Date.now() - dismissedAt < REDISPLAY_AFTER_MS) {
      setVisible(false);
    } else {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  return (
    <div className="border-b border-purple-500/30 bg-gradient-to-r from-[#1a0a2e] via-[#2a1245] to-[#1a0a2e] px-3 py-2">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <a
          href={TREASURE_HAUL_FB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center gap-3 group"
        >
          <span className="relative inline-block h-8 w-8 shrink-0 overflow-hidden rounded-full bg-purple-900/40 ring-1 ring-amber-300/40 sm:h-10 sm:w-10">
            <Image
              src="/branding/ruthanns-treasure-haul/profile.png"
              alt="Ruthann's Treasure Haul mascot"
              fill
              sizes="40px"
              className="object-cover"
              priority={false}
            />
          </span>
          <span className="flex flex-col leading-tight sm:flex-row sm:items-center sm:gap-2">
            <span className="text-[0.78rem] font-semibold text-amber-200 sm:text-sm">
              Ruthann&rsquo;s Treasure Haul is on Facebook
            </span>
            <span className="hidden text-[0.7rem] text-white/60 sm:inline">
              · Mom posts a fresh find every morning
            </span>
            <span className="text-[0.65rem] font-medium text-purple-200/80 underline-offset-2 group-hover:underline sm:text-[0.7rem]">
              Follow the Page →
            </span>
          </span>
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss Treasure Haul banner"
          className="shrink-0 rounded-full p-1 text-amber-200/60 transition hover:bg-white/5 hover:text-amber-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="3" x2="11" y2="11" />
            <line x1="11" y1="3" x2="3" y2="11" />
          </svg>
        </button>
      </div>
    </div>
  );
}
