// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/leads/crm/tasks
 *
 * List tasks with filters.
 * Query params: filter (overdue|today|week|all), leadId, clientId, dealId
 */
export async function GET(request: NextRequest) {
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

    const params = request.nextUrl.searchParams;
    const filter = params.get("filter") || "all";
    const leadId = params.get("leadId");
    const clientId = params.get("clientId");
    const dealId = params.get("dealId");

    const where: Record<string, unknown> = { subscriberId: sub.id };

    // Entity filters
    if (leadId) where.leadId = leadId;
    if (clientId) where.clientId = clientId;
    if (dealId) where.dealId = dealId;

    // Time-based filters
    const now = new Date();
    if (filter === "overdue") {
      where.dueDate = { lt: now };
      where.status = { notIn: ["completed", "cancelled"] };
    } else if (filter === "today") {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      where.dueDate = { gte: startOfDay, lte: endOfDay };
    } else if (filter === "week") {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      where.dueDate = { gte: now, lte: endOfWeek };
    }

    const tasks = await prisma.crmTask.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            ownerName: true,
            listing: { select: { address: true } },
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Serialize dates
    const serialized = tasks.map((t) => ({
      ...t,
      dueDate: t.dueDate?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return NextResponse.json({ tasks: serialized });
  } catch (err) {
    console.error("[CRM Tasks GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/leads/crm/tasks
 *
 * Create a task.
 * Body: { title, description?, leadId?, clientId?, dealId?, type?, priority?, dueDate?, isRecurring?, recurPattern? }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      title,
      description,
      leadId,
      clientId,
      dealId,
      type,
      priority,
      dueDate,
      isRecurring,
      recurPattern,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const task = await prisma.crmTask.create({
      data: {
        subscriberId: sub.id,
        title: title.trim(),
        ...(description ? { description } : {}),
        ...(leadId ? { leadId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(dealId ? { dealId } : {}),
        ...(type ? { type } : {}),
        ...(priority ? { priority } : {}),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(isRecurring !== undefined ? { isRecurring } : {}),
        ...(recurPattern ? { recurPattern } : {}),
      },
      include: {
        lead: {
          select: {
            id: true,
            ownerName: true,
            listing: { select: { address: true } },
          },
        },
        client: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    // Log activity on the linked entity
    await prisma.crmActivity.create({
      data: {
        subscriberId: sub.id,
        ...(leadId ? { leadId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(dealId ? { dealId } : {}),
        type: "task_created",
        title: `Task created: ${title.trim()}`,
        metadata: { taskId: task.id, taskType: type || "follow_up" },
      },
    });

    return NextResponse.json(
      {
        task: {
          ...task,
          dueDate: task.dueDate?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[CRM Tasks POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/leads/crm/tasks
 *
 * Update a task (complete, reschedule, etc.).
 * Body: { id, status?, title?, description?, priority?, dueDate? }
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { id, status, title, description, priority, dueDate } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Task id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.crmTask.findUnique({ where: { id } });
    if (!existing || existing.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

    // If completing, set completedAt
    if (status === "completed") {
      data.completedAt = new Date();
    }

    const task = await prisma.crmTask.update({
      where: { id },
      data,
      include: {
        lead: {
          select: {
            id: true,
            ownerName: true,
            listing: { select: { address: true } },
          },
        },
        client: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    // Log completion activity
    if (status === "completed") {
      await prisma.crmActivity.create({
        data: {
          subscriberId: sub.id,
          ...(task.leadId ? { leadId: task.leadId } : {}),
          ...(task.clientId ? { clientId: task.clientId } : {}),
          ...(task.dealId ? { dealId: task.dealId } : {}),
          type: "task_completed",
          title: `Completed: ${task.title}`,
          metadata: { taskId: task.id },
        },
      });
    }

    return NextResponse.json({
      task: {
        ...task,
        dueDate: task.dueDate?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[CRM Tasks PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/leads/crm/tasks?id=xxx
 *
 * Delete a task.
 */
export async function DELETE(request: NextRequest) {
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

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Task id is required" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.crmTask.findUnique({ where: { id } });
    if (!existing || existing.subscriberId !== sub.id) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await prisma.crmTask.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CRM Tasks DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
