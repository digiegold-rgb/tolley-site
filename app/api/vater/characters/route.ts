/**
 * GET /api/vater/characters
 *
 * The caller's character library, proxied from the DGX
 * (GET /vater/characters?owner=u_<userId>). Characters are minted per owner
 * on the box, so the `owner` scope is what keeps one customer's cast
 * invisible to everyone else — the owner account asks for `all`.
 *
 * Returns `{ characters: [...] }`. When the DGX hasn't shipped the endpoint
 * yet it answers 404, which we report as an EMPTY list plus
 * `unavailable: true` — the screen renders its empty state instead of an
 * error, because "no characters yet" and "not built yet" look the same to
 * someone who has never made one.
 *
 * Real failures (502, timeouts, a misconfigured box) still surface as errors:
 * silently swallowing those would tell a user their cast was deleted.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import { ownerKeyForUser } from "@/lib/vater/voice-ids";
import { dgxCall } from "@/lib/vater/dgx-feature-proxy";

export interface VaterCharacter {
  id: string;
  name: string;
  descriptor: string;
  previewUrl: string | null;
  styleId: string | null;
}

/** The DGX answers with either a bare array or `{ characters: [...] }`. */
function readCharacters(data: unknown): VaterCharacter[] {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { characters?: unknown })?.characters)
      ? ((data as { characters: unknown[] }).characters)
      : [];
  const out: VaterCharacter[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id =
      typeof r.id === "string" && r.id
        ? r.id
        : typeof r.name === "string"
          ? r.name
          : null;
    if (!id || typeof r.name !== "string") continue;
    out.push({
      id,
      name: r.name,
      descriptor:
        typeof r.descriptor === "string"
          ? r.descriptor
          : typeof r.description === "string"
            ? r.description
            : "",
      previewUrl:
        typeof r.previewUrl === "string"
          ? r.previewUrl
          : typeof r.imageUrl === "string"
            ? r.imageUrl
            : null,
      styleId: typeof r.styleId === "string" ? r.styleId : null,
    });
  }
  return out;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owner = isVaterAdminEmail(session.user.email)
    ? "all"
    : ownerKeyForUser(session.user.id);

  const result = await dgxCall<unknown>(
    "GET",
    `/vater/characters?owner=${encodeURIComponent(owner)}`,
    undefined,
    20_000,
  );

  if (result.kind === "unavailable") {
    return NextResponse.json({
      characters: [],
      unavailable: true,
      detail: result.reason,
    });
  }
  if (result.kind === "error") {
    return NextResponse.json(
      {
        error: "Could not load your characters",
        detail: result.body.slice(0, 300),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ characters: readCharacters(result.data), owner });
}
