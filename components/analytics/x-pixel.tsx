"use client";

import Script from "next/script";

// X (Twitter) Ads pixel. NEXT_PUBLIC_X_PIXEL_ID is the short pixel id from
// Ads Manager → Events manager (e.g. "rep9b"). Conversion events are keyed by
// their own event ids ("tw-rep9b-xxxxx") — see NEXT_PUBLIC_X_PIXEL_SIGNUP_EVENT.
//
// Mirrors meta-pixel.tsx: the id is validated before it lands inside the inline
// script so a stray newline/space in the env var can't take the tag down.
const PIXEL_ID = (process.env.NEXT_PUBLIC_X_PIXEL_ID ?? "").trim();
const PIXEL_ID_OK = /^[a-z0-9]{3,12}$/i.test(PIXEL_ID);

const SIGNUP_EVENT_ID = (process.env.NEXT_PUBLIC_X_PIXEL_SIGNUP_EVENT ?? "").trim();

declare global {
  interface Window {
    twq?: (...args: unknown[]) => void;
  }
}

/** X Ads pixel — only renders when NEXT_PUBLIC_X_PIXEL_ID is set */
export function XPixel() {
  if (!PIXEL_ID_OK) return null;
  return (
    <Script id="x-pixel" strategy="afterInteractive">
      {`
      !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
      },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
      a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
      twq('config','${PIXEL_ID}');
    `}
    </Script>
  );
}

/** Fire an X pixel conversion event by its event id (no-op if not loaded) */
export function twqEvent(
  eventId: string,
  params?: Record<string, string | number | boolean>,
) {
  if (!eventId) return;
  if (typeof window !== "undefined" && typeof window.twq === "function") {
    window.twq("event", eventId, params ?? {});
  }
}

/** Jelly Studio signup conversion — wired to the "Sign up" event in Events manager */
export function twqSignup(params?: Record<string, string | number | boolean>) {
  twqEvent(SIGNUP_EVENT_ID, params);
}
