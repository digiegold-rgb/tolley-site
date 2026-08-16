/**
 * POST /api/vater/script/from-url   { url }  →  { title, text, source }
 *
 * Intake for the Script step's "From a link or PDF" box. Primary path is the
 * DGX (`POST /vater/script/from-url`), which handles articles, PDFs AND
 * YouTube transcripts. That endpoint is being built in parallel, so when it
 * answers 404/501 this route falls back to a site-side readability pass:
 *
 *   - HTML  → fetched server-side, tags stripped, entities decoded.
 *   - PDF   → 501 (`pdf-parse` is not a dependency of this app). The UI
 *             disables the control with a tooltip rather than looking broken.
 *   - YouTube → 501. Transcript extraction is DGX-only; no site-side path.
 *
 * SSRF: only http(s), and loopback / link-local / RFC1918 hosts are refused
 * before the fetch. This route runs with our credentials on Vercel; it must
 * not be usable as a probe into anything private.
 */
import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import { auth } from "@/auth";
import { dgxCall, unavailableBody } from "@/lib/vater/dgx-feature-proxy";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // 4MB of HTML is already absurd
const MAX_CHARS = 60_000; // ~10k words, well past any script length

type FromUrlResult = { title: string; text: string; source: string };

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal)$/i;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST.test(host)) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

/** SSRF guard: a hostname is only safe if EVERY address it resolves to is
 *  public. Blocks DNS-rebinding style bypasses (attacker name → 127.0.0.1). */
async function resolvesToBlocked(hostname: string): Promise<boolean> {
  if (isBlockedHost(hostname)) return true;
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    if (!addrs.length) return true;
    return addrs.some((a) => isBlockedHost(a.address));
  } catch {
    return true; // unresolvable = refuse
  }
}

/** Fetch with manual, bounded, re-validated redirects (max 4 hops). */
async function safeFetch(start: URL, init: RequestInit): Promise<Response> {
  let current = start;
  for (let hop = 0; hop < 5; hop++) {
    if (!/^https?:$/.test(current.protocol) || (await resolvesToBlocked(current.hostname))) {
      throw new Error("Blocked destination");
    }
    const res = await fetch(current.toString(), { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, current);
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

function isYouTube(u: URL): boolean {
  return /(^|\.)(youtube\.com|youtu\.be)$/i.test(u.hostname);
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1]?.toLowerCase() === "x"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Minimal readability pass: drop non-content elements, prefer <article> /
 *  <main> when present, then strip the remaining tags. Not a parser — good
 *  enough to hand a writer the gist of a page, which is all this feeds. */
function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  const title = decodeEntities(
    (ogTitle?.[1] ?? titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim(),
  );

  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ");

  const article =
    body.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    body.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (article && article.length > 400) body = article;

  const text = decodeEntities(
    body
      .replace(/<\/(p|div|li|h[1-6]|br|tr|section)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

  return { title, text: text.slice(0, MAX_CHARS) };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = typeof body.url === "string" ? body.url.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json(
      { error: "That doesn't look like a URL — include https://" },
      { status: 400 },
    );
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only http:// and https:// links are supported" },
      { status: 400 },
    );
  }
  if (isBlockedHost(target.hostname)) {
    return NextResponse.json(
      { error: "That host isn't reachable from here" },
      { status: 400 },
    );
  }

  // 1) DGX first — it's the only path that handles PDFs and YT transcripts.
  const dgx = await dgxCall<FromUrlResult>("POST", "/vater/script/from-url", {
    url: target.toString(),
  });
  if (dgx.kind === "ok") {
    return NextResponse.json({
      title: dgx.data.title ?? "",
      text: dgx.data.text ?? "",
      source: dgx.data.source ?? target.toString(),
      via: "dgx",
    });
  }
  if (dgx.kind === "error") {
    return NextResponse.json(
      { error: "Import failed", detail: dgx.body.slice(0, 300) },
      { status: 502 },
    );
  }

  // 2) Site-side fallback.
  if (isYouTube(target)) {
    return NextResponse.json(
      unavailableBody(
        "YouTube transcript import",
        "transcript extraction is DGX-only",
      ),
      { status: 501 },
    );
  }
  if (/\.pdf($|\?)/i.test(target.pathname + target.search)) {
    return NextResponse.json(
      unavailableBody("PDF import", "pdf-parse is not installed on the site"),
      { status: 501 },
    );
  }

  let res: Response;
  try {
    res = await safeFetch(target, {
      headers: {
        // Some publishers 403 a bare fetch; identify honestly instead.
        "User-Agent": "JellyStudioBot/1.0 (+https://www.tolley.io)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not reach that link",
        detail: err instanceof Error ? err.message : "fetch failed",
      },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `That link returned ${res.status}` },
      { status: 502 },
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf")) {
    return NextResponse.json(
      unavailableBody("PDF import", "pdf-parse is not installed on the site"),
      { status: 501 },
    );
  }
  if (!contentType.includes("html") && !contentType.includes("text/plain")) {
    return NextResponse.json(
      { error: `Unsupported content type: ${contentType || "unknown"}` },
      { status: 415 },
    );
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "That page is too large" }, { status: 413 });
  }
  const html = new TextDecoder("utf-8").decode(buf);

  const { title, text } = contentType.includes("text/plain")
    ? { title: "", text: html.slice(0, MAX_CHARS) }
    : htmlToText(html);

  if (!text || text.length < 200) {
    return NextResponse.json(
      {
        error:
          "Couldn't pull readable text off that page — paste the text instead",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    title,
    text,
    source: res.url || target.toString(),
    via: "site-fallback",
  });
}
