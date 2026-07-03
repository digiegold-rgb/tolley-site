import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Studio | Tolley.io",
  description: "ComfyUI video generation studio powered by DGX Spark",
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
