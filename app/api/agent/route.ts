import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";

// Admin-only agentic chat. Proxies to the Hermes Agent's OpenAI-compatible
// API server on the DGX (full toolset: terminal, web, file, browser, etc.).
// Hermes runs the tool-calling loop server-side and returns the final answer.
//
// Env (set in Vercel prod once the DGX gateway + tunnel are live):
//   HERMES_AGENT_URL    base, default https://hermes.tolley.io
//   HERMES_AGENT_TOKEN  == API_SERVER_KEY in ~/.hermes/.env (bearer auth)
//   HERMES_AGENT_MODEL  default Qwen/Qwen3.6-27B-FP8
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // agent runs can take minutes

const MAX_USER_CHARS = 8000;
const MAX_HISTORY = 16;

function baseUrl() {
  return (process.env.HERMES_AGENT_URL || "https://hermes.tolley.io").replace(/\/$/, "");
}

const SYSTEM =
  "You are Hermes, Tolley's autonomous operator agent running locally on the DGX Spark. " +
  "You have real tools — terminal/shell on the DGX, web search & browsing, file read/write, " +
  "and messaging. Use them to actually accomplish the task, not just describe it. " +
  "Be decisive and concise. When you run a command or change something, say exactly what you did. " +
  "Never reveal secrets, API keys, or .env contents. Refuse destructive actions " +
  "(dropping databases, rm -rf of data, deleting git history) unless explicitly confirmed in the request.";

export async function POST(request: Request) {
  const sessionResult = await requireAdminApiSession();
  if (!sessionResult.ok) return sessionResult.response;

  const token = process.env.HERMES_AGENT_TOKEN || "";
  if (!token) {
    return NextResponse.json(
      { error: "Agent not configured (HERMES_AGENT_TOKEN missing). The DGX Hermes gateway + tunnel must be live." },
      { status: 503 },
    );
  }

  let body: { message?: unknown; history?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message : "";
  if (!message || message.length > MAX_USER_CHARS) {
    return NextResponse.json({ error: `Message required, max ${MAX_USER_CHARS} chars.` }, { status: 400 });
  }
  const history = Array.isArray(body.history) ? body.history : [];

  const messages = [
    { role: "system" as const, content: SYSTEM },
    ...history
      .slice(-MAX_HISTORY)
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  try {
    const res = await fetch(`${baseUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // Cloudflare Access service-token — edge rejects anything without these
        // before traffic ever reaches the DGX. A leaked bearer alone is useless.
        ...(process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET
          ? {
              "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID,
              "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET,
            }
          : {}),
      },
      body: JSON.stringify({
        model: process.env.HERMES_AGENT_MODEL || "Qwen/Qwen3.6-27B-FP8",
        messages,
        temperature: 0.3,
      }),
      // Vercel function cap governs total; give the agent room.
      signal: AbortSignal.timeout(290_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("hermes agent error:", res.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: res.status === 401 ? "Agent auth rejected (token mismatch)." : "Agent is temporarily unavailable." },
        { status: 502 },
      );
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const reply = String(raw).replace(/<think>[\s\S]*?<\/think>/g, "").trim()
      || "(agent returned no text)";

    return NextResponse.json({
      reply,
      usage: data.usage ?? null,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "TimeoutError";
    console.error("hermes agent exception:", err);
    return NextResponse.json(
      { error: aborted ? "Agent timed out (task ran too long)." : "Something went wrong reaching the agent." },
      { status: aborted ? 504 : 500 },
    );
  }
}
