/**
 * OpenManus client for Deep Research jobs.
 *
 * Same submit-persist-poll shape as lib/dossier/synthesis.ts: submit to the
 * generic /api/task endpoint, persist the taskId BEFORE any polling (so the
 * research-poll cron can reconcile if this function dies), and let the
 * /api/research/[id] poll route + cron drive the task to completion.
 *
 * Manus exposes task state as { status, result, error, steps: string[] } —
 * steps are raw agent-step summaries. parseSteps() maps them onto the
 * user-facing phases the progress UI shows.
 */

import type { ResearchAnswer, ResearchClaim } from "./prompt";

const OPENMANUS_URL = process.env.OPENMANUS_URL || "";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

/** Max agent steps for a research task. Research needs room to search +
 *  read several pages + emit JSON; 25 matches the plan's budget. */
export const RESEARCH_MAX_STEPS = 25;
/** Verification is bounded: fetch cited URLs and compare. */
export const VERIFY_MAX_STEPS = 12;
/** Fallback ETA when we have no completed-job history yet. */
export const DEFAULT_ETA_SECONDS = 240;

export interface ManusTask {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  result: string | null;
  error: string | null;
  steps: string[];
}

export async function isManusReachable(): Promise<boolean> {
  if (!OPENMANUS_URL) return false;
  try {
    const res = await fetch(`${OPENMANUS_URL}/api/task`, {
      method: "GET",
      headers: { "x-auth-token": SYNC_SECRET },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok || res.status === 405;
  } catch {
    return false;
  }
}

/** Submit a task to OpenManus. Returns the Manus taskId. Throws on failure —
 *  callers translate into a failed ResearchJob with a readable error. */
export async function submitManusTask(
  prompt: string,
  opts: { maxSteps: number; tags: string[] }
): Promise<string> {
  if (!OPENMANUS_URL) throw new Error("OPENMANUS_URL not configured");
  const res = await fetch(`${OPENMANUS_URL}/api/task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": SYNC_SECRET,
    },
    body: JSON.stringify({
      prompt,
      max_steps: opts.maxSteps,
      tags: ["deep-research", ...opts.tags],
      source_agent: "tolley-site-research",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Manus submit failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const submitted = (await res.json()) as { id: string };
  return submitted.id;
}

export async function fetchManusTask(taskId: string): Promise<ManusTask | null> {
  if (!OPENMANUS_URL) return null;
  try {
    const res = await fetch(`${OPENMANUS_URL}/api/task/${taskId}`, {
      headers: { "x-auth-token": SYNC_SECRET },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ManusTask;
  } catch {
    return null;
  }
}

// ── Step parsing → progress/phase ─────────────────────────────

export interface ParsedProgress {
  phase: "searching" | "reading" | "synthesizing" | "verifying" | "scoring";
  currentStep: string;
  progress: number; // 0-90 while running (100 is set on completion)
  stepDetails: Array<{ i: number; tool: string; label: string }>;
}

function classifyStep(step: string): { tool: string; label: string } {
  const s = step.toLowerCase();
  if (s.includes("web_search")) return { tool: "web_search", label: "Searching the web" };
  if (s.includes("crawl4ai") || s.includes("crawl")) return { tool: "crawl4ai", label: "Reading a source page" };
  if (s.includes("browser_use") || s.includes("browser")) return { tool: "browser_use", label: "Browsing a source page" };
  if (s.includes("python_execute") || s.includes("python")) return { tool: "python_execute", label: "Compiling the answer" };
  if (s.includes("terminate")) return { tool: "terminate", label: "Finishing up" };
  return { tool: "agent", label: "Thinking" };
}

/**
 * Map raw Manus steps onto the user-facing phase machine. The heuristic:
 * the latest step's tool decides the phase; read-type steps are counted so
 * the label can say "Reading sources (3)".
 */
export function parseSteps(steps: string[], opts?: { verifying?: boolean }): ParsedProgress {
  const details = steps.map((s, i) => ({ i, ...classifyStep(s) }));
  const reads = details.filter((d) => d.tool === "crawl4ai" || d.tool === "browser_use").length;
  const last = details[details.length - 1];

  let phase: ParsedProgress["phase"] = "searching";
  let currentStep = "Searching the web";
  if (opts?.verifying) {
    phase = "verifying";
    currentStep = reads > 0 ? `Cross-verifying claims (${reads} pages checked)` : "Cross-verifying claims";
  } else if (last) {
    switch (last.tool) {
      case "web_search":
        phase = "searching";
        currentStep = "Searching the web";
        break;
      case "crawl4ai":
      case "browser_use":
        phase = "reading";
        currentStep = `Reading sources (${reads})`;
        break;
      case "python_execute":
      case "terminate":
        phase = "synthesizing";
        currentStep = "Compiling the cited answer";
        break;
      default:
        phase = reads > 0 ? "reading" : "searching";
        currentStep = reads > 0 ? `Reading sources (${reads})` : "Analyzing the question";
    }
  }

  const budget = opts?.verifying ? VERIFY_MAX_STEPS : RESEARCH_MAX_STEPS;
  const progress = Math.min(90, Math.round((steps.length / budget) * 100));
  return { phase, currentStep, progress, stepDetails: details };
}

// ── Result extraction ─────────────────────────────────────────

/** Unescape python-repr artifacts in Manus observation strings. */
function unescapeReprText(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
}

/**
 * Pull the fenced JSON block that follows `marker` out of Manus's
 * concatenated task.result. Defensive on purpose — Manus output is messy
 * (python repr escapes, trailing tool-result dict fragments, "Step N:"
 * prefixes). Returns null when the marker or valid JSON can't be found.
 */
export function extractMarkedJson<T>(result: string | null | undefined, marker: string): T | null {
  if (!result) return null;

  for (const text of [result, unescapeReprText(result)]) {
    const markerIdx = text.lastIndexOf(marker);
    if (markerIdx < 0) continue;
    const tail = text.slice(markerIdx + marker.length);
    const fenceStart = tail.indexOf("```");
    if (fenceStart < 0) continue;
    // Skip the opening fence line (``` or ```json)
    const afterFence = tail.slice(fenceStart + 3);
    const firstNewline = afterFence.indexOf("\n");
    if (firstNewline < 0) continue;
    const body = afterFence.slice(firstNewline + 1);
    const fenceEnd = body.indexOf("```");
    const jsonText = (fenceEnd >= 0 ? body.slice(0, fenceEnd) : body).trim();
    // Try as-is first, then brace-bounded (repr junk can trail the block).
    for (const candidate of [jsonText, braceBounded(jsonText)]) {
      if (!candidate) continue;
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // keep trying
      }
    }
  }
  return null;
}

function braceBounded(s: string): string | null {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return s.slice(start, end + 1);
}

interface RawResearchJson {
  answer_markdown?: string;
  claims?: Array<{
    text?: string;
    sources?: Array<{ url?: string; title?: string; quote?: string }>;
    verified?: boolean;
    confidence?: number;
  }>;
  overall_confidence?: number;
  unverified_notes?: string;
}

/**
 * Extract + normalize the research answer JSON from a completed task.
 * Returns null if the output contract wasn't honored — callers fail the
 * job with a readable error rather than showing a half-answer.
 */
export function extractResearchJson(result: string | null | undefined): ResearchAnswer | null {
  const raw = extractMarkedJson<RawResearchJson>(result, "RESEARCH_ANSWER_JSON");
  if (!raw || typeof raw.answer_markdown !== "string" || raw.answer_markdown.length < 50) {
    return null;
  }
  const claims: ResearchClaim[] = (raw.claims ?? [])
    .filter((c) => typeof c.text === "string" && c.text.length > 0)
    .map((c) => ({
      text: c.text as string,
      sources: (c.sources ?? [])
        .filter((s) => typeof s.url === "string" && /^https?:\/\//.test(s.url))
        .map((s) => ({ url: s.url as string, title: s.title ?? s.url ?? "", quote: s.quote })),
      // Contract rule 2: single-source claims can't be "verified".
      verified: Boolean(c.verified) && (c.sources?.length ?? 0) >= 2,
      confidence: clamp(c.confidence ?? 50),
    }));
  return {
    answerMarkdown: raw.answer_markdown,
    claims,
    overallConfidence: clamp(raw.overall_confidence ?? 50),
    unverifiedNotes: raw.unverified_notes,
  };
}

export interface VerifyVerdict {
  claim_index: number;
  url: string;
  supported: boolean | "unreachable";
  evidence_quote?: string;
}

export function extractVerifyJson(result: string | null | undefined): VerifyVerdict[] | null {
  const raw = extractMarkedJson<{ verdicts?: VerifyVerdict[] }>(result, "VERIFY_VERDICTS_JSON");
  if (!raw || !Array.isArray(raw.verdicts)) return null;
  return raw.verdicts.filter((v) => typeof v.claim_index === "number");
}

/**
 * Fold verification verdicts back into the answer: a claim with any
 * explicit `supported: false` verdict loses its verified flag, and if any
 * key claim was contradicted the overall confidence is capped at 40.
 */
export function applyVerdicts(answer: ResearchAnswer, verdicts: VerifyVerdict[]): ResearchAnswer {
  let contradicted = false;
  const claims = answer.claims.map((claim, i) => {
    const mine = verdicts.filter((v) => v.claim_index === i);
    if (mine.length === 0) return claim;
    const anyFalse = mine.some((v) => v.supported === false);
    const allUnreachable = mine.every((v) => v.supported === "unreachable");
    if (anyFalse) {
      contradicted = true;
      return { ...claim, verified: false, confidence: Math.min(claim.confidence, 25) };
    }
    if (allUnreachable) {
      return { ...claim, verified: false };
    }
    return { ...claim, verified: true };
  });
  return {
    ...answer,
    claims,
    overallConfidence: contradicted ? Math.min(answer.overallConfidence, 40) : answer.overallConfidence,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}
