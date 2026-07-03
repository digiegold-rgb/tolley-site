import { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const MIROFISH_URL = process.env.MIROFISH_ENGINE_URL || "http://localhost:8954";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ simId: string }> }
) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { simId } = await params;
  const lastEventId = request.headers.get("Last-Event-ID") || "";

  const headers: Record<string, string> = {
    "x-sync-secret": SYNC_SECRET,
  };
  if (lastEventId) {
    headers["Last-Event-ID"] = lastEventId;
  }

  try {
    const upstream = await fetch(`${MIROFISH_URL}/simulations/${simId}/stream`, {
      headers,
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: "Stream unavailable" }), {
        status: upstream.status || 502,
      });
    }

    // Proxy the SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const encoder = new TextEncoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch {
          // Connection closed
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "MiroFish SSE unavailable" }),
      { status: 503 }
    );
  }
}
