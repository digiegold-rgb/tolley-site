import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeRuleWrite } from "@/lib/vater/rules";
import { seedCharacterRules } from "@/lib/vater/rules/character-seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/vater/rules/character-seed  { characterId, name?, descriptor?, role?, attire? }
 *
 * Session-authed wrapper around lib/vater/rules/character-seed.ts. Hidden
 * tab users cannot be seeded through this route (they have no session);
 * DGX scripts call the core directly.
 */
export async function POST(req: NextRequest) {
  const writer = await authorizeRuleWrite();
  if (!writer.ok) return writer.response;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const characterId = typeof body?.characterId === "string" ? body.characterId.trim().slice(0, 80) : "";
  if (!characterId) return NextResponse.json({ error: "characterId required" }, { status: 400 });

  let name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
  let descriptor = typeof body?.descriptor === "string" ? body.descriptor.trim().slice(0, 4000) : "";
  const db = await prisma.youTubeCharacter.findUnique({
    where: { id: characterId },
    select: { id: true, name: true, description: true, briefDescription: true, style: { select: { userId: true } } },
  }).catch(() => null);
  if (db) {
    if (db.style?.userId && db.style.userId !== writer.userId && !writer.studio) {
      return NextResponse.json({ error: "not your character" }, { status: 403 });
    }
    name = name || db.name;
    descriptor = descriptor || db.description || db.briefDescription || "";
  }
  if (!name) return NextResponse.json({ error: "name required for a character not in the database" }, { status: 400 });

  const result = await seedCharacterRules({
    ownerId: writer.userId,
    email: writer.email,
    characterId,
    name,
    descriptor,
    attire: typeof body?.attire === "string" ? body.attire : undefined,
    role: typeof body?.role === "string" ? body.role : undefined,
  });
  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}
