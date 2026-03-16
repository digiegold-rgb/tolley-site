import { NextRequest, NextResponse } from "next/server";

const MANUS_URL = process.env.OPENMANUS_URL || "http://localhost:8010";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, max_steps } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const res = await fetch(`${MANUS_URL}/api/task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": SYNC_SECRET,
      },
      body: JSON.stringify({ prompt, max_steps: max_steps || 20 }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `OpenManus error: ${res.status} ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[manus] API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to reach OpenManus" },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("id");

  try {
    if (taskId) {
      const res = await fetch(`${MANUS_URL}/api/task/${taskId}`, {
        headers: { "x-auth-token": SYNC_SECRET },
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Task not found: ${res.status}` },
          { status: res.status }
        );
      }
      return NextResponse.json(await res.json());
    }

    // List recent tasks
    const res = await fetch(`${MANUS_URL}/api/tasks?limit=20`, {
      headers: { "x-auth-token": SYNC_SECRET },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to list tasks` },
        { status: res.status }
      );
    }
    return NextResponse.json(await res.json());
  } catch (err: any) {
    console.error("[manus] API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to reach OpenManus" },
      { status: 502 }
    );
  }
}
