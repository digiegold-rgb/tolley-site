"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/components/analytics/site-tracker";

const STORAGE_KEY = "amazonStorefrontBannerDismissed";
const REDISPLAY_AFTER_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const STOREFRONT_URL = "https://www.amazon.com/shop/digitaljared";

export default function AmazonStorefrontBanner() {
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
    <div className="border-b border-amber-300/30 bg-gradient-to-r from-[#1a0a05] via-[#3a1d05] to-[#1a0a05] px-3 py-2">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <a
          href={STOREFRONT_URL}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          onClick={() => trackEvent("shop", "amazon_storefront_click", "banner")}
          className="group flex flex-1 items-center gap-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF9900] text-base font-black text-black ring-1 ring-amber-300/40 sm:h-10 sm:w-10">
            a
          </span>
          <span className="flex flex-col leading-tight sm:flex-row sm:items-center sm:gap-2">
            <span className="text-[0.78rem] font-semibold text-amber-200 sm:text-sm">
              Shop our Amazon picks
            </span>
            <span className="hidden text-[0.7rem] text-white/60 sm:inline">
              · Hand-picked finds, fast Prime shipping
            </span>
            <span className="text-[0.65rem] font-medium text-amber-300/80 underline-offset-2 group-hover:underline sm:text-[0.7rem]">
              amazon.com/shop/digitaljared →
            </span>
          </span>
          <span className="ml-auto hidden text-[0.55rem] font-normal text-white/30 sm:inline">
            paid link
          </span>
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss Amazon storefront banner"
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
