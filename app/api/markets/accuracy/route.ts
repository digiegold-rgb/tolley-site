import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/markets/accuracy?days=90
 * Public endpoint — returns prediction accuracy stats.
 */
export async function GET(request: NextRequest) {
  const days = Math.min(
    parseInt(request.nextUrl.searchParams.get("days") || "90", 10),
    365,
  );
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get all validated archives in range
  const archives = await prisma.marketSignalArchive.findMany({
    where: {
      createdAt: { gte: since },
      wasAccurate: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  // Get unvalidated count
  const unvalidatedCount = await prisma.marketSignalArchive.count({
    where: {
      createdAt: { gte: since },
      wasAccurate: null,
    },
  });

  // Calculate stats
  const total = archives.length;
  const accurate = archives.filter((a) => a.wasAccurate === true).length;
  const overallRate = total > 0 ? accurate / total : 0;

  // By category
  const categories = [...new Set(archives.map((a) => a.category))];
  const byCategory: Record<string, { total: number; accurate: number; rate: number }> = {};
  for (const cat of categories) {
    const catArchives = archives.filter((a) => a.category === cat);
    const catAccurate = catArchives.filter((a) => a.wasAccurate === true).length;
    byCategory[cat] = {
      total: catArchives.length,
      accurate: catAccurate,
      rate: catArchives.length > 0 ? catAccurate / catArchives.length : 0,
    };
  }

  // By scope
  const scopes = [...new Set(archives.map((a) => a.scope))];
  const byScope: Record<string, { total: number; accurate: number; rate: number }> = {};
  for (const scope of scopes) {
    const scopeArchives = archives.filter((a) => a.scope === scope);
    const scopeAccurate = scopeArchives.filter((a) => a.wasAccurate === true).length;
    byScope[scope] = {
      total: scopeArchives.length,
      accurate: scopeAccurate,
      rate: scopeArchives.length > 0 ? scopeAccurate / scopeArchives.length : 0,
    };
  }

  // By signal type
  const signalTypes = [...new Set(archives.map((a) => a.signal))];
  const bySignalType: Record<string, { total: number; accurate: number; rate: number }> = {};
  for (const sig of signalTypes) {
    const sigArchives = archives.filter((a) => a.signal === sig);
    const sigAccurate = sigArchives.filter((a) => a.wasAccurate === true).length;
    bySignalType[sig] = {
      total: sigArchives.length,
      accurate: sigAccurate,
      rate: sigArchives.length > 0 ? sigAccurate / sigArchives.length : 0,
    };
  }

  // Recent validations (last 10)
  const recentValidations = archives.slice(0, 10).map((a) => ({
    id: a.id,
    category: a.category,
    signal: a.signal,
    scope: a.scope,
    title: a.title,
    confidence: a.confidence,
    wasAccurate: a.wasAccurate,
    createdAt: a.createdAt.toISOString(),
    archivedAt: a.archivedAt.toISOString(),
  }));

  // Confidence calibration: how well does confidence correlate with accuracy?
  const confidenceBuckets = [
    { range: "0.0-0.4", min: 0, max: 0.4 },
    { range: "0.4-0.6", min: 0.4, max: 0.6 },
    { range: "0.6-0.8", min: 0.6, max: 0.8 },
    { range: "0.8-1.0", min: 0.8, max: 1.0 },
  ];
  const confidenceCalibration = confidenceBuckets.map(({ range, min, max }) => {
    const bucket = archives.filter((a) => a.confidence >= min && a.confidence < max);
    const bucketAccurate = bucket.filter((a) => a.wasAccurate === true).length;
    return {
      range,
      total: bucket.length,
      accurate: bucketAccurate,
      rate: bucket.length > 0 ? bucketAccurate / bucket.length : 0,
    };
  });

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    overall: { total, accurate, rate: overallRate, unvalidated: unvalidatedCount },
    byCategory,
    byScope,
    bySignalType,
    confidenceCalibration,
    recentValidations,
  });
}
