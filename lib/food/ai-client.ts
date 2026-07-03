/**
 * lib/food/ai-client.ts
 *
 * Unified AI client for Ruthann's Kitchen. Two functions:
 *
 *   - chatJSON<T>({ system, user, … })     → text-only, Qwen primary + Gemini fallback
 *   - visionJSON<T>({ prompt, images, … }) → multimodal, Gemini only (Qwen is text-only)
 *
 * Why:
 *   - Memory `feedback_vllm_qwen_text_only.md` — Qwen3.5-35B-A3B-FP8 hangs on
 *     image_url requests. Vision must go directly to Gemini.
 *   - Memory `feedback_gemini_thinking_budget.md` — Gemini 2.5 needs
 *     `thinkingBudget: 0` or JSON output gets truncated.
 *   - Memory `feedback_vllm_model_name.md` — exact case `Qwen/Qwen3.5-35B-A3B-FP8`,
 *     responses may contain a `reasoning` field that should be stripped.
 *   - For a paid SaaS product we cannot afford a DGX reboot to crash the site,
 *     so chat falls back to Gemini 2.5 Flash on any vLLM failure.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

// Ruthann's Kitchen text-chat backend. Env-driven so we can flip to
// Qwen3.6 (port 8356) without code edits. FOOD_VLLM_* takes precedence,
// then legacy VLLM_URL, then Qwen3.5 defaults.
const VLLM_URL =
  process.env.FOOD_VLLM_URL || process.env.VLLM_URL || "http://127.0.0.1:8355/v1";
const VLLM_MODEL = process.env.FOOD_VLLM_MODEL || "Qwen/Qwen3.5-35B-A3B-FP8";

const GEMINI_TEXT_MODEL = process.env.GEMINI_FOOD_TEXT_MODEL || "gemini-2.5-flash";
const GEMINI_VISION_MODEL =
  process.env.GEMINI_FOOD_VISION_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// ─────────────────────────────────────────────────────────────────────────────
// Monitoring
// ─────────────────────────────────────────────────────────────────────────────

type AiProvider = "qwen" | "gemini";
type AiKind = "chat" | "vision";

interface AiEvent {
  kind: AiKind;
  provider: AiProvider;
  task: string;
  ms: number;
  ok: boolean;
  fallbackFromError?: string;
  bytes?: number;
}

function logAi(event: AiEvent) {
  console.info("[food-ai]", JSON.stringify(event));
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON extraction helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Strip code fences, reasoning blocks, and extract a JSON object or array. */
function extractJson<T = unknown>(raw: string): T {
  // Qwen sometimes returns a `<think>...</think>` block before the answer
  // (the "reasoning" field behavior documented in memory).
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  cleaned = cleaned.replace(/```json\s*|```/g, "").trim();

  // Try whole string first (works for responseMimeType: application/json)
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through
  }

  // Find the first JSON object or array
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);

  // Prefer whichever starts first
  const pick =
    objectMatch && arrayMatch
      ? cleaned.indexOf(objectMatch[0]) < cleaned.indexOf(arrayMatch[0])
        ? objectMatch[0]
        : arrayMatch[0]
      : (objectMatch?.[0] ?? arrayMatch?.[0]);

  if (!pick) {
    throw new Error(`No JSON found in AI response: ${cleaned.slice(0, 240)}`);
  }
  return JSON.parse(pick) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat (text-only)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatJSONOptions {
  /** Short identifier for monitoring — e.g. "generate-recipe", "suggest-pantry" */
  task: string;
  system: string;
  user: string;
  /** 0.0 — 1.0, default 0.5 */
  temperature?: number;
  /** Default 2000. Gemini max is ~8192 for flash. */
  maxTokens?: number;
  /** Per-request timeout in ms. Default 60000. */
  timeoutMs?: number;
}

export async function chatJSON<T = unknown>(opts: ChatJSONOptions): Promise<T> {
  const {
    task,
    system,
    user,
    temperature = 0.5,
    maxTokens = 2000,
    timeoutMs = 60000,
  } = opts;

  // ── Try Qwen via vLLM first
  try {
    const startedAt = Date.now();
    const res = await fetch(`${VLLM_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`vLLM returned ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content || "";
    if (!content) throw new Error("Empty content from vLLM");

    const parsed = extractJson<T>(content);
    logAi({
      kind: "chat",
      provider: "qwen",
      task,
      ms: Date.now() - startedAt,
      ok: true,
    });
    return parsed;
  } catch (qwenError) {
    const reason = qwenError instanceof Error ? qwenError.message : String(qwenError);
    console.warn(`[food-ai] Qwen failed for ${task}, falling back to Gemini: ${reason}`);

    // ── Fallback to Gemini
    const startedAt = Date.now();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logAi({
        kind: "chat",
        provider: "gemini",
        task,
        ms: 0,
        ok: false,
        fallbackFromError: reason,
      });
      throw new Error(
        `Qwen failed (${reason}) and GEMINI_API_KEY not set — no fallback available`
      );
    }

    const res = await fetch(`${GEMINI_ENDPOINT(GEMINI_TEXT_MODEL)}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${system}\n\n${user}` }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logAi({
        kind: "chat",
        provider: "gemini",
        task,
        ms: Date.now() - startedAt,
        ok: false,
        fallbackFromError: reason,
      });
      throw new Error(`Gemini returned ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      logAi({
        kind: "chat",
        provider: "gemini",
        task,
        ms: Date.now() - startedAt,
        ok: false,
        fallbackFromError: reason,
      });
      throw new Error(
        `Empty response from Gemini: ${JSON.stringify(data).slice(0, 300)}`
      );
    }

    const parsed = extractJson<T>(text);
    logAi({
      kind: "chat",
      provider: "gemini",
      task,
      ms: Date.now() - startedAt,
      ok: true,
      fallbackFromError: reason,
    });
    return parsed;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat text (conversational — no forced JSON)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatTextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatTextOptions {
  /** Short identifier for monitoring */
  task: string;
  messages: ChatTextMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

/** Conversational chat completion (plain text, Qwen primary + Gemini fallback). */
export async function chatText(opts: ChatTextOptions): Promise<string> {
  const {
    task,
    messages,
    temperature = 0.7,
    maxTokens = 1000,
    timeoutMs = 60000,
  } = opts;

  // ── Try Qwen via vLLM first
  try {
    const startedAt = Date.now();
    const res = await fetch(`${VLLM_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`vLLM returned ${res.status}`);
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content || "";
    if (!content) throw new Error("Empty content from vLLM");

    // Strip any <think>...</think> reasoning blocks Qwen sometimes emits.
    const stripped = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    logAi({
      kind: "chat",
      provider: "qwen",
      task,
      ms: Date.now() - startedAt,
      ok: true,
    });
    return stripped;
  } catch (qwenError) {
    const reason = qwenError instanceof Error ? qwenError.message : String(qwenError);
    console.warn(`[food-ai] Qwen chatText failed for ${task}, fallback Gemini: ${reason}`);

    const startedAt = Date.now();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(`Qwen failed (${reason}) and GEMINI_API_KEY not set`);
    }

    // Convert messages to Gemini's format. System messages become a prefix
    // on the first user turn (Gemini lacks a dedicated system role in v1beta).
    const systemParts = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    let isFirstUser = true;
    for (const msg of messages) {
      if (msg.role === "system") continue;
      const role = msg.role === "assistant" ? "model" : "user";
      const text =
        role === "user" && isFirstUser && systemParts
          ? `${systemParts}\n\n${msg.content}`
          : msg.content;
      if (role === "user") isFirstUser = false;
      contents.push({ role, parts: [{ text }] });
    }

    const res = await fetch(`${GEMINI_ENDPOINT(GEMINI_TEXT_MODEL)}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logAi({
        kind: "chat",
        provider: "gemini",
        task,
        ms: Date.now() - startedAt,
        ok: false,
        fallbackFromError: reason,
      });
      throw new Error(`Gemini returned ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text: string =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    logAi({
      kind: "chat",
      provider: "gemini",
      task,
      ms: Date.now() - startedAt,
      ok: text.length > 0,
      fallbackFromError: reason,
    });

    if (!text) {
      throw new Error(`Empty response from Gemini: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return text;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vision (Gemini only — Qwen3.5-35B-A3B-FP8 is text-only)
// ─────────────────────────────────────────────────────────────────────────────

export interface VisionImage {
  base64: string;
  mimeType: string;
}

export interface VisionJSONOptions {
  /** Short identifier for monitoring — e.g. "scan-receipt", "recognize-groceries" */
  task: string;
  prompt: string;
  images: VisionImage[];
  /** 0.0 — 1.0, default 0.25 (low for precise extraction) */
  temperature?: number;
  /** Default 3000 */
  maxTokens?: number;
  /** Per-request timeout in ms. Default 90000. */
  timeoutMs?: number;
}

export async function visionJSON<T = unknown>(
  opts: VisionJSONOptions
): Promise<T> {
  const {
    task,
    prompt,
    images,
    temperature = 0.25,
    maxTokens = 3000,
    timeoutMs = 90000,
  } = opts;

  if (images.length === 0) {
    throw new Error("visionJSON requires at least one image");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set — cannot run vision tasks");
  }

  const startedAt = Date.now();

  const parts: Array<
    | { text: string }
    | { inline_data: { mime_type: string; data: string } }
  > = [{ text: prompt }];
  for (const img of images) {
    parts.push({
      inline_data: { mime_type: img.mimeType, data: img.base64 },
    });
  }

  const res = await fetch(`${GEMINI_ENDPOINT(GEMINI_VISION_MODEL)}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logAi({
      kind: "vision",
      provider: "gemini",
      task,
      ms: Date.now() - startedAt,
      ok: false,
    });
    throw new Error(`Gemini returned ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) {
    logAi({
      kind: "vision",
      provider: "gemini",
      task,
      ms: Date.now() - startedAt,
      ok: false,
    });
    throw new Error(
      `Empty response from Gemini: ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  const parsed = extractJson<T>(text);
  logAi({
    kind: "vision",
    provider: "gemini",
    task,
    ms: Date.now() - startedAt,
    ok: true,
  });
  return parsed;
}
