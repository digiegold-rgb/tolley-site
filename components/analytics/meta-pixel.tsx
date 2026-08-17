"use client";

import Script from "next/script";

// Meta (Facebook) Pixel. NEXT_PUBLIC_META_PIXEL_ID accepts a COMMA-SEPARATED
// list so a second Page/ad account can be measured without discarding the
// original pixel's conversion history — fbq('init', id) is additive, and every
// subsequent fbq('track', …) fires against every initialised pixel.
//
// .trim() on each id defends against a stray trailing newline/space in the env
// var — without it the value lands inside a JS string literal in the inline
// <Script> below and throws "appendChild ... Invalid or unexpected token",
// killing the pixel on every page.
const PIXEL_IDS = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "")
  .split(",")
  .map((id) => id.trim())
  // Only digits reach the inline script — a malformed id would otherwise be
  // injected verbatim into JS source and take the whole tag down with it.
  .filter((id) => /^\d+$/.test(id));

/** Meta (Facebook) Pixel — only renders when NEXT_PUBLIC_META_PIXEL_ID is set */
export function MetaPixel() {
  if (PIXEL_IDS.length === 0) return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        ${PIXEL_IDS.map((id) => `fbq('init', '${id}');`).join("\n        ")}
        fbq('track', 'PageView');
      `}
      </Script>
      <noscript>
        {PIXEL_IDS.map((id) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={id}
            height="1"
            width="1"
            style={{ display: "none" }}
            alt=""
            src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
          />
        ))}
      </noscript>
    </>
  );
}

/** Fire a Meta Pixel event on every initialised pixel (no-op if not loaded) */
export function fbqEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | string[]>,
) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", eventName, params);
  }
}
