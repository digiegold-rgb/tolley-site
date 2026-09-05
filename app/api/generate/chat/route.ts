import { NextRequest } from "next/server";
import {
  DIRECTOR_SYSTEM_PROMPT,
  directorUserPayload,
  isBlockedStudioRequest,
  parseDirectorResponse,
  type GenerateMode,
} from "@/lib/generate-director";
import {
  QwenVllmConfigError,
  isQwenConfigured,
  qwenChatCompletion,
  qwenPublicStatus,
} from "@/lib/qwen-vllm";

const MAX_USER_CHARS = 4000;
const MAX_BOX_CHARS = 8000;
const MAX_HISTORY = 16;
const MODES = new Set<GenerateMode>(["t2i", "t2v", "i2v", "v2v", "motion"]);

const RATE = new Map<string, { count: number; reset: number }>();
const MAX_PER_MIN = 20;

function allow(ip: string): boolean {
  const now = Date.now();
  const e = RATE.get(ip);
  if (!e || now > e.reset) {
    RATE.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (e.count >= MAX_PER_MIN) return false;
  e.count++;
  return true;
}

/** GET /api/generate/chat — public status (no URL, no keys). */
export async function GET() {
  return Response.json(qwenPublicStatus());
}

/**
 * POST /api/generate/chat — director turn against Qwen 3.8 on Spark vLLM.
 *
 * Body: { message, history?, inference?, description?, mode? }
 * Returns: { reply, inference, description, refused, model }
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!allow(ip)) {
    return Response.json({ error: "Too many messages. Please wait a moment." }, { status: 429 });
  }

  let body: {
    message?: unknown;
    history?: unknown;
    inference?: unknown;
    description?: unknown;
    mode?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message : "";
  if (!message.trim() || message.length > MAX_USER_CHARS) {
    return Response.json({ error: `Message required, max ${MAX_USER_CHARS} chars.` }, { status: 400 });
  }

  const inference = typeof body.inference === "string" ? body.inference.slice(0, MAX_BOX_CHARS) : "";
  const description = typeof body.description === "string" ? body.description.slice(0, MAX_BOX_CHARS) : "";
  const mode = MODES.has(body.mode as GenerateMode) ? (body.mode as GenerateMode) : "t2i";

  const safety = isBlockedStudioRequest(`${message}\n${inference}\n${description}`);
  if (safety.blocked) {
    return Response.json({
      reply: safety.reason,
      inference: "",
      description: "",
      refused: true,
    });
  }

  if (!isQwenConfigured()) {
    return Response.json(
      {
        error:
          "Qwen 3.8 is not pointed at Spark. Set QWEN_VLLM_BASE_URL (and QWEN_VLLM_MODEL) — see docs/generate-qwen-vllm.md",
        configured: false,
      },
      { status: 503 },
    );
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const prior = history
    .slice(-MAX_HISTORY)
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_USER_CHARS) }));

  try {
    const result = await qwenChatCompletion([
      { role: "system", content: DIRECTOR_SYSTEM_PROMPT },
      ...prior,
      {
        role: "user",
        content: directorUserPayload({ message, inference, description, mode }),
      },
    ]);
    const patch = parseDirectorResponse(result.text);
    const nextSafety = isBlockedStudioRequest(`${patch.inference}\n${patch.description}`);
    if (nextSafety.blocked) {
      return Response.json({
        reply: nextSafety.reason,
        inference: "",
        description: "",
        refused: true,
        model: result.model,
      });
    }
    return Response.json({
      reply: patch.reply,
      inference: patch.inference,
      description: patch.description,
      refused: patch.refused,
      model: result.model,
    });
  } catch (err) {
    if (err instanceof QwenVllmConfigError) {
      return Response.json({ error: err.message, configured: false }, { status: 503 });
    }
    console.error("[generate-chat]", err);
    return Response.json({ error: "Qwen 3.8 on Spark is temporarily unavailable." }, { status: 502 });
  }
}
