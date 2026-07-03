import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CalendarEvent {
  id: string;
  kind: "scheduled" | "recurring" | "posted";
  source: string;
  platforms: string[];
  title: string;
  when: string; // ISO timestamp
  status?: string;
}

const RECURRING_CRONS: Array<{
  id: string;
  source: string;
  platforms: string[];
  title: string;
  hour: number;
  minute: number;
}> = [
  // Times in America/Chicago (server may be UTC; we approximate via local hour offset).
  { id: "fb-9am", source: "FB daily verticals", platforms: ["facebook"], title: "FB daily posts (5 verticals)", hour: 9, minute: 0 },
  { id: "treasure-10am", source: "Treasure Haul cron", platforms: ["facebook"], title: "Treasure Haul daily post", hour: 10, minute: 0 },
  { id: "pinterest-8a", source: "Pinterest cron", platforms: ["pinterest"], title: "Pinterest morning post", hour: 8, minute: 0 },
  { id: "pinterest-1p", source: "Pinterest cron", platforms: ["pinterest"], title: "Pinterest midday post", hour: 13, minute: 0 },
  { id: "pinterest-7p", source: "Pinterest cron", platforms: ["pinterest"], title: "Pinterest evening post", hour: 19, minute: 0 },
];

function expandRecurring(days = 7): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const now = new Date();
  // Tolley operates in America/Chicago — UTC-5 (CDT) or UTC-6 (CST).
  // Approximate via JS local time on a Linux server set to America/Chicago,
  // or by adding the offset reported by toLocaleString.
  for (let d = 0; d < days; d += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    for (const cron of RECURRING_CRONS) {
      const when = new Date(day);
      when.setHours(cron.hour, cron.minute, 0, 0);
      if (when.getTime() < now.getTime() - 60 * 60 * 1000) continue; // skip past hour
      events.push({
        id: `${cron.id}-${day.toISOString().slice(0, 10)}`,
        kind: "recurring",
        source: cron.source,
        platforms: cron.platforms,
        title: cron.title,
        when: when.toISOString(),
      });
    }
  }
  return events;
}

export async function GET() {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const recent = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const scheduled = await prisma.socialPost.findMany({
    where: {
      OR: [
        { scheduledAt: { gte: recent, lte: horizon } },
        { postedAt: { gte: recent } },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    take: 200,
  });

  const dbEvents: CalendarEvent[] = scheduled.map((row) => ({
    id: row.id,
    kind: row.status === "posted" ? "posted" : "scheduled",
    source: row.source,
    platforms: row.platforms,
    title: row.title ?? row.caption.slice(0, 60),
    when: (row.postedAt ?? row.scheduledAt ?? row.createdAt).toISOString(),
    status: row.status,
  }));

  const events = [...dbEvents, ...expandRecurring(7)].sort(
    (a, b) => new Date(a.when).getTime() - new Date(b.when).getTime(),
  );

  return NextResponse.json({ events });
}
