/**
 * GET /api/vater/listing/[id]/mls-export — license-gated MLS-safe bundle.
 *
 * Heartland MLS §11.2.1: listing photos carry no names, contact info, URLs,
 * logos, signs, people or characters. The bundle is the BARE staged still +
 * `photo-description.txt` ("Virtually staged") for the MLS photo-description
 * field. Zipped with jszip (in deps). `?format=json` returns
 * { stillUrl, description } instead — for the wizard's copy button.
 *
 * Gates: verified license (VaterAccount.licenseStatus), job `ready`, and
 * mlsSafePlan(job).allowed (material-change SKUs are social-only).
 */
import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

import { auth } from "@/auth";
import { readAgentProfile } from "@/lib/vater/listing/agent-profile";
import { mlsSafePlan, type ComplianceSku } from "@/lib/vater/listing/compliance";
import { listingError, loadOwnedJob, loginRequired, NO_STORE } from "@/lib/vater/listing/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function slug(s: string | null | undefined): string {
  return (s ?? "listing").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "listing";
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  const { id } = await ctx.params;
  const owned = await loadOwnedJob(session.user.id, id);
  if (!owned.ok) return owned.res;
  const { job, rootUserId } = owned;

  const profile = await readAgentProfile(rootUserId);
  if (profile.licenseStatus !== "verified") {
    return listingError(403, {
      error: "MLS-safe export needs a verified real-estate license.",
      code: "no_license",
      blockers: [{ code: "no_license", message: "Verify your license in your profile to unlock MLS export.", step: 3 }],
    });
  }
  if (job.status !== "ready") return listingError(409, { error: `Listing is ${job.status} — export is available once it is ready.`, code: "bad_state" });
  const plan = mlsSafePlan({ sku: job.sku as ComplianceSku, lane: "mls", sourceKind: job.sourceKind, licenseStatus: profile.licenseStatus });
  if (!plan.allowed) return listingError(422, { error: plan.reason ?? "Not eligible for MLS photo slots.", code: "prompt_blocked" });
  const stillUrl = job.mlsSafeStillUrl ?? job.stagedStillUrl;
  if (!stillUrl) return listingError(409, { error: "No MLS-safe still on this listing.", code: "bad_state" });

  const description = plan.photoDescription;
  const url = new URL(request.url);
  if (url.searchParams.get("format") === "json") {
    return NextResponse.json({ stillUrl, description }, { headers: NO_STORE });
  }

  let bytes: ArrayBuffer;
  let contentType = "image/png";
  try {
    const r = await fetch(stillUrl, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`still ${r.status}`);
    contentType = r.headers.get("content-type") ?? contentType;
    bytes = await r.arrayBuffer();
  } catch (err) {
    console.error(`[listing/mls-export] still fetch failed listing=${id}`, err);
    return NextResponse.json({ error: "Could not fetch the still. Try again." }, { status: 502, headers: NO_STORE });
  }

  const base = slug(job.address);
  const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const zip = new JSZip();
  zip.file(`${base}-virtually-staged.${ext}`, Buffer.from(bytes));
  zip.file("photo-description.txt", `${description}\n`);
  zip.file(
    "README.txt",
    [
      "Listing Studio by Jelly! — MLS-safe export",
      "",
      `Photo: ${base}-virtually-staged.${ext} (no label, no end card, no branding)`,
      `Photo-description field: ${description}`,
      "",
      "Heartland MLS §11.2.2: virtual staging of personal property is permitted when the photo is described as virtually staged.",
      "Keep the as-listed photo in the listing too.",
    ].join("\n"),
  );
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${base}-mls-safe.zip"`,
      "Content-Length": String(out.byteLength),
    },
  });
}
