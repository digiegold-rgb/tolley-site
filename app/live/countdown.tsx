"use client";
import { useEffect, useState } from "react";
export default function Countdown({ startsAt }: { startsAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Date.parse(startsAt) - Date.now()));
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id);
  }, [startsAt]);
  if (remaining === null) return null;
  const minutes = Math.ceil(remaining / 60000);
  return <p className="haul-countdown">{minutes > 0 ? `Next confirmed show in ${Math.floor(minutes / 60)}h ${minutes % 60}m` : "Scheduled start time reached — check Whatnot for live status."}</p>;
}
