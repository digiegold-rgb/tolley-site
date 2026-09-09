"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** URL fragments never reach the server; preserve old shared product anchors. */
export function LegacyAgentLinks() {
  const router = useRouter();
  useEffect(() => {
    const redirect = () => {
      if (["#features", "#pricing", "#demo"].includes(window.location.hash)) router.replace(`/agent${window.location.search}${window.location.hash}`);
    };
    redirect();
    window.addEventListener("hashchange", redirect);
    return () => window.removeEventListener("hashchange", redirect);
  }, [router]);
  return null;
}
