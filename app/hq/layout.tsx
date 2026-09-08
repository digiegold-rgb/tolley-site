import type { Metadata } from "next";

import { ToastProvider } from "@/components/ui/Toast";

import "./hq.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Growth HQ",
  robots: { index: false, follow: false },
};

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="hq-admin">{children}</div>
    </ToastProvider>
  );
}
