"use client";
import dynamic from "next/dynamic";
const StudioShell = dynamic(() => import("./Shell").then(m => m.Shell), {
  ssr: false,
  loading: () => <div role="status" className="p-8 text-white/70">Opening your studio…</div>,
});
export function StudioLoader() { return <StudioShell />; }
