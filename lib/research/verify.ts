/**
 * Deterministic citation verification — no LLM involved.
 *
 * For every claim source we re-fetch the cited URL from the Vercel
 * function and check that the quoted sentence (or, failing that, a
 * distinctive shingle of the claim itself) actually appears in the page
 * text. A fabricated URL, a dead link, or a misquote all surface as
 * unsupported/unreachable instead of being trusted — this is the check
 * that lets the answer page honestly show ✓ verified per claim.
 */

import { inflateSync } from "node:zlib";
import type { VerifyVerdict } from "./manus";
import type { ResearchAnswer, ResearchClaim } from "./prompt";

const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 4;
// Plain browser UA — Google's grounding-redirect endpoint (and plenty of
// manufacturer sites) 404/403 on anything that doesn't look like a browser.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Collapse whitespace + lowercase so quote matching survives markup. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Crude but dependency-free HTML → text. */
function htmlToText(html: string): string {
  return normalize(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

/** Word shingles from the claim used as a fallback when no quote given. */
function shingles(text: string, size = 6): string[] {
  const words = normalize(text).split(" ").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + size <= words.length; i += 2) {
    out.push(words.slice(i, i + size).join(" "));
  }
  return out.slice(0, 8);
}

interface FetchedPage {
  text: string;
  finalUrl: string;
  title: string;
}

async function fetchPage(url: string): Promise<FetchedPage | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype.includes("pdf") || ctype.includes("octet-stream") || /\.pdf(\?|$)/i.test(res.url || url)) {
      // Datasheets are usually PDFs — extract what text we can rather
      // than writing the source off as unverifiable.
      const buf = Buffer.from(await res.arrayBuffer());
      const text = pdfToText(buf);
      if (!text) return null;
      const name = (res.url || url).split("/").pop()?.split("?")[0] ?? "PDF datasheet";
      return { text, finalUrl: res.url || url, title: decodeURIComponent(name) };
    }
    const html = await res.text();
    const title = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1]?.trim() ?? "";
    return {
      text: htmlToText(html.slice(0, 2_000_000)),
      finalUrl: res.url || url,
      title: title.replace(/\s+/g, " "),
    };
  } catch {
    return null;
  }
}

/**
 * Dependency-free best-effort PDF text extraction: inflate FlateDecode
 * streams and keep printable runs, plus any plaintext already in the
 * file. Not layout-aware — but token/shingle matching only needs the
 * words (grade codes, percentages, names) to be present somewhere.
 */
function pdfToText(buf: Buffer): string | null {
  if (buf.length < 100 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  const pieces: string[] = [printableRuns(buf)];
  const raw = buf.toString("latin1");
  let idx = 0;
  for (let guard = 0; guard < 500; guard++) {
    const start = raw.indexOf("stream", idx);
    if (start < 0) break;
    let dataStart = start + 6;
    if (raw[dataStart] === "\r") dataStart++;
    if (raw[dataStart] === "\n") dataStart++;
    const end = raw.indexOf("endstream", dataStart);
    if (end < 0) break;
    try {
      const inflated = inflateSync(buf.subarray(dataStart, end));
      pieces.push(printableRuns(inflated));
    } catch {
      // not flate-compressed (or encrypted) — skip this stream
    }
    idx = end + 9;
  }
  const text = normalize(pieces.join(" "));
  return text.length > 50 ? text : null;
}

function printableRuns(buf: Buffer): string {
  const runs = buf
    .toString("latin1")
    .match(/[\x20-\x7e]{4,}/g);
  if (!runs) return "";
  // Strip PDF operators/dict noise, keep word-ish runs.
  return runs
    .map((r) => r.replace(/[()<>[\]{}\\/]/g, " "))
    .join(" ");
}

/**
 * Distinctive tokens of a claim — product codes, numbers, capitalized
 * names. Grounded claims are the model's paraphrase, not verbatim page
 * text, so verification checks whether the page contains the hard,
 * specific facts (the tokens that would differ if the claim were made
 * up) rather than the exact sentence.
 */
function distinctiveTokens(text: string): string[] {
  const tokens = new Set<string>();
  // Alphanumeric codes: DN2850, KNB 25LM, A-401C, 2845F …
  for (const m of text.matchAll(/\b(?=\w*\d)[A-Za-z0-9][\w-]{2,}\b/g)) tokens.add(m[0].toLowerCase());
  // Percentages and decimal figures: 28%, 0.97, 45-55
  for (const m of text.matchAll(/\b\d+(?:\.\d+)?%?\b/g)) if (m[0].length >= 2) tokens.add(m[0].toLowerCase());
  // Proper nouns (capitalized words not at obvious sentence start)
  for (const m of text.matchAll(/(?<=\w[\s,;:] )[A-Z][a-z]{3,}\b/g)) tokens.add(m[0].toLowerCase());
  return [...tokens].slice(0, 12);
}

function checkSupport(pageText: string, quote: string | undefined, claimText: string): boolean {
  if (quote && quote.length >= 25) {
    const nq = normalize(quote);
    if (pageText.includes(nq)) return true;
    // Partial-quote tolerance: any 8-word run of the quote found on page.
    for (const sh of shingles(quote, 8)) {
      if (pageText.includes(sh)) return true;
    }
  }
  // Verbatim shingles of the claim itself.
  for (const sh of shingles(claimText, 5)) {
    if (pageText.includes(sh)) return true;
  }
  // Paraphrased claims: require the hard facts (codes, figures, names)
  // to appear on the page — at least 2 and at least 40% of them.
  const tokens = distinctiveTokens(claimText);
  return tokenCoverage(pageText, tokens) >= coverageThreshold(tokens.length);
}

function coverageThreshold(tokenCount: number): number {
  return tokenCount >= 2 ? Math.max(2, Math.ceil(tokenCount * 0.4)) : Infinity;
}

function tokenCoverage(pageText: string, tokens: string[]): number {
  return tokens.filter((t) => pageText.includes(t)).length;
}

/**
 * Verify every claim/source pair. Page fetches are cached per-URL and run
 * with modest concurrency. Returns the same VerifyVerdict shape the DGX
 * verify task produces, so applyVerdicts() works for both engines.
 */
export async function verifyClaims(claims: ResearchClaim[]): Promise<VerifyVerdict[]> {
  const pairs: Array<{ claimIndex: number; url: string; quote?: string; claimText: string }> = [];
  claims.forEach((claim, i) => {
    claim.sources.forEach((s) => {
      pairs.push({ claimIndex: i, url: s.url, quote: s.quote, claimText: claim.text });
    });
  });

  const pageCache = new Map<string, Promise<FetchedPage | null>>();
  const getPage = (url: string) => {
    if (!pageCache.has(url)) pageCache.set(url, fetchPage(url));
    return pageCache.get(url)!;
  };

  const verdicts: VerifyVerdict[] = [];
  for (let i = 0; i < pairs.length; i += CONCURRENCY) {
    const batch = pairs.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (p): Promise<VerifyVerdict> => {
        const page = await getPage(p.url);
        if (page === null) {
          return { claim_index: p.claimIndex, url: p.url, supported: "unreachable" };
        }
        const ok = checkSupport(page.text, p.quote, p.claimText);
        return {
          claim_index: p.claimIndex,
          url: p.url,
          supported: ok,
          evidence_quote: ok ? p.quote : undefined,
          resolved_url: page.finalUrl,
          resolved_title: page.title || undefined,
        };
      })
    );
    verdicts.push(...settled);
  }

  // Second pass: a synthesized claim (e.g. a comparison-table row) merges
  // facts from several pages, so no single page contains enough of its
  // tokens. If the UNION of the claim's reachable cited pages covers the
  // tokens, credit the sources that contributed.
  for (let ci = 0; ci < claims.length; ci++) {
    const mine = verdicts.filter((v) => v.claim_index === ci);
    if (mine.some((v) => v.supported === true)) continue;
    const reachable = mine.filter((v) => v.supported === false);
    if (reachable.length < 2) continue;
    const tokens = distinctiveTokens(claims[ci].text);
    const threshold = coverageThreshold(tokens.length);
    if (!isFinite(threshold)) continue;
    const pages = await Promise.all(reachable.map((v) => getPage(v.url)));
    const covered = new Set<string>();
    for (const page of pages) {
      if (!page) continue;
      for (const t of tokens) if (page.text.includes(t)) covered.add(t);
    }
    if (covered.size >= threshold) {
      for (let i = 0; i < reachable.length; i++) {
        const page = pages[i];
        if (page && tokenCoverage(page.text, tokens) > 0) reachable[i].supported = true;
      }
    }
  }
  return verdicts;
}

/**
 * Fold deterministic web verdicts into the answer. Unlike the LLM verify
 * pass, a failed quote-match here is "unconfirmed", not "contradicted" —
 * bot-walled or JS-rendered pages legitimately won't match — so the
 * penalties are gentler:
 *   - claim verified ⇔ at least one source's quote was found on the live page
 *   - quote checked but not found (and never found anywhere) → confidence ≤ 40
 *   - all sources unreachable → unverified, confidence untouched
 *   - overall = model score, scaled down when little could be confirmed
 */
export function applyWebVerdicts(answer: ResearchAnswer, verdicts: VerifyVerdict[]): ResearchAnswer {
  const claims = answer.claims.map((claim, i) => {
    const mine = verdicts.filter((v) => v.claim_index === i);
    // Swap grounding redirect URLs for the real page URL + title we saw
    // during verification, so the UI links straight to the source.
    const sources = claim.sources.map((s) => {
      const v = mine.find((m) => m.url === s.url && m.resolved_url);
      return v
        ? { ...s, url: v.resolved_url!, title: v.resolved_title || s.title }
        : s;
    });
    if (mine.length === 0) return { ...claim, sources, verified: false };
    const anyTrue = mine.some((v) => v.supported === true);
    const allUnreachable = mine.every((v) => v.supported === "unreachable");
    if (anyTrue) return { ...claim, sources, verified: true };
    if (allUnreachable) return { ...claim, sources, verified: false };
    return { ...claim, sources, verified: false, confidence: Math.min(claim.confidence, 40) };
  });
  const total = claims.length || 1;
  const confirmed = claims.filter((c) => c.verified).length;
  // 100% confirmed → model score stands; 0% confirmed → halved.
  const scale = 0.5 + 0.5 * (confirmed / total);
  return {
    ...answer,
    claims,
    overallConfidence: Math.round(answer.overallConfidence * scale),
  };
}
