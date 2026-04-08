import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const NEON_API = "https://console.neon.tech/api/v2";

export async function GET() {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  const limitGb = parseFloat(process.env.NEON_TRANSFER_LIMIT_GB || "5");

  if (apiKey && projectId) {
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const to = now.toISOString();

      const res = await fetch(
        `${NEON_API}/projects/${projectId}/consumption?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&granularity=monthly`,
        {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          next: { revalidate: 300 },
        },
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: "Neon API error", detail: err }, { status: res.status });
      }

      const body = await res.json();

      const transferBytes = body.data_transfer_bytes || 0;
      const computeSeconds = body.compute_time_seconds || 0;
      const logicalBytes = body.logical_size_for_root_bytes || 0;
      const pitrBytes = body.pitr_history_size_for_root_bytes || 0;

      const usedGb = transferBytes / (1024 ** 3);
      const pct = limitGb > 0 ? Math.min(100, (usedGb / limitGb) * 100) : 0;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const projectedGb = dayOfMonth > 0 ? (usedGb / dayOfMonth) * daysInMonth : usedGb;

      return NextResponse.json({
        source: "api",
        usedGb: Math.round(usedGb * 100) / 100,
        limitGb,
        pct: Math.round(pct * 10) / 10,
        projectedGb: Math.round(projectedGb * 100) / 100,
        computeHours: Math.round((computeSeconds / 3600) * 10) / 10,
        storageMb: Math.round(logicalBytes / (1024 ** 2)),
        pitrMb: Math.round(pitrBytes / (1024 ** 2)),
        dayOfMonth,
        daysInMonth,
      });
    } catch (e) {
      return NextResponse.json({ error: "Failed to fetch Neon consumption", detail: String(e) }, { status: 500 });
    }
  }

  // Fallback: use env vars for manual override
  const usedGb = parseFloat(process.env.NEON_TRANSFER_USED_GB || "4.1");
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const pct = limitGb > 0 ? Math.min(100, (usedGb / limitGb) * 100) : 0;
  const projectedGb = dayOfMonth > 0 ? (usedGb / dayOfMonth) * daysInMonth : usedGb;

  return NextResponse.json({
    source: "env",
    usedGb,
    limitGb,
    pct: Math.round(pct * 10) / 10,
    projectedGb: Math.round(projectedGb * 100) / 100,
    dayOfMonth,
    daysInMonth,
  });
}
