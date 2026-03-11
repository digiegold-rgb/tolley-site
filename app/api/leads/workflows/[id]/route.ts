/**
 * GET    /api/leads/workflows/[id] — Fetch a single workflow
 * DELETE /api/leads/workflows/[id] — Delete a workflow
 */

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth as getSession } from "@/auth";

const prisma = new PrismaClient();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const workflow = await prisma.pipelineWorkflow.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!workflow)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ workflow });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.pipelineWorkflow.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pipelineWorkflow.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
