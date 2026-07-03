"use client";

import { usePathname } from "next/navigation";
import { VideoFooter } from "./video-footer";

export function VideoFooterWrapper() {
  const pathname = usePathname();
  if (pathname === "/video/studio") return null;
  return <VideoFooter />;
}
