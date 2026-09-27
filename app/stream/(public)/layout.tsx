import type { Metadata } from "next";

// Public on purpose: OBS Browser Source, a phone, and a TV load this without
// the owner session. Do not add stream controls, director calls, or lineup edits here.
export const metadata: Metadata = {
  title: "Treasure Hauls live slideshow",
  robots: { index: false, follow: false },
};

export default function PublicStreamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
