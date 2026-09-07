/**
 * Second gate for the /generate NSFW library (job list + still/media bytes).
 *
 * Layer 1: requireGenerateAdmin (HQ PIN / shop admin / ADMIN_ALLOWLIST_EMAILS).
 * Layer 2: short-lived httpOnly cookie after a server-checked library PIN.
 *
 * Expected PIN lives in GENERATE_LIBRARY_PIN. Unset is a local-test fallback
 * only — production must set the env (empty expected PIN refuses unlock).
 * Never import this PIN into a client component.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import {
  GENERATE_LIBRARY_COOKIE,
  verifyGenerateLibraryCookie,
} from "@/lib/generate-library-auth-core";

export {
  GENERATE_LIBRARY_COOKIE,
  GENERATE_LIBRARY_MAX_AGE_SEC,
  GENERATE_LIBRARY_PIN_LOCAL_FALLBACK,
  buildGenerateLibraryCookie,
  buildGenerateLibraryToken,
  clearGenerateLibraryCookie,
  expectedGenerateLibraryPin,
  generateLibraryCookieOptions,
  redactGenerateLibraryJobs,
  verifyGenerateLibraryCookie,
  verifyGenerateLibraryPin,
} from "@/lib/generate-library-auth-core";

export function generateLibraryHiddenResponse(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function isGenerateLibraryUnlocked(actor: string): Promise<boolean> {
  const store = await cookies();
  return verifyGenerateLibraryCookie(store.get(GENERATE_LIBRARY_COOKIE)?.value, actor);
}

export async function requireGenerateLibrary(opts?: { hide?: boolean }): Promise<
  | { ok: true; createdBy: string }
  | { ok: false; response: NextResponse }
> {
  const admin = await requireGenerateAdmin();
  if (!admin.ok) {
    return opts?.hide ? { ok: false, response: generateLibraryHiddenResponse() } : admin;
  }
  if (!(await isGenerateLibraryUnlocked(admin.createdBy))) {
    return {
      ok: false,
      response: opts?.hide
        ? generateLibraryHiddenResponse()
        : NextResponse.json({ error: "LIBRARY_LOCKED" }, { status: 403 }),
    };
  }
  return admin;
}
