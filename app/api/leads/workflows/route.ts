/**
 * GET  /api/leads/workflows — List user's saved workflows
 * POST /api/leads/workflows — Create or update a workflow (upsert by id)
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth as getSession } from "@/auth";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflows = await prisma.pipelineWorkflow.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ workflows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, name, description, nodes, edges, isActive } = body;

  if (!nodes || !edges) {
    return NextResponse.json(
      { error: "nodes and edges are required" },
      { status: 400 }
    );
  }

  // If setting as active, deactivate others first
  if (isActive) {
    await prisma.pipelineWorkflow.updateMany({
      where: { userId: session.user.id, isActive: true },
      data: { isActive: false },
    });
  }

  let workflow;
  if (id) {
    // Update existing — verify ownership
    const existing = await prisma.pipelineWorkflow.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    workflow = await prisma.pipelineWorkflow.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description ?? existing.description,
        nodes,
        edges,
        isActive: isActive ?? existing.isActive,
      },
    });
  } else {
    // Create new
    workflow = await prisma.pipelineWorkflow.create({
      data: {
        userId: session.user.id,
        name: name || "My Pipeline",
        description: description || null,
        nodes,
        edges,
        isActive: isActive ?? false,
      },
    });
  }

  return NextResponse.json({ workflow });
}
