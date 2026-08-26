import "server-only";

import { prisma } from "@/lib/prisma";

/** Cast sheet for the DGX (regen + motion director): name, descriptor, and
 *  gender parsed from the descriptor opener — same parser as
 *  style-snapshot.ts / the regen route. */
export async function castForProject(
  styleId: string | null | undefined,
): Promise<Array<{ name: string; description: string; gender: string }>> {
  if (!styleId) return [];
  const rows = await prisma.youTubeCharacter.findMany({
    where: { styleId },
    select: { name: true, description: true },
  });
  return rows.map((c) => {
    const head = (c.description || "").slice(0, 200).toLowerCase();
    let gender = "female";
    if (/\bandrogynous\b/.test(head)) gender = "androgynous";
    else if (/\bmale\b/.test(head) && !/\bfemale\b/.test(head)) gender = "male";
    else if (/\bfemale\b/.test(head) || /\b(woman|girl|lady)\b/.test(head)) gender = "female";
    else if (/\b(man|boy|gentleman)\b/.test(head)) gender = "male";
    return { name: c.name, description: c.description ?? "", gender };
  });
}
