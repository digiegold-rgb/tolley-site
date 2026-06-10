// Inline stroke icons for /demo/[slug] category service cards.
// Single component keyed by name — keeps the demo pages dependency-free
// (no icon library) and lets each category theme pick its own set.

import type { ReactNode } from "react";

export type DemoIconName =
  | "wrench"
  | "gauge"
  | "tire"
  | "battery"
  | "brake"
  | "oil"
  | "scissors"
  | "comb"
  | "sparkle"
  | "polish"
  | "flower"
  | "hand"
  | "leaf"
  | "mower"
  | "tree"
  | "shovel"
  | "droplet"
  | "pipe"
  | "flame"
  | "valve"
  | "bread"
  | "cake"
  | "cookie"
  | "coffee"
  | "plate"
  | "bowl"
  | "hanger"
  | "tag"
  | "gift"
  | "hammer"
  | "ruler"
  | "paint"
  | "home"
  | "paw"
  | "bone"
  | "bath"
  | "heart"
  | "star"
  | "shield"
  | "clock"
  | "mappin"
  | "phone"
  | "check"
  | "calendar"
  | "chat";

const PATHS: Record<DemoIconName, ReactNode> = {
  wrench: (
    <path d="M14.7 6.3a4.5 4.5 0 0 0-6.2 5.5L3 17.3a2 2 0 1 0 2.8 2.8l5.5-5.5a4.5 4.5 0 0 0 5.5-6.2l-2.6 2.6-2.5-.7-.7-2.5 2.7-2.5Z" />
  ),
  gauge: (
    <>
      <path d="M12 21a9 9 0 1 1 9-9" />
      <path d="m12 12 5-3" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  tire: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="8" width="17" height="10" rx="2" />
      <path d="M21.5 11.5v3M6 12.5v1.5M6 13.2h0M5 13.2h2M16 13.2h2" />
    </>
  ),
  brake: (
    <>
      <circle cx="12" cy="12" r="5.5" />
      <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5M12 21.5A9.5 9.5 0 0 1 2.5 12" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  oil: (
    <>
      <path d="M12 3.5s5.5 6.2 5.5 10a5.5 5.5 0 1 1-11 0c0-3.8 5.5-10 5.5-10Z" />
      <path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="M8.2 8 20 19M8.2 16 20 5" />
    </>
  ),
  comb: (
    <>
      <path d="M5 4h4v16H5zM9 6h10M9 9h8M9 12h10M9 15h8M9 18h10" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </>
  ),
  polish: (
    <>
      <path d="M10 3h4v5h-4zM8.5 8h7l1 12.5h-9L8.5 8Z" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="9" r="2.2" />
      <path d="M12 6.3V3.2M14.2 7.6l2.2-2.2M15 9.8h3.1M9.8 7.6 7.6 5.4M9 9.8H5.9" />
      <path d="M12 11.5V21M12 17.3c-2.4 0-4-1.4-4.5-3.1M12 19.3c2.4 0 4-1.4 4.5-3.1" />
    </>
  ),
  hand: (
    <>
      <path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v6.5" />
      <path d="M16 11.5c0-1.5 3-2 3 0 0 3.5-1.5 5-2.5 6.5S15 21 12 21c-2.5 0-4-1-5-3l-2.2-4.2c-.8-1.6 1.4-2.8 2.5-1.3L8.5 14" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-9 5-14 14-14 0 9-5 14-14 14Z" />
      <path d="M5 19c4-4 7-7 10-10" />
    </>
  ),
  mower: (
    <>
      <path d="M3 15V8l8-3 7 5v5" />
      <circle cx="7" cy="17.5" r="2.5" />
      <circle cx="17" cy="17.5" r="2.5" />
      <path d="M9.5 17.5h5" />
    </>
  ),
  tree: (
    <>
      <path d="M12 3l5 6h-3l4 5h-4l3 4H7l3-4H6l4-5H7l5-6Z" />
      <path d="M12 18v3.5" />
    </>
  ),
  shovel: (
    <>
      <path d="M14 4l6 6M17 7 8.5 15.5" />
      <path d="M8.5 15.5 5 13.5c-2 2-2 5.5.5 6s4-2.5 4-2.5l-1-1.5Z" />
    </>
  ),
  droplet: (
    <path d="M12 3.5s6 6.8 6 11a6 6 0 1 1-12 0c0-4.2 6-11 6-11Z" />
  ),
  pipe: (
    <>
      <path d="M3 9h7a3 3 0 0 1 3 3v9" />
      <path d="M3 13h7" />
      <path d="M9 13v-4M17 21h-8" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3c1 3.5 5.5 5.5 5.5 10a5.5 5.5 0 1 1-11 0C6.5 9.5 10 8 12 3Z" />
      <path d="M12 21a2.8 2.8 0 0 1-2.8-2.8c0-1.7 1.7-2.7 2.8-4.7 1.1 2 2.8 3 2.8 4.7A2.8 2.8 0 0 1 12 21Z" />
    </>
  ),
  valve: (
    <>
      <circle cx="12" cy="14" r="4" />
      <path d="M12 10V5M8 5h8M12 18v3M4 14h4M16 14h4" />
    </>
  ),
  bread: (
    <>
      <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 1.5 7.7V19H6.5v-5.3A4 4 0 0 1 4 10Z" />
      <path d="M10 9.5c-1 1.5-1 3 0 4.5M14 9.5c-1 1.5-1 3 0 4.5" />
    </>
  ),
  cake: (
    <>
      <path d="M4 20h16M5 20v-7h14v7M7 13v-3M12 13v-3M17 13v-3" />
      <path d="M7 7.5a1.2 1.2 0 1 0 0-.01M12 7.5a1.2 1.2 0 1 0 0-.01M17 7.5a1.2 1.2 0 1 0 0-.01M7 4.5v1.5M12 4.5v1.5M17 4.5v1.5" />
    </>
  ),
  cookie: (
    <>
      <path d="M21 13a9 9 0 1 1-10-9 3.5 3.5 0 0 0 4.5 4.5A3.5 3.5 0 0 0 21 13Z" />
      <path d="M9 10h.01M10 15h.01M14 14h.01M8 13h.01M12 12h.01" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c-.8 1-.8 2 0 3M12 3.5c-.8 1-.8 2 0 3" />
    </>
  ),
  plate: (
    <>
      <path d="M5 3v7M8 3v7M6.5 10v11M6.5 3v0M16 3c-2 0-3 2.5-3 5.5 0 2 1 2.7 2 3v9.5M16 3c1.5 1 2.5 3 2.5 5.5 0 2-1 2.7-1.5 3" />
    </>
  ),
  bowl: (
    <>
      <path d="M4 11h16a8 8 0 0 1-5 7.4V20H9v-1.6A8 8 0 0 1 4 11Z" />
      <path d="M9 7.5c-.8-1-.8-2 0-3M13.5 7.5c-.8-1-.8-2 0-3" />
    </>
  ),
  hanger: (
    <>
      <path d="M12 7a2 2 0 1 1 2-2" />
      <path d="M12 7v2l-8.5 5.6A1.5 1.5 0 0 0 4.3 17h15.4a1.5 1.5 0 0 0 .8-2.4L12 9" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5 11 20l8.5-8.5V4h-7.5L3.5 12Z" />
      <circle cx="15.5" cy="8" r="1.3" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1" />
      <path d="M12 9v11M4 13h16M12 9S9 9 7.8 7.8a1.9 1.9 0 0 1 2.7-2.7C11.7 6.3 12 9 12 9ZM12 9s3 0 4.2-1.2a1.9 1.9 0 0 0-2.7-2.7C12.3 6.3 12 9 12 9Z" />
    </>
  ),
  hammer: (
    <>
      <path d="M14 5.5 12 7.5l4.5 4.5 2-2c1-1 .5-2-0.5-3l-1.5-1.5c-1-1-2-1.5-2.5 0Z" />
      <path d="m12.5 8-9 9a1.8 1.8 0 0 0 2.5 2.5l9-9" />
    </>
  ),
  ruler: (
    <>
      <rect x="3" y="9.5" width="18" height="6" rx="1" />
      <path d="M7 9.5V12M11 9.5v2.5M15 9.5V12M19 9.5v2.5" />
    </>
  ),
  paint: (
    <>
      <rect x="4" y="3.5" width="14" height="5" rx="1" />
      <path d="M18 5.5h2.5v4.5L13 12v2" />
      <rect x="11.5" y="14" width="3" height="6.5" rx="0.8" />
    </>
  ),
  home: (
    <>
      <path d="m3.5 11 8.5-7 8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  paw: (
    <>
      <circle cx="7" cy="8.5" r="1.8" />
      <circle cx="11" cy="5.5" r="1.8" />
      <circle cx="15.5" cy="6.5" r="1.8" />
      <circle cx="18.5" cy="10.5" r="1.8" />
      <path d="M8 16.5c0-2.5 2-5 5-5s5 2.5 5 5-1.5 4-5 4-5-1.5-5-4Z" />
    </>
  ),
  bone: (
    <>
      <path d="M7.5 9.5 14.5 16.5M9.5 7.5l7 7" />
      <path d="M9.5 7.5A2.3 2.3 0 1 0 6 4a2.3 2.3 0 1 0-2 3.5 2.3 2.3 0 1 0 3.5 2M14.5 16.5A2.3 2.3 0 1 0 18 20a2.3 2.3 0 1 0 2-3.5 2.3 2.3 0 1 0-3.5-2" />
    </>
  ),
  bath: (
    <>
      <path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Z" />
      <path d="M6 12V5.5A2 2 0 0 1 9.5 4M7 19.5 6 21.5M17 19.5l1 2M14 8.5c0 .8.7 1.5 1.5 1.5S17 9.3 17 8.5 15.5 6 15.5 6 14 7.7 14 8.5Z" />
    </>
  ),
  heart: (
    <path d="M12 20.5S3.5 15.5 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.9-8.5 10.9-8.5 10.9Z" />
  ),
  star: (
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.9L12 3.5Z" />
  ),
  shield: (
    <>
      <path d="M12 3 5 5.5v6c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5v-6L12 3Z" />
      <path d="m9 11.5 2 2 4-4.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  mappin: (
    <>
      <path d="M12 21s7-6.1 7-11.5a7 7 0 1 0-14 0C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  phone: (
    <path d="M5 4h4l1.5 4.5-2.2 1.6a12 12 0 0 0 5.6 5.6l1.6-2.2L20 15v4a1.8 1.8 0 0 1-2 1.8A16.5 16.5 0 0 1 3.2 6 1.8 1.8 0 0 1 5 4Z" />
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  chat: (
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.4A8 8 0 1 1 21 12Z" />
  ),
};

export function DemoIcon({
  name,
  className,
}: {
  name: DemoIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
