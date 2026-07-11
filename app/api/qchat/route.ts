import { NextRequest } from "next/server";
import { rateLimitByIp } from "@/lib/rate-limit";

// Ungated, general-purpose chat straight to local Qwen3.6-27B on the DGX.
// Backed by the same env we wired for the public chat layer:
//   LLM_PUBLIC_CHAT_URL  (default: https://vllm.tolley.io/v1/chat/completions)
//   LLM_PUBLIC_CHAT_MODEL (default: Qwen/Qwen3.6-27B-FP8)
const LLM_URL =
  process.env.LLM_PUBLIC_CHAT_URL ||
  "https://vllm.tolley.io/v1/chat/completions";
const LLM_MODEL = process.env.LLM_PUBLIC_CHAT_MODEL || "Qwen/Qwen3.6-27B-FP8";

const SYSTEM =
  "You are Qwen3.6, a helpful, direct AI assistant running locally on Tolley's DGX Spark. " +
  "Answer clearly and concisely. Use markdown when it helps. You have no access to external systems.";

const MAX_USER_CHARS = 4000;
const MAX_HISTORY = 12;

// Light in-memory rate limit (per warm instance).
const RATE = new Map<string, { count: number; reset: number }>();
const MAX_PER_MIN = 20;
function allow(ip: string): boolean {
  const now = Date.now();
  const e = RATE.get(ip);
  if (!e || now > e.reset) { RATE.set(ip, { count: 1, reset: now + 60_000 }); return true; }
  if (e.count >= MAX_PER_MIN) return false;
  e.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitByIp(req, "qchat", 30, 60);
  if (limited) return limited;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!allow(ip)) {
    return Response.json({ error: "Too many messages. Please wait a moment." }, { status: 429 });
  }

  let body: { message: string; history?: { role: string; content: string }[] };
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message || typeof message !== "string" || message.length > MAX_USER_CHARS) {
    return Response.json({ error: `Message required, max ${MAX_USER_CHARS} chars.` }, { status: 400 });
  }

  const messages = [
    { role: "system" as const, content: SYSTEM },
    ...history
      .slice(-MAX_HISTORY)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  try {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });

    if (!res.ok) {
      console.error("qchat LLM error:", res.status, await res.text());
      return Response.json({ error: "Qwen is temporarily unavailable." }, { status: 502 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const reply = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim()
      || "I'm not sure how to answer that.";

    return Response.json({ reply });
  } catch (err) {
    console.error("qchat error:", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
