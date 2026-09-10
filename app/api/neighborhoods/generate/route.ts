import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { validateOwnerTool as validateShopAdmin } from "@/lib/leads/owner-tool-auth";
import { serpapiKey } from "@/lib/serpapi";
import {
  ensureSeeded,
  generateAll,
  generateOne,
} from "@/lib/neighborhoods/generator";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!(await validateShopAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serpapiKey()) {
    return NextResponse.json({ error: "SERPAPI_KEY missing" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug : null;
  const force = body.force === true;

  await ensureSeeded();

  if (slug) {
    const r = await generateOne(slug, { force });
    return NextResponse.json(r);
  }

  // Bulk path — schedule via after() so the operator's POST returns fast.
  after(async () => {
    try {
      const summary = await generateAll({ force });
      console.log("[neighborhoods/generate] done", summary);
    } catch (err) {
      console.error("[neighborhoods/generate] failed", err);
    }
  });

  return NextResponse.json({ scheduled: true });
}
