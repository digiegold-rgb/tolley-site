import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { customerLeads } from "@/lib/customer-leads";
import { isAdminEmail } from "@/lib/admin-auth";
import { secretEquals } from "@/lib/secret-compare";
import { z } from "zod";
import { rateLimitByIp } from "@/lib/rate-limit";
import { incrementActivity } from "@/lib/activity-log";

export const runtime = "nodejs";

async function leadAccess(request: NextRequest) {
  if (secretEquals(request.headers.get("x-sync-secret"), process.env.SYNC_SECRET)) return { store: prisma.lead };
  const session = await auth();
  if (!session?.user?.id) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.impersonatedBy && !["GET", "HEAD"].includes(request.method)) return { response: NextResponse.json({ error: "Read-only support session" }, { status: 403 }) };
  if (isAdminEmail(session.user.email)) return { store: prisma.lead };
  const sub = await prisma.leadSubscriber.findUnique({ where: { userId: session.user.id } });
  if (!sub || sub.status !== "active") return { response: NextResponse.json({ error: "Active subscription required" }, { status: 403 }) };
  return { store: customerLeads(sub.id), subscriberId: sub.id };
}

const updateSchema = z.object({
  id: z.string().min(1).max(128),
  status: z.enum(["new", "contacted", "interested", "showing", "referred", "closed", "past_client", "dead"]).optional(),
  notes: z.string().max(20000).nullable().optional(),
  referredTo: z.string().max(500).nullable().optional(),
  referralStatus: z.enum(["pending", "accepted", "paid", "declined", "closed"]).nullable().optional(),
  referralFee: z.number().min(0).max(100000000).nullable().optional(),
  ownerName: z.string().max(300).nullable().optional(),
  ownerPhone: z.string().max(50).nullable().optional(),
  ownerEmail: z.union([z.email(), z.literal("")]).nullable().optional(),
  contactedAt: z.iso.datetime().nullable().optional(),
  closedAt: z.iso.datetime().nullable().optional(),
}).strict();

/**
 * GET /api/leads
 *
 * List leads with filtering and sorting.
 * Query params:
 *   ?status=new,contacted   — filter by status (comma-separated)
 *   ?minScore=25            — minimum lead score
 *   ?source=mls_expired     — filter by source
 *   ?limit=20               — max results (default 50)
 *   ?offset=0               — pagination offset
 */
export async function GET(request: NextRequest) {
  const access = await leadAccess(request);
  if (access.response) return access.response;
  const store = access.store!;

  const params = request.nextUrl.searchParams;
  const statusFilter = params.get("status")?.split(",") || undefined;
  const minScore = Number(params.get("minScore")) || 0;
  const source = params.get("source") || undefined;
  const limit = Math.max(1, Math.min(Math.floor(Number(params.get("limit")) || 50), 200));
  const offset = Math.max(0, Math.floor(Number(params.get("offset")) || 0));

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = { in: statusFilter };
  if (minScore > 0) where.score = { gte: minScore };
  if (source) where.source = source;

  const [leads, total] = await Promise.all([
    store.findMany({
      where,
      include: {
        listing: {
          select: {
            id: true,
            mlsId: true,
            address: true,
            city: true,
            zip: true,
            listPrice: true,
            originalListPrice: true,
            daysOnMarket: true,
            beds: true,
            baths: true,
            sqft: true,
            status: true,
            listingUrl: true,
            photoUrls: true,
            listAgentName: true,
            listOfficeName: true,
            enrichment: {
              select: {
                buyScore: true,
                nearestSchoolName: true,
                nearestSchoolDist: true,
                schoolsWithin3mi: true,
                nearestHospitalName: true,
                nearestHospitalDist: true,
                nearestFireStationDist: true,
                nearestParkName: true,
                nearestParkDist: true,
                parksWithin2mi: true,
                nearestGroceryName: true,
                nearestGroceryDist: true,
                nearestAirportName: true,
                nearestAirportDist: true,
                restaurantsWithin1mi: true,
                nearestCourthouseName: true,
                nearestCourthouseDist: true,
                nearestLibraryName: true,
                nearestLibraryDist: true,
                librariesWithin3mi: true,
                countyName: true,
                countyState: true,
                estimatedAnnualTax: true,
                estimatedMonthlyTax: true,
                effectiveTaxRate: true,
                taxBurdenRating: true,
              },
            },
          },
        },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    store.count({ where }),
  ]);

  return NextResponse.json({ leads, total, limit, offset });
}

/**
 * PATCH /api/leads
 *
 * Update a lead's status, notes, referral info.
 * Body: { id, status?, notes?, referredTo?, referralStatus?, referralFee?, contactedAt? }
 */
export async function PATCH(request: NextRequest) {
  const access = await leadAccess(request);
  if (access.response) return access.response;
  const store = access.store!;

  const limited = await rateLimitByIp(request, "leads:update", 120, 60);
  if (limited) return limited;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead update" }, { status: 400 });
  const { id, ...updates } = parsed.data;
  const allowed = Object.keys(updates);
  if (!(await store.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) {
      if (key === "contactedAt" || key === "closedAt") {
        data[key] = (updates as Record<string, unknown>)[key] ? new Date(String((updates as Record<string, unknown>)[key])) : null;
      } else {
        data[key] = (updates as Record<string, unknown>)[key];
      }
    }
  }

  const lead = await store.update({
    where: { id },
    data,
    include: { listing: { select: { address: true, mlsId: true } } },
  });

  // Track activity based on status changes
  const session = await auth();
  if (session?.user?.id) {
    const sub = await prisma.leadSubscriber.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (sub) {
      if (updates.status === "contacted") {
        incrementActivity(sub.id, "leadsContacted");
        incrementActivity(sub.id, "contactsMade");
      }
      if (updates.status === "closed" || updates.status === "referred") {
        incrementActivity(sub.id, "leadsConverted");
      }
    }
  }

  return NextResponse.json({ lead });
}

/** Manual leads belong to the submitting customer; never enter the shared pool. */
export async function POST(request: NextRequest) {
  const access = await leadAccess(request);
  if (access.response) return access.response;
  const limited = await rateLimitByIp(request, "leads:create", 30, 60);
  if (limited) return limited;
  const schema = updateSchema.pick({ ownerName: true, ownerPhone: true, ownerEmail: true, notes: true })
    .extend({ source: z.literal("fsbo_manual") });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid manual lead" }, { status: 400 });
  const lead = await prisma.$transaction(async tx => {
    const created = await tx.lead.create({ data: { ...parsed.data, ownerSubscriberId: access.subscriberId ?? null } });
    if (access.subscriberId) {
      await tx.customerLeadState.create({ data: { subscriberId: access.subscriberId, leadId: created.id,
        notes: parsed.data.notes, ownerName: parsed.data.ownerName, ownerPhone: parsed.data.ownerPhone,
        ownerEmail: parsed.data.ownerEmail } });
    }
    return created;
  });
  return NextResponse.json(lead, { status: 201 });
}
