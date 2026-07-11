/**
 * lib/instantly.ts
 *
 * Thin adapter for the Instantly.ai API v2 (cold-email sending platform) used
 * by the B2B "I made you a video" outreach track. Auth is a Bearer key in
 * INSTANTLY_API_KEY.
 *
 * ⚠️  ALL Instantly endpoint paths + request/response shapes are isolated in
 * THIS file. They were written against the published v2 docs
 * (https://developer.instantly.ai) and may need adjustment once exercised
 * against the live API — if Instantly changes a field name, fix it here and
 * nowhere else. scripts/push-instantly-leads.mjs intentionally mirrors the
 * same request shapes inline (plain-node script, can't import TS).
 *
 * NEVER silently catch here — every non-2xx / malformed response throws a
 * typed InstantlyError so callers surface real failures.
 */

const BASE = "https://api.instantly.ai/api/v2";

export class InstantlyError extends Error {
  status: number;
  endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(`[instantly ${status}] ${endpoint}: ${message}`);
    this.name = "InstantlyError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

function apiKey(): string {
  const key = process.env.INSTANTLY_API_KEY;
  if (!key) {
    throw new InstantlyError("INSTANTLY_API_KEY is not set", 0, "(config)");
  }
  return key;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new InstantlyError(text || res.statusText, res.status, path);
  }

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new InstantlyError(
      `non-JSON response body: ${text.slice(0, 300)}`,
      res.status,
      path
    );
  }
  return parsed as T;
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export type InstantlyCampaign = {
  id: string;
  name: string;
  status?: number | string;
};

/**
 * GET /campaigns — returns the account's campaigns. v2 paginates as
 * `{ items: [...], next_starting_after }`; we return the first page (more
 * than 100 campaigns is not our problem yet).
 */
export async function listCampaigns(): Promise<InstantlyCampaign[]> {
  const data = await call<{ items?: unknown } | unknown[]>(
    "GET",
    "/campaigns?limit=100"
  );
  const items = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown })?.items)
      ? ((data as { items: unknown[] }).items)
      : null;
  if (!items) {
    throw new InstantlyError(
      "unexpected /campaigns response shape (no items array)",
      200,
      "/campaigns"
    );
  }
  return items.map((raw) => {
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== "string") {
      throw new InstantlyError(
        "campaign entry missing string id",
        200,
        "/campaigns"
      );
    }
    return {
      id: c.id,
      name: typeof c.name === "string" ? c.name : "",
      status: c.status as number | string | undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export type InstantlyLeadInput = {
  email: string;
  firstName?: string;
  companyName?: string;
  customVariables?: Record<string, string>;
};

export type InstantlyLead = {
  id: string;
  email: string;
  campaign?: string;
};

/**
 * POST /leads — v2 creates ONE lead per request, so this loops. Body shape:
 *   { campaign, email, first_name, company_name, custom_variables }
 * Throws on the FIRST failure (caller decides whether to resume) — partial
 * progress is reported via the returned array length up to that point being
 * lost, so callers that need per-lead resilience should push one at a time.
 */
export async function addLeadsToCampaign(
  campaignId: string,
  leads: InstantlyLeadInput[]
): Promise<InstantlyLead[]> {
  if (!campaignId) {
    throw new InstantlyError("campaignId is required", 0, "/leads");
  }
  const created: InstantlyLead[] = [];
  for (const lead of leads) {
    if (!lead.email) {
      throw new InstantlyError("lead missing email", 0, "/leads");
    }
    const data = await call<Record<string, unknown>>("POST", "/leads", {
      campaign: campaignId,
      email: lead.email,
      ...(lead.firstName ? { first_name: lead.firstName } : {}),
      ...(lead.companyName ? { company_name: lead.companyName } : {}),
      ...(lead.customVariables ? { custom_variables: lead.customVariables } : {}),
    });
    if (typeof data?.id !== "string" && typeof data?.email !== "string") {
      throw new InstantlyError(
        `unexpected POST /leads response: ${JSON.stringify(data).slice(0, 300)}`,
        200,
        "/leads"
      );
    }
    created.push({
      id: typeof data.id === "string" ? data.id : "",
      email: typeof data.email === "string" ? data.email : lead.email,
      campaign: typeof data.campaign === "string" ? data.campaign : campaignId,
    });
  }
  return created;
}

/**
 * POST /block-lists-entries — workspace-wide block list. A blocked email can
 * never be pushed into any campaign again (Instantly enforces it), making
 * opt-outs stick even if a lead re-enters the pipeline later.
 */
export async function addToBlocklist(email: string): Promise<void> {
  if (!email) {
    throw new InstantlyError("email is required", 0, "/block-lists-entries");
  }
  await call<Record<string, unknown>>("POST", "/block-lists-entries", {
    bl_value: email.toLowerCase(),
  });
}

/**
 * POST /leads/list — v2's lead search. We filter client-side on exact email
 * (case-insensitive) since the `search` param is fuzzy. Returns null when no
 * lead matches.
 */
export async function getLeadByEmail(
  email: string
): Promise<InstantlyLead | null> {
  if (!email) {
    throw new InstantlyError("email is required", 0, "/leads/list");
  }
  const data = await call<{ items?: unknown }>("POST", "/leads/list", {
    search: email,
    limit: 10,
  });
  const items = Array.isArray(data?.items) ? data.items : null;
  if (!items) {
    throw new InstantlyError(
      "unexpected /leads/list response shape (no items array)",
      200,
      "/leads/list"
    );
  }
  for (const raw of items) {
    const l = raw as Record<string, unknown>;
    if (
      typeof l.email === "string" &&
      l.email.toLowerCase() === email.toLowerCase()
    ) {
      return {
        id: typeof l.id === "string" ? l.id : "",
        email: l.email,
        campaign: typeof l.campaign === "string" ? l.campaign : undefined,
      };
    }
  }
  return null;
}
