/**
 * Dossier synthesis — OpenManus-powered narrative report.
 *
 * After the 28 plugins finish gathering structured evidence (court records,
 * liens, deeds, financials, neighborhood data, motivations, etc.), this module
 * hands the complete picture to OpenManus and asks it to write a 500-1000 word
 * investment narrative with a concrete buy/pass/negotiate recommendation.
 *
 * Think of it as: "the plugins gather evidence, Manus writes the closing argument."
 *
 * Design notes:
 * - Uses OpenManus's generic `/api/task` endpoint (NOT `/api/task/research` —
 *   we already have the data, we just need synthesis).
 * - Polls every 5s with a 5-minute hard timeout. If Manus is stuck or down,
 *   we soft-fail and still let the dossier finalize without a narrative.
 * - max_steps=10 (half the default) — synthesis shouldn't need 20 steps, and
 *   a tighter bound prevents the "stuck in a loop" behavior we saw with
 *   open-ended prompts.
 * - The prompt is deliberately structured with explicit evidence blocks and
 *   an output contract. Open-ended prompts loop; structured ones don't.
 * - Manus auto-stores every completed task in Qdrant (`agent_memory`
 *   collection), so OpenClaw agents (T-Agent, Pulse, Grit) can search for
 *   past dossier narratives via the existing rag.py tool — free win, no
 *   extra wiring needed.
 */

import type {
  CourtCase,
  DeedRecord,
  DossierListing,
  DossierPluginResult,
  FinancialData,
  LienRecord,
  BankruptcyRecord,
  MarketData,
  MotivationFlag,
  NeighborhoodData,
  OwnerInfo,
  TaxRecord,
} from "./types";

// ── Config ────────────────────────────────────────────────────

const OPENMANUS_URL = process.env.OPENMANUS_URL || "";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

/** Maximum wall-clock time to wait for Manus to finish (ms).
 *  Previously 10 min — caused the Vercel function to blow past its 300s
 *  max duration. Now capped at 90s so the whole dossier finishes in time.
 *  If Manus needs longer, we'll skip synthesis and let the user trigger a
 *  longer run from the UI. */
const SYNTHESIS_TIMEOUT_MS = 90_000; // 90 seconds
/** How often to poll Manus for task status (ms). */
const POLL_INTERVAL_MS = 3_000;
/** Max agent steps Manus is allowed for synthesis. Lower = tighter bound. */
const MAX_STEPS = 6;
/** Health precheck timeout — fast fail if Manus isn't reachable from here. */
const HEALTH_TIMEOUT_MS = 3_000;

/**
 * Lightweight health check. Manus exposes `/api/task` (list tasks). If it
 * responds within a few seconds we know the service is reachable and we
 * can safely try the synthesis call. If not, skip synthesis entirely.
 */
async function isManusReachable(): Promise<boolean> {
  if (!OPENMANUS_URL) return false;
  try {
    const res = await fetch(`${OPENMANUS_URL}/api/task`, {
      method: "GET",
      headers: { "x-auth-token": SYNC_SECRET },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return res.ok || res.status === 405; // 405 = endpoint exists but wrong method
  } catch {
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────

export interface SynthesisInput {
  jobId: string;
  listing: DossierListing;
  priorResults: Record<string, DossierPluginResult>;
  knownOwners: OwnerInfo[];
  motivationScore: number | null;
  motivationFlags: MotivationFlag[];
  courtCases: CourtCase[];
  liens: LienRecord[];
  bankruptcies: BankruptcyRecord[];
  taxRecords: TaxRecord[];
  deedHistory: DeedRecord[];
  financialData?: FinancialData;
  neighborhoodData?: NeighborhoodData;
  marketData?: MarketData;
  researchSummary?: string;
  entityType: string;
  entityName: string | null;
}

export interface SynthesisResult {
  success: boolean;
  /** The markdown narrative if synthesis succeeded. */
  narrativeReport?: string;
  /** The Manus task id (for RAG lookup / debugging). */
  taskId?: string;
  /** Number of agent steps the task actually used. */
  stepsUsed?: number;
  /** Wall-clock duration from submission to completion (ms). */
  durationMs: number;
  /** Human-readable error if synthesis soft-failed. */
  error?: string;
}

/**
 * Run synthesis. Never throws — always returns a SynthesisResult so callers
 * can soft-fail the step without derailing the dossier pipeline.
 *
 * The optional `onSubmitted` callback fires IMMEDIATELY after we get a
 * taskId back from OpenManus, BEFORE the poll loop starts. Callers should
 * use this to persist `{status: "pending", taskId}` to the database so the
 * async poll cron can reconcile the task even if Vercel kills the
 * function during the poll loop. Without this, a mid-poll function kill
 * orphans the task — Manus completes it successfully but the narrative is
 * never written back to the DossierResult.
 */
export async function runSynthesis(
  input: SynthesisInput,
  onSubmitted?: (taskId: string) => Promise<void>
): Promise<SynthesisResult> {
  const start = Date.now();

  // ── Health precheck ──
  // Skip synthesis entirely if Manus isn't reachable. Previously this would
  // try to hit localhost:8010 from Vercel and burn the whole function
  // timeout. Now we fail fast and let the dossier finalize without a
  // narrative — it's an enhancement, not a required field.
  if (!OPENMANUS_URL) {
    return {
      success: false,
      durationMs: Date.now() - start,
      error: "OPENMANUS_URL not configured — narrative synthesis skipped",
    };
  }
  const reachable = await isManusReachable();
  if (!reachable) {
    return {
      success: false,
      durationMs: Date.now() - start,
      error: `OpenManus unreachable at ${OPENMANUS_URL} — narrative synthesis skipped`,
    };
  }

  try {
    const prompt = buildSynthesisPrompt(input);
    const zip = input.listing.zip ?? "unknown";

    // Submit the task
    const submitRes = await fetch(`${OPENMANUS_URL}/api/task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": SYNC_SECRET,
      },
      body: JSON.stringify({
        prompt,
        max_steps: MAX_STEPS,
        tags: ["dossier", "synthesis", zip, input.jobId],
        source_agent: "tolley-site-dossier",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text().catch(() => "");
      return {
        success: false,
        durationMs: Date.now() - start,
        error: `submit failed: ${submitRes.status} ${text.slice(0, 200)}`,
      };
    }

    const submitted = (await submitRes.json()) as { id: string };
    const taskId = submitted.id;

    // Persist the pending state BEFORE entering the poll loop. This is the
    // critical step that lets the async poll cron reconcile the task when
    // Vercel kills this function at its 300s hard limit during polling.
    // We swallow callback errors — a DB write failure here is bad but not
    // as bad as also losing the poll attempt.
    if (onSubmitted) {
      try {
        await onSubmitted(taskId);
      } catch (cbErr) {
        console.error("[synthesis] onSubmitted callback threw:", cbErr);
      }
    }

    // Poll until completion or timeout
    const deadline = start + SYNTHESIS_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const pollRes = await fetch(`${OPENMANUS_URL}/api/task/${taskId}`, {
        headers: { "x-auth-token": SYNC_SECRET },
        signal: AbortSignal.timeout(10000),
      });

      if (!pollRes.ok) {
        // Transient poll error — keep trying until the deadline
        continue;
      }

      const task = (await pollRes.json()) as {
        id: string;
        status: "pending" | "running" | "completed" | "failed";
        result: string | null;
        error: string | null;
        steps: string[];
      };

      if (task.status === "completed") {
        // task.result is the concatenation of all step outputs with "Step N:"
        // prefixes — not a clean narrative. We ask Manus to emit the full
        // narrative markdown starting with "# Investment Narrative:" in its
        // final python_execute call, so we extract from that marker to the
        // end of any step output.
        const narrative = extractNarrativeMarkdown(task.result);
        if (!narrative) {
          return {
            success: false,
            taskId,
            stepsUsed: task.steps.length,
            durationMs: Date.now() - start,
            error: "synthesis completed but no narrative marker found in task.result",
          };
        }
        return {
          success: true,
          narrativeReport: narrative,
          taskId,
          stepsUsed: task.steps.length,
          durationMs: Date.now() - start,
        };
      }

      if (task.status === "failed") {
        return {
          success: false,
          taskId,
          stepsUsed: task.steps.length,
          durationMs: Date.now() - start,
          error: task.error ?? "Manus reported failure without an error message",
        };
      }
    }

    return {
      success: false,
      taskId,
      durationMs: Date.now() - start,
      error: `synthesis timed out after ${SYNTHESIS_TIMEOUT_MS / 1000}s (task ${taskId} may still be running)`,
    };
  } catch (err) {
    return {
      success: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

// ── Prompt Construction ───────────────────────────────────────

/**
 * Build a structured synthesis prompt. Key principles:
 * - Explicit evidence blocks (not free-form JSON dump) — the model focuses
 *   better on labeled sections than on a blob.
 * - Explicit "do not browse, do not fabricate" to prevent Manus from trying
 *   browser tools that fail on Qwen3.5 (text-only model).
 * - Concrete ROI math requirement with a single python_execute call — we
 *   proved this works reliably on the model.
 * - Output contract: file path + terminate — the reliable shape we verified.
 */
function buildSynthesisPrompt(input: SynthesisInput): string {
  const {
    jobId,
    listing,
    knownOwners,
    motivationScore,
    motivationFlags,
    courtCases,
    liens,
    bankruptcies,
    taxRecords,
    deedHistory,
    financialData,
    neighborhoodData,
    marketData,
    researchSummary,
    entityType,
    entityName,
  } = input;

  // Jackson County (MO) ZIPs get 1.35% property tax, Platte County gets 1.20%.
  // Fallback to 1.30% for unknown counties.
  const zip = listing.zip ?? "";
  const isPlatteCounty = zip === "64151" || zip === "64153" || zip === "64152" || zip === "64150";
  const propertyTaxRate = isPlatteCounty ? 0.012 : 0.0135;
  const countyLabel = isPlatteCounty ? "Platte" : "Jackson";

  const ownerLine = knownOwners.length
    ? knownOwners
        .slice(0, 3)
        .map((o) => `${o.name}${o.role !== "owner" ? ` (${o.role})` : ""}`)
        .join(", ")
    : "unknown";

  return `You are the T-Agent synthesis analyst. Write a 500-1000 word investment narrative for the property below, using ONLY the structured evidence provided. Do NOT browse the web. Do NOT fabricate numbers. If a field is missing, say so explicitly in the narrative.

PROPERTY
  Address: ${listing.address}
  City/State/Zip: ${listing.city ?? "?"} ${listing.state ?? "?"} ${zip || "?"}
  List price: ${fmtMoney(listing.listPrice)}
  Original list: ${fmtMoney(listing.originalListPrice)}
  Beds/Baths/Sqft: ${listing.beds ?? "?"}/${listing.baths ?? "?"}/${listing.sqft ?? "?"}
  Property type: ${listing.propertyType ?? "?"}
  Days on market: ${listing.daysOnMarket ?? "?"}
  Status: ${listing.status}

OWNER
  Entity type: ${entityType}${entityName ? ` (${entityName})` : ""}
  Known owners: ${ownerLine}

MOTIVATION
  Score: ${motivationScore ?? "not computed"} / 100
  Flags: ${motivationFlags.length ? motivationFlags.join(", ") : "none"}

LEGAL / TITLE
  Court cases: ${summarizeCourtCases(courtCases)}
  Liens: ${summarizeLiens(liens)}
  Bankruptcies: ${bankruptcies.length ? `${bankruptcies.length} filings` : "none"}

TAX & DEED HISTORY
  Tax records: ${summarizeTaxRecords(taxRecords)}
  Deed history: ${summarizeDeeds(deedHistory)}

FINANCIAL
${indent(JSON.stringify(financialData ?? {}, null, 2))}

NEIGHBORHOOD
${indent(JSON.stringify(neighborhoodData ?? {}, null, 2))}

MARKET
${indent(JSON.stringify(marketData ?? {}, null, 2))}

${researchSummary ? `PRIOR RESEARCH BRIEF\n${indent(researchSummary)}\n` : ""}
TASK — do exactly these three steps in order. Do not add extra steps.

STEP 1 — ROI math. In ONE python_execute call, compute these four metrics at the list price and print them. Use these exact assumptions:
  * 20% down payment
  * 7.0% interest, 30-year fixed mortgage
  * ${(propertyTaxRate * 100).toFixed(2)}% ${countyLabel} County property tax
  * 0.5% of price insurance per year
  * 8% vacancy reserve
  * 10% maintenance + management reserve
  * Market rent = 0.65% of list price per month (use this if no comp data is provided)

  Metrics to compute:
  * Cap rate = NOI / price * 100
  * Monthly cash flow = (NOI / 12) - monthly_P&I   ← INCLUDE MORTGAGE P&I
  * Cash-on-cash return = (annual cash flow / down payment) * 100   ← this can and often IS negative at 7% rates, do not force it positive
  * GRM = price / (rent * 12)
  * 1% rule: pass/fail (monthly rent >= 1% of price)

  Show your work in comments. The P&I formula: P&I = loan * r * (1+r)^n / ((1+r)^n - 1) where r = rate/12 and n = months.

STEP 2 — In ONE python_execute call, print the COMPLETE markdown narrative (600-1000 words) directly to stdout. No file writing — just print the full markdown. It MUST start with exactly this line on the first line:

# Investment Narrative: ${listing.address}

Then these six sections in order (use ## for section headings):
  * ## Executive Summary — 2-3 sentences with a concrete BUY / NEGOTIATE / PASS verdict
  * ## Owner & Motivation Read — what the evidence says about seller motivation
  * ## Legal & Title Red Flags — court cases, liens, bankruptcies, deed history concerns
  * ## ROI Snapshot — the numbers from STEP 1 verbatim (cap rate, cash-on-cash, GRM, 1% rule) with a plain-English read. If cash flow is negative, SAY SO explicitly — do not sugar-coat.
  * ## Neighborhood & Market Context — what the neighborhood/market data implies
  * ## Recommended Next Action — ONE specific action: contact owner at X, submit offer at $Y, pass for reason Z

STEP 3 — Call the terminate tool.

CONSTRAINTS:
- Do NOT use browser_use. Do NOT use web_search. Do NOT write files.
- Do NOT fabricate prices, rents, cap rates, or owner info. If a field is missing, say "data unavailable".
- Carry the STEP 1 numbers verbatim into STEP 2's ROI Snapshot section. Do not recompute them differently.
- If the listing is missing critical data (no price, no address), write a short report in STEP 2 explaining what's missing and call it a PASS verdict.
- The reader is a working real estate agent who needs "do this next", not academic analysis.`;
}

// ── Prompt helpers ────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "?";
  return `$${n.toLocaleString("en-US")}`;
}

function indent(s: string, spaces = 2): string {
  const pad = " ".repeat(spaces);
  return s
    .split("\n")
    .map((line) => pad + line)
    .join("\n");
}

function summarizeCourtCases(cases: CourtCase[]): string {
  if (!cases.length) return "none";
  const top = cases.slice(0, 5).map((c) => `${c.type} (${c.status}, filed ${c.filedDate})`);
  const more = cases.length > 5 ? ` +${cases.length - 5} more` : "";
  return top.join("; ") + more;
}

function summarizeLiens(liens: LienRecord[]): string {
  if (!liens.length) return "none";
  const top = liens.slice(0, 5).map((l) => {
    const amt = l.amount ? ` $${l.amount.toLocaleString("en-US")}` : "";
    return `${l.type}${amt} (${l.status}, filed ${l.filedDate})`;
  });
  const more = liens.length > 5 ? ` +${liens.length - 5} more` : "";
  return top.join("; ") + more;
}

function summarizeTaxRecords(records: TaxRecord[]): string {
  if (!records.length) return "none";
  const latest = records.slice().sort((a, b) => b.year - a.year)[0];
  const delinquent = records.filter((r) => r.delinquent).length;
  const delinquentNote = delinquent > 0 ? ` — ${delinquent} delinquent year(s)` : "";
  return `latest ${latest.year}: assessed $${latest.assessed.toLocaleString("en-US")}, tax $${latest.taxAmount.toLocaleString("en-US")}${delinquentNote}`;
}

function summarizeDeeds(deeds: DeedRecord[]): string {
  if (!deeds.length) return "none";
  const top = deeds
    .slice(0, 3)
    .map((d) => `${d.date}: ${d.type}${d.price ? ` $${d.price.toLocaleString("en-US")}` : ""} (${d.grantor} → ${d.grantee})`);
  const more = deeds.length > 3 ? ` +${deeds.length - 3} more` : "";
  return top.join("; ") + more;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract the narrative markdown from Manus's task.result.
 *
 * task.result is a concatenation of every tool call output, prefixed with
 * "Step N:". The narrative is embedded inside one of those observation
 * strings (the model calls python_execute to print it). We locate it by
 * searching for the "# Investment Narrative:" heading we instructed Manus
 * to start with, then grab everything from there to the next "Step N:"
 * prefix (or the end of the string).
 *
 * Returns null if the marker isn't found — callers should soft-fail.
 *
 * Exported because the async poll cron reuses this same extraction logic
 * when reconciling orphaned Manus tasks whose inline run timed out.
 */
export function extractNarrativeMarkdown(result: string | null | undefined): string | null {
  if (!result) return null;
  const markerIdx = result.indexOf("# Investment Narrative:");
  if (markerIdx < 0) return null;

  // Find the next "Step N:" prefix after the marker, which signals the start
  // of a subsequent tool output. Use String.prototype.search with a regex
  // instead of RegExp.exec so we search from markerIdx onward.
  const tail = result.slice(markerIdx);
  const nextStepOffset = tail.search(/\nStep \d+:/);
  const rawNarrative = nextStepOffset > 0 ? tail.slice(0, nextStepOffset) : tail;

  // Observations are python repr strings — they often end with \n' (escaped
  // newline + closing quote). Unescape and strip trailing repr artifacts.
  let narrative = rawNarrative
    .replace(/\\n/g, "\n")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/'\s*,\s*'success':\s*True\s*\}\s*$/, "")
    .replace(/\s*\}\s*$/, "")
    .trim();

  // Sanity check — a valid narrative should have the Executive Summary
  // section and be more than 500 chars.
  if (narrative.length < 500 || !narrative.includes("## Executive Summary")) {
    return null;
  }

  return narrative;
}
