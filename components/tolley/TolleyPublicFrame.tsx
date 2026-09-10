"use client";

import { usePathname } from "next/navigation";
import { tolleyThemeForPath } from "@/lib/tolley-theme";
import { TolleyHeader, TolleyFooter } from "./TolleyChrome";

export default function TolleyPublicFrame({ children }: { children: React.ReactNode }) {
  const theme = tolleyThemeForPath(usePathname());
  if (!theme) return children;
  return <div className="tolley-site" data-tolley-kind={theme.kind} data-tolley-service={theme.service}>
    <TolleyHeader />
    <div id="tolley-content" tabIndex={-1} className="tolley-content">{children}</div>
    <TolleyFooter />
  </div>;
}
