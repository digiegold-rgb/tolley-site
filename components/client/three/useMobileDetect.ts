"use client";

import { useState, useEffect } from "react";

export type DeviceTier = "none" | "minimal" | "full";

export function useMobileDetect(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>("full");

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 480) setTier("none");
      else if (w < 768) setTier("minimal");
      else setTier("full");
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return tier;
}
