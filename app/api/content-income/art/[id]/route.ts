import { prisma } from "@/lib/prisma";
import { renderTip } from "@/lib/content-income/art";
export const runtime = "nodejs";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = await prisma.contentIncomePost.findUnique({ where: { id }, select: { headline: true, points: true, format: true } });
  if (!p || p.format !== "image" || !Array.isArray(p.points) || !p.points.every(v => typeof v === "string")) return new Response("Not found", { status: 404 });
  const bytes = await renderTip(p.headline, p.points as string[]);
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex", "X-Art-Renderer": "bundled-outlines-v1" } });
}
