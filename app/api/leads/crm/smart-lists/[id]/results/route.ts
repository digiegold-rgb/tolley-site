// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

interface SmartListFilters {
  stages?: string[];
  pipelineStages?: string[];
  tags?: string[];
  sources?: string[];
  minScore?: number;
  lastContactDays?: number;
  type?: "lead" | "client" | "all";
}

/**
 * GET /api/leads/crm/smart-lists/[id]/results
 *
 * Execute smart list filters and return matching leads/clients.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await prisma.leadSubscriber.findUnique({
      where: { userId },
    });
    if (!sub || sub.status !== "active") {
      return NextResponse.json({ error: "No active subscription" }, { status: 403 });
    }

    const { id } = await context.params;

    const smartList = await prisma.smartList.findUnique({ where: { id } });
    if (!smartList || smartList.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Smart list not found" }, { status: 404 });
    }

    const filters = smartList.filters as SmartListFilters;
    const filterType = filters.type || "all";
    const sortBy = smartList.sortBy || "score";
    const sortDir = (smartList.sortDir || "desc") as "asc" | "desc";

    const results: { leads?: unknown[]; clients?: unknown[] } = {};

    // Query leads
    if (filterType === "lead" || filterType === "all") {
      const leadWhere: Record<string, unknown> = {};

      if (filters.stages && filters.stages.length > 0) {
        leadWhere.status = { in: filters.stages };
      }
      if (filters.pipelineStages && filters.pipelineStages.length > 0) {
        leadWhere.pipelineStage = { in: filters.pipelineStages };
      }
      if (filters.tags && filters.tags.length > 0) {
        leadWhere.tags = {
          some: { tag: { name: { in: filters.tags } } },
        };
      }
      if (filters.sources && filters.sources.length > 0) {
        leadWhere.source = { in: filters.sources };
      }
      if (filters.minScore !== undefined && filters.minScore > 0) {
        leadWhere.score = { gte: filters.minScore };
      }
      if (filters.lastContactDays !== undefined) {
        if (filters.lastContactDays < 0) {
          // Negative means "never contacted"
          leadWhere.contactedAt = null;
        } else if (filters.lastContactDays > 0) {
          const cutoff = new Date(Date.now() - filters.lastContactDays * 86400000);
          leadWhere.contactedAt = { gte: cutoff };
        }
      }

      // Filter by subscriber's farm zips if set
      if (sub.farmZips && sub.farmZips.length > 0) {
        leadWhere.listing = { zip: { in: sub.farmZips } };
      }

      // Build orderBy
      const leadOrderBy = buildLeadOrderBy(sortBy, sortDir);

      const leads = await prisma.lead.findMany({
        where: leadWhere,
        include: {
          listing: {
            select: {
              id: true,
              address: true,
              city: true,
              zip: true,
              listPrice: true,
              beds: true,
              baths: true,
              sqft: true,
              photoUrls: true,
              status: true,
            },
          },
          tags: { include: { tag: true } },
          _count: {
            select: {
              tasks: { where: { status: "pending" } },
              activities: true,
            },
          },
        },
        orderBy: leadOrderBy,
        take: 200,
      });

      results.leads = leads.map((lead) => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        contactedAt: lead.contactedAt?.toISOString() ?? null,
        closedAt: lead.closedAt?.toISOString() ?? null,
      }));
    }

    // Query clients
    if (filterType === "client" || filterType === "all") {
      const clientWhere: Record<string, unknown> = {
        subscriberId: sub.id,
      };

      if (filters.stages && filters.stages.length > 0) {
        clientWhere.status = { in: filters.stages };
      }
      if (filters.tags && filters.tags.length > 0) {
        clientWhere.tags = {
          some: { tag: { name: { in: filters.tags } } },
        };
      }
      if (filters.minScore !== undefined && filters.minScore > 0) {
        clientWhere.fitScore = { gte: filters.minScore };
      }

      const clientOrderBy = buildClientOrderBy(sortBy, sortDir);

      const clients = await prisma.client.findMany({
        where: clientWhere,
        include: {
          tags: { include: { tag: true } },
          _count: {
            select: {
              tasks: { where: { status: "pending" } },
              activities: true,
            },
          },
        },
        orderBy: clientOrderBy,
        take: 200,
      });

      results.clients = clients.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));
    }

    return NextResponse.json({
      smartList: {
        id: smartList.id,
        name: smartList.name,
        icon: smartList.icon,
        filters: smartList.filters,
        sortBy: smartList.sortBy,
        sortDir: smartList.sortDir,
      },
      ...results,
    });
  } catch (err) {
    console.error("[CRM SmartList Results GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildLeadOrderBy(
  sortBy: string,
  sortDir: "asc" | "desc"
): Record<string, string> | Record<string, string>[] {
  switch (sortBy) {
    case "score":
      return { score: sortDir };
    case "lastContact":
      return { contactedAt: sortDir };
    case "createdAt":
      return { createdAt: sortDir };
    case "name":
      return { ownerName: sortDir };
    default:
      return [{ score: "desc" }, { createdAt: "desc" }];
  }
}

function buildClientOrderBy(
  sortBy: string,
  sortDir: "asc" | "desc"
): Record<string, string> | Record<string, string>[] {
  switch (sortBy) {
    case "score":
      return { fitScore: sortDir };
    case "createdAt":
      return { createdAt: sortDir };
    case "name":
      return { lastName: sortDir };
    default:
      return [{ fitScore: "desc" }, { createdAt: "desc" }];
  }
}
