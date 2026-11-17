"use client";
import { usePathname } from "next/navigation";
/** Private bearer links and operator billing pages must not reach analytics providers. */
export function AnalyticsPrivacyBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  if (path?.startsWith("/laundry/request/") || path === "/laundry/dashboard")
    return null;
  return children;
}
