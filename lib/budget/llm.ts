/**
 * Budget LLM helpers — wrap LiteLLM/Kimi for natural-language parsing.
 *
 * - parseExpenseUtterance: spoken expense → structured row.
 * - parseQueryUtterance: spoken question → intent + filter shape.
 * - categorizePlaidBatch: array of Plaid txns → category assignments.
 *
 * All calls disable thinking-mode (Kimi `enable_thinking: false`) and use
 * temperature 0 so structured output stays deterministic.
 */

// Prefer LITELLM_* (Creator Mode permanent — Kimi via LiteLLM on :4000).
// Fall back to LLM_* (legacy vLLM Qwen on :8355) for backwards-compat with
// other routes that haven't migrated yet.
const LLM_BASE = process.env.LITELLM_API_URL || process.env.LLM_API_URL || "";
const LLM_KEY = process.env.LITELLM_API_KEY || process.env.LLM_API_KEY || "";
const LLM_MODEL =
  process.env.LITELLM_MODEL || process.env.LLM_MODEL || "fallback/kimi-k2-turbo";

const FETCH_TIMEOUT_MS = 30_000;

type CategoryHint = { slug: string; name: string };

type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

async function chat(messages: LLMMessage[], maxTokens = 400): Promise<string> {
  if (!LLM_BASE || !LLM_KEY) {
    throw new Error("LLM_API_URL or LLM_API_KEY not configured");
  }

  const res = await fetch(`${LLM_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0,
      extra_body: { chat_template_kwargs: { enable_thinking: false } },
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  return (
    msg?.content?.trim() ||
    msg?.reasoning_content?.trim() ||
    msg?.provider_specific_fields?.reasoning_content?.trim() ||
    ""
  );
}

function extractJson(raw: string): unknown {
  if (!raw) throw new Error("Empty LLM response");
  // Strip markdown fences and find first {…} or […] block.
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  let start = objStart;
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) start = arrStart;
  if (start === -1) throw new Error(`No JSON in LLM response: ${cleaned.slice(0, 200)}`);
  // Find matching close by counting brackets (balanced enough for our use case).
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error(`Unbalanced JSON in LLM response: ${cleaned.slice(0, 200)}`);
  const slice = cleaned.slice(start, end + 1);
  return JSON.parse(slice);
}

export type ParsedExpense = {
  amount: number;
  categorySlug: string | null;
  vendor: string | null;
  tags: string[];
  occurredAt: string | null;
  note: string | null;
};

export async function parseExpenseUtterance(
  text: string,
  categories: CategoryHint[],
): Promise<ParsedExpense> {
  const catList = categories.map((c) => `- ${c.slug} (${c.name})`).join("\n");
  const today = new Date().toISOString();

  const system = `You parse a spending utterance into JSON only.

Available categories (slug — name):
${catList}

Today: ${today}

Output strict JSON with these keys:
- amount: number (positive dollars)
- categorySlug: string from the list above, or null if unclear
- vendor: short merchant name like "UDF", "Walmart", "Sprouts" — null if unclear
- tags: array of lowercase short tokens for vehicle/business/people refs
  Common tags: jeep, honda, ridgeline, kchomes, family, ruthann, jared, personal
  Empty array [] if none apply.
- occurredAt: ISO datetime, default to today's datetime if not stated
- note: free-form note from the utterance, null if none

NO prose. NO explanation. JSON object only.`;

  const raw = await chat([
    { role: "system", content: system },
    { role: "user", content: text },
  ], 300);

  const parsed = extractJson(raw) as ParsedExpense;
  parsed.amount = Number(parsed.amount) || 0;
  parsed.tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
    : [];
  parsed.categorySlug = parsed.categorySlug
    ? String(parsed.categorySlug).toLowerCase()
    : null;
  parsed.vendor = parsed.vendor ? String(parsed.vendor) : null;
  parsed.occurredAt = parsed.occurredAt ? String(parsed.occurredAt) : null;
  parsed.note = parsed.note ? String(parsed.note) : null;
  return parsed;
}

export type ParsedQuery = {
  intent: "remaining" | "spent" | "recent" | "top" | "goal" | "unknown";
  categorySlug: string | null;
  tags: string[];
  period: "today" | "week" | "month" | "year" | "all";
  limit: number | null;
  goalName: string | null;
};

export async function parseQueryUtterance(
  text: string,
  categories: CategoryHint[],
): Promise<ParsedQuery> {
  const catList = categories.map((c) => `- ${c.slug}`).join("\n");

  const system = `Classify a budget question into JSON only.

Available category slugs:
${catList}

Output JSON with keys:
- intent: one of "remaining" | "spent" | "recent" | "top" | "goal" | "unknown"
- categorySlug: matching slug or null
- tags: array of lowercase tokens for filters (e.g. ["jeep"])
- period: "today" | "week" | "month" | "year" | "all" — default "month"
- limit: integer for "recent"/"top" (default 5), else null
- goalName: string for "goal" intent, else null

NO prose. JSON object only.`;

  const raw = await chat([
    { role: "system", content: system },
    { role: "user", content: text },
  ], 200);

  const parsed = extractJson(raw) as ParsedQuery;
  parsed.intent = (["remaining", "spent", "recent", "top", "goal"].includes(String(parsed.intent))
    ? parsed.intent
    : "unknown") as ParsedQuery["intent"];
  parsed.categorySlug = parsed.categorySlug
    ? String(parsed.categorySlug).toLowerCase()
    : null;
  parsed.tags = Array.isArray(parsed.tags)
    ? parsed.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
    : [];
  parsed.period = (["today", "week", "month", "year", "all"].includes(String(parsed.period))
    ? parsed.period
    : "month") as ParsedQuery["period"];
  parsed.limit = parsed.limit ? Number(parsed.limit) : null;
  parsed.goalName = parsed.goalName ? String(parsed.goalName) : null;
  return parsed;
}

export type PlaidTxnInput = {
  id: string;
  vendor: string;
  amount: number;
  plaidCategory?: string | null;
};

export type PlaidCategorization = {
  id: string;
  categorySlug: string | null;
  tags: string[];
  confidence: number;
};

export async function categorizePlaidBatch(
  txns: PlaidTxnInput[],
  categories: CategoryHint[],
): Promise<PlaidCategorization[]> {
  if (txns.length === 0) return [];
  const catList = categories.map((c) => `- ${c.slug} (${c.name})`).join("\n");

  const system = `Assign each transaction to a categorySlug. Output a JSON array only.

Available categories:
${catList}

For each input transaction, output:
- id: string (echo input id)
- categorySlug: best match slug, or null if uncertain
- tags: lowercase tokens (jeep, honda, kchomes, family, etc.) — [] if none
- confidence: 0.0–1.0

NO prose. JSON array only.`;

  const userMsg = JSON.stringify({ transactions: txns }, null, 2);
  const raw = await chat([
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ], 1500);

  const parsed = extractJson(raw);
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>)?.results)
      ? ((parsed as Record<string, unknown>).results as unknown[])
      : [];

  return arr.map((row) => {
    const r = row as PlaidCategorization;
    return {
      id: String(r.id),
      categorySlug: r.categorySlug ? String(r.categorySlug).toLowerCase() : null,
      tags: Array.isArray(r.tags)
        ? r.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
        : [],
      confidence: Number(r.confidence) || 0,
    };
  });
}
