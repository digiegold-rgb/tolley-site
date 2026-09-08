"use client";
import { useEffect, useState } from "react";
/** Age labels keep advancing even when the dashboard is left open. */
export function useReportClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
