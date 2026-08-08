import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GPU Comparison for AI Video & Image Generation | Tolley.io",
  description:
    "Side-by-side GPU comparison for AI image and video generation — speed, VRAM, cloud hourly cost, buy price, and home power draw across data-center and consumer cards.",
  alternates: { canonical: "https://www.tolley.io/gpu" },
};

export default function GpuLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
