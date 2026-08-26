/**
 * GET /api/vater/roster — the CANON house cast (Jeff Whitfield + the locked
 * supporting roster), proxied from the DGX (`GET /vater/roster`).
 *
 * Why this exists (2026-08-22): the cast Trey commissioned lived only as flat
 * files under ~/vater-studio/characters/ plus the roster block in
 * VATER-STANDING-SPEC.json. The renderer reads them; nothing in the studio UI
 * did. /api/vater/characters lists a DIFFERENT registry — the per-owner
 * sidecars minted by Character Lab — so the Characters screen showed QA smoke
 * tests and auto-minted mentors while Jeff, the one character every video is
 * actually built around, was invisible. You could not confirm who a render
 * would use, and picking a style that wasn't his silently swapped the host.
 *
 * Visibility: the house lane only — vater admins and the studio allowlist.
 * Jeff is Trey's show character, NOT a system asset: never expose this roster
 * to public /animate tenants.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";
import { dgxCall } from "@/lib/vater/dgx-feature-proxy";

export interface CanonCastMember {
  id: string;
  slug: string;
  name: string;
  role: "host" | "supporting";
  gender: string;
  aliases: string[];
  age: string;
  occupation: string;
  descriptor: string;
  descriptorFile: string;
  wardrobe: { rule: string; outfits: string[]; count: number };
  invariants: string[];
  referenceUrl: string | null;
  placeInEveryImage: boolean;
  status: string;
  approved: boolean;
  note: string;
  formerNames: string[];
  provenance: string;
}

export interface CanonRoster {
  available: boolean;
  specVersion?: number;
  specUpdated?: string;
  lockedStyleName?: string;
  artStyle?: string;
  characterLock?: Record<string, string>;
  castRules?: Record<string, string>;
  roster: CanonCastMember[];
}

/** DGX `/vater/file/cast/<slug>/<file>` is bearer-authed → route it through
 *  the site's proxy, same trick as the style-asset URLs. */
function proxyRef(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/vater\/file\/cast\/([a-z0-9-]+)\/([a-zA-Z0-9_.-]+)$/);
  return m ? `/api/vater/file/cast/${m[1]}/${m[2]}` : null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;
  if (!isVaterAdminEmail(email) && !isVaterStudioEmail(email)) {
    // Not an error — a public tenant simply has no house cast.
    return NextResponse.json({ available: false, roster: [] });
  }
  if (session.workspace) {
    // The house cast (Jeff Whitfield & co.) belongs to the PRIMARY studio.
    // A second channel is a separate family by design — it builds its own
    // cast in the Character Lab (per-owner on the DGX).
    return NextResponse.json({ available: false, roster: [], workspace: true });
  }

  const result = await dgxCall<CanonRoster>("GET", "/vater/roster", undefined, 20_000);

  if (result.kind === "unavailable") {
    return NextResponse.json({
      available: false,
      roster: [],
      unavailable: true,
      detail: result.reason,
    });
  }
  if (result.kind === "error") {
    return NextResponse.json(
      { error: "Could not load the house cast", detail: result.body.slice(0, 300) },
      { status: 502 },
    );
  }

  const data = result.data;
  const roster = (Array.isArray(data?.roster) ? data.roster : []).map((c) => ({
    ...c,
    referenceUrl: proxyRef(c.referenceUrl),
  }));
  return NextResponse.json({ ...data, roster });
}
