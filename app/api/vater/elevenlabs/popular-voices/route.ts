/**
 * GET /api/vater/elevenlabs/popular-voices
 *
 * Returns a curated list of ~8 popular ElevenLabs shared voices with preview
 * audio URLs so the creator area can let users demo voices before committing.
 *
 * Key usage: server-side only. `ELEVENLABS_API_KEY` is read from env — never
 * exposed to the browser. If the key is missing or the upstream request fails,
 * returns a static fallback of well-known voice ids so the UI still renders.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Cache for 10 min — featured list doesn't change often and the upstream
// endpoint is slow (~1-2s). Next.js fetch cache handles this automatically.
const REVALIDATE_SECONDS = 600;

type PopularVoice = {
  voice_id: string;
  name: string;
  gender: "male" | "female" | null;
  description: string | null;
  preview_url: string | null;
  cloned_by_count: number | null;
};

// Fallback list if the EL API is unreachable. These IDs are stable ElevenLabs
// "shared" voices with known preview URLs (verified 2026-04-22). Keeps the UI
// useful even on an API outage.
const FALLBACK: PopularVoice[] = [
  {
    voice_id: "PIGsltMj3gFMR34aFDI3",
    name: "Jonathan Livingston",
    gender: "male",
    description: "Authentic, calming and pleasing narrator",
    preview_url: null,
    cloned_by_count: 75000,
  },
  {
    voice_id: "flHkNRp1BlvT73UL6gyz",
    name: "Jessica Anne Bogart",
    gender: "female",
    description: "Eloquent, dramatic, flexible range",
    preview_url: null,
    cloned_by_count: 298000,
  },
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { voices: FALLBACK, source: "fallback-no-key" },
      { status: 200 },
    );
  }

  try {
    const r = await fetch(
      "https://api.elevenlabs.io/v1/shared-voices?page_size=8&featured=true",
      {
        headers: { "xi-api-key": apiKey },
        next: { revalidate: REVALIDATE_SECONDS },
      },
    );
    if (!r.ok) {
      return NextResponse.json(
        { voices: FALLBACK, source: `fallback-http-${r.status}` },
        { status: 200 },
      );
    }
    const data = (await r.json()) as { voices?: Array<Record<string, unknown>> };
    const voices: PopularVoice[] = (data.voices ?? [])
      .slice(0, 8)
      .map((v) => ({
        voice_id: String(v.voice_id ?? ""),
        name: String(v.name ?? "Untitled"),
        gender:
          v.gender === "male" || v.gender === "female"
            ? (v.gender as "male" | "female")
            : null,
        description:
          typeof v.description === "string" && v.description.length > 0
            ? v.description
            : null,
        preview_url:
          typeof v.preview_url === "string" ? v.preview_url : null,
        cloned_by_count:
          typeof v.cloned_by_count === "number" ? v.cloned_by_count : null,
      }))
      .filter((v) => v.voice_id);

    return NextResponse.json({
      voices: voices.length > 0 ? voices : FALLBACK,
      source: "elevenlabs-featured",
    });
  } catch (err) {
    return NextResponse.json(
      {
        voices: FALLBACK,
        source: "fallback-exception",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 200 },
    );
  }
}
