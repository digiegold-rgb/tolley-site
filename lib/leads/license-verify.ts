/**
 * lib/leads/license-verify.ts
 *
 * Real-estate license verification for digest signups.
 *
 * MO — live Primary Source Verification against the Division of Professional
 * Registration's public licensee search (mopro.mo.gov, Salesforce Experience
 * Cloud). The search is guest-accessible: POST to the site's Aura endpoint
 * calling MODPR_LicenseSearchController.fetchBLWithoutCounty with an exact
 * license number, then getApplicationData for expiration/discipline. The Aura
 * context needs the deployment's fwuid + app marker, which rotate on Salesforce
 * releases — we cache them in-module and re-scrape the search page HTML when a
 * call comes back invalid.
 *
 * KS — KREC's search lives behind Akamai (krec.ks.gov 403s non-browser
 * traffic) and an Accela portal, so no live check yet: format-validate and
 * return "manual_review"; the subscribe route Telegram-pings Cordless to
 * verify by hand.
 */

const MO_SEARCH_PAGE = "https://mopro.mo.gov/license/s/license-search";
const MO_AURA_URL =
  "https://mopro.mo.gov/license/s/sfsites/aura?r=1&aura.ApexAction.execute=1";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

export type LicenseState = "MO" | "KS";

export interface LicenseVerifyResult {
  /** verified = confirmed active with the state; manual_review = we accept the
   *  signup and Cordless verifies by hand; invalid = no active license found. */
  status: "verified" | "manual_review" | "invalid";
  /** Licensee name as the state registry has it (verified only). */
  licenseeName?: string;
  /** e.g. "Salesperson", "Broker Associate" (verified only). */
  profession?: string;
  expirationDate?: string;
  /** Human-readable reason for invalid / manual_review. */
  reason?: string;
}

// Aura deployment tokens — seeded with current values, refreshed on failure.
let auraTokens = {
  fwuid:
    "ZkJhOVpLN2NZQkJrd2NWd3pMcnFOdzJEa1N5enhOU3R5QWl2VzNveFZTbGcxMy4tMjE0NzQ4MzY0OC4xMzEwNzIwMA",
  loaded: "1547_6p-2GBd9IQWZ4UXs1Im3BQ",
};

async function refreshAuraTokens(): Promise<boolean> {
  const res = await fetch(MO_SEARCH_PAGE, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) return false;
  const html = await res.text();
  const fwuid = html.match(/%22fwuid%22%3A%22([^%]+)%22/)?.[1];
  const loaded = html.match(/siteforce%3AcommunityApp%22%3A%22([^%]+)%22/)?.[1];
  if (!fwuid || !loaded) return false;
  auraTokens = { fwuid, loaded };
  return true;
}

interface AuraAction {
  state: string;
  returnValue?: { returnValue: unknown };
  error?: unknown[];
}

async function moApexCall(
  method: string,
  params: Record<string, unknown>
): Promise<AuraAction | null> {
  const message = JSON.stringify({
    actions: [
      {
        id: "101;a",
        descriptor: "aura://ApexActionController/ACTION$execute",
        callingDescriptor: "UNKNOWN",
        params: {
          namespace: "",
          classname: "MODPR_LicenseSearchController",
          method,
          params,
          cacheable: false,
          isContinuation: false,
        },
      },
    ],
  });
  const context = JSON.stringify({
    mode: "PROD",
    fwuid: auraTokens.fwuid,
    app: "siteforce:communityApp",
    loaded: { "APPLICATION@markup://siteforce:communityApp": auraTokens.loaded },
    dn: [],
    globals: {},
    uad: true,
  });
  const body =
    `message=${encodeURIComponent(message)}` +
    `&aura.context=${encodeURIComponent(context)}` +
    `&aura.pageURI=${encodeURIComponent("/license/s/license-search")}` +
    `&aura.token=null`;

  const res = await fetch(MO_AURA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: MO_SEARCH_PAGE,
      Origin: "https://mopro.mo.gov",
      "User-Agent": UA,
    },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    return (parsed.actions?.[0] as AuraAction) ?? null;
  } catch {
    // Aura answers non-JSON (e.g. */{"event":...} COOS markers) when the
    // context is stale — caller treats null as "retry after token refresh".
    return null;
  }
}

interface MoSearchRow {
  boardName?: string;
  businessLicenseId?: string;
  licenseeName?: string;
  rat?: string;
}

async function moNumberSearch(licenseNumber: string): Promise<MoSearchRow[] | null> {
  const action = await moApexCall("fetchBLWithoutCounty", {
    status: "Active",
    countyName: [],
    professionName: [],
    searchCriteria: "License Number (Exact - enter in the textbox below)",
    partialRequires: licenseNumber,
  });
  if (!action || action.state !== "SUCCESS") return null;
  const rows = action.returnValue?.returnValue;
  return Array.isArray(rows) ? (rows as MoSearchRow[]) : [];
}

async function moLicenseDetail(
  businessLicenseId: string
): Promise<Record<string, string> | null> {
  const action = await moApexCall("getApplicationData", {
    blId: businessLicenseId,
    status: "Active",
    directApplication: false,
  });
  if (!action || action.state !== "SUCCESS") return null;
  const sections = action.returnValue?.returnValue;
  if (!Array.isArray(sections)) return null;
  const fields: Record<string, string> = {};
  for (const sec of sections as Array<{
    headingName?: string;
    records?: Array<{ headingFieldValue?: Array<{ label?: string; value?: string }> }>;
  }>) {
    if (sec.headingName !== "License") continue;
    for (const rec of sec.records ?? []) {
      for (const f of rec.headingFieldValue ?? []) {
        if (f.label) fields[f.label] = f.value ?? "";
      }
    }
  }
  return fields;
}

async function verifyMissouri(licenseNumber: string): Promise<LicenseVerifyResult> {
  let rows = await moNumberSearch(licenseNumber);
  if (rows === null) {
    // Stale Aura tokens (Salesforce release) — refresh once and retry.
    const refreshed = await refreshAuraTokens();
    if (refreshed) rows = await moNumberSearch(licenseNumber);
  }
  if (rows === null) {
    // Registry unreachable — don't block the signup, flag for manual review.
    return {
      status: "manual_review",
      reason: "Missouri registry did not respond — we'll verify manually",
    };
  }
  const reRow = rows.find((r) => r.boardName === "Real Estate");
  if (!reRow) {
    return {
      status: "invalid",
      reason:
        rows.length > 0
          ? "That license number is not a Missouri real estate license"
          : "No active Missouri license found for that number",
    };
  }

  const result: LicenseVerifyResult = {
    status: "verified",
    licenseeName: reRow.licenseeName,
    profession: reRow.rat,
  };
  // Detail fetch is best-effort enrichment (expiration date); the search row
  // alone already proves an active Real Estate license.
  if (reRow.businessLicenseId) {
    try {
      const detail = await moLicenseDetail(reRow.businessLicenseId);
      if (detail?.["Expiration Date"]) result.expirationDate = detail["Expiration Date"];
      if (detail?.["Profession Name"]) result.profession = detail["Profession Name"];
    } catch {
      // ignore — verification already succeeded
    }
  }
  return result;
}

const LICENSE_FORMAT_RE = /^[A-Za-z0-9.-]{4,15}$/;

/**
 * Verify a license number with the state. MO is live Primary Source
 * Verification; KS is format-check + manual review (KREC blocks bots).
 * Never throws — registry failures degrade to manual_review.
 */
export async function verifyLicense(
  state: LicenseState,
  licenseNumber: string
): Promise<LicenseVerifyResult> {
  const num = licenseNumber.trim();
  if (!LICENSE_FORMAT_RE.test(num)) {
    return {
      status: "invalid",
      reason: "That doesn't look like a license number (4–15 letters/digits)",
    };
  }
  if (state === "MO") {
    try {
      return await verifyMissouri(num);
    } catch (err) {
      console.error("[license-verify] MO lookup failed", err);
      return {
        status: "manual_review",
        reason: "Missouri registry lookup failed — we'll verify manually",
      };
    }
  }
  return {
    status: "manual_review",
    reason: "Kansas licenses are verified by a human within a few hours",
  };
}
