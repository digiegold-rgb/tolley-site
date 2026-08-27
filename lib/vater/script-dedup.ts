/**
 * lib/vater/script-dedup.ts — Script Rules 2.0, rules 27 and 28.
 *
 *   27. Flag verbatim repeats. If a script has already been submitted in this
 *       conversation, say so before rewriting it.
 *   28. Flag thematically similar scripts. If a new script covers similar
 *       ground to one already done, even if it isn't identical, name the
 *       earlier script, note what overlaps, and let the user decide whether to
 *       proceed, request a more differentiated angle, or hold off.
 *
 * Those rules were written for a Claude chat where "this conversation" was the
 * memory. In the studio the memory is the customer's own project history, and
 * the point of running this is that it happens BEFORE the rewrite is paid for
 * (Trey brief ship item 4: "run flag 27 and 28 before you spend tokens on a
 * full rewrite"). So this is deliberately deterministic and LLM-free — word
 * shingles and set overlap. It costs nothing, it cannot hallucinate a match,
 * and it runs in milliseconds on a few hundred projects.
 *
 * CONTAINMENT, not Jaccard. Jaccard punishes length differences, and the
 * common case here is "he pasted the 2,400-word source of a 1,600-word script
 * he already made" — genuinely the same material, Jaccard ~0.55, containment
 * ~0.95. Containment asks "how much of the SMALLER document appears in the
 * larger one", which is the question rule 27 is actually asking.
 */

/** Words per shingle. 8 is long enough that ordinary English overlap ("at the
 *  end of the day") does not register, short enough to survive light editing.
 *  It is also the top of rule 26's own "three to eight word phrase" self-check,
 *  so a draft that passes this passes the rule that inspired it. */
export const SHINGLE_N = 8;

/** Containment at or above this = rule 27, a verbatim repeat. */
export const VERBATIM_THRESHOLD = 0.85;

/** Containment at or above this (and below verbatim) = rule 28, similar. */
export const SIMILAR_THRESHOLD = 0.25;

/** Title-token overlap that counts as "same topic" even with no shared prose. */
export const TITLE_THRESHOLD = 0.6;

/** Below this many words a document cannot be judged — too short to shingle. */
export const MIN_WORDS = SHINGLE_N * 3;

/** Words that carry no topic signal, so they never decide a title match. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this",
  "these", "those", "is", "are", "was", "were", "be", "been", "being", "to",
  "of", "in", "on", "at", "for", "with", "from", "by", "as", "it", "its",
  "you", "your", "yours", "i", "me", "my", "we", "our", "they", "them",
  "their", "he", "she", "his", "her", "do", "does", "did", "how", "what",
  "why", "when", "where", "who", "will", "would", "can", "could", "should",
  "not", "no", "so", "up", "out", "about", "into", "over", "after", "before",
  "more", "most", "very", "just", "here", "there", "get", "got", "make",
]);

/** Lowercase, strip everything that is not a letter/digit/space, collapse. */
export function normalize(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function words(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

/** Set of N-word shingles. Empty when the text is shorter than one shingle. */
export function shingles(text: string, n: number = SHINGLE_N): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

/** |A ∩ B| / min(|A|, |B|) — 0 when either side is empty. */
export function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let hits = 0;
  for (const s of small) if (large.has(s)) hits++;
  return hits / small.size;
}

/** Topic-word Jaccard over two titles. Stopwords removed; 0 if either empty. */
export function titleOverlap(a: string, b: string): number {
  const ta = new Set(words(a).filter((w) => w.length > 2 && !STOPWORDS.has(w)));
  const tb = new Set(words(b).filter((w) => w.length > 2 && !STOPWORDS.has(w)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0;
  for (const w of ta) if (tb.has(w)) hits++;
  return hits / Math.min(ta.size, tb.size);
}

/** Longest run of consecutive shared shingles, rendered back as a phrase.
 *  Rule 28 says "name what overlaps" — a number alone does not do that. */
export function sharedPhrase(candidate: string, other: string, n: number = SHINGLE_N): string | null {
  const otherSet = shingles(other, n);
  if (otherSet.size === 0) return null;
  const w = words(candidate);
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let i = 0; i + n <= w.length; i++) {
    if (otherSet.has(w.slice(i, i + n).join(" "))) {
      if (runStart < 0) runStart = i;
      const len = i - runStart + n;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
    } else {
      runStart = -1;
    }
  }
  if (bestStart < 0) return null;
  const phrase = w.slice(bestStart, bestStart + Math.min(bestLen, 40)).join(" ");
  return bestLen > 40 ? `${phrase}…` : phrase;
}

export type DedupVerdict = "verbatim" | "similar";

export interface PriorScript {
  id: string;
  /** What to call it back to the user. */
  title: string;
  /** The prose to compare against — script if there is one, else transcript. */
  text: string;
  createdAt?: string | null;
  status?: string | null;
}

export interface DedupMatch {
  id: string;
  title: string;
  verdict: DedupVerdict;
  /** 0-1 containment of the smaller document in the larger. */
  overlap: number;
  /** 0-1 topic-word overlap of the titles. */
  titleOverlap: number;
  /** The longest phrase the two actually share, or null. */
  phrase: string | null;
  createdAt: string | null;
  /** One line the UI can show as-is. */
  reason: string;
}

export interface DedupResult {
  /** True when nothing could be judged (candidate too short, no history). */
  inconclusive: boolean;
  checked: number;
  matches: DedupMatch[];
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/**
 * Compare one candidate against the customer's history. Sorted worst-first, so
 * `matches[0]` is the thing to say out loud.
 *
 * Note the asymmetry between the two rules: a verbatim hit (27) is a STOP —
 * you are about to pay to rewrite something you already have. A similar hit
 * (28) is explicitly the user's call to make; this function never decides it
 * for them, it only names the overlap.
 */
export function findDuplicates(
  candidate: string,
  priors: PriorScript[],
  opts?: { limit?: number },
): DedupResult {
  const limit = Math.max(1, opts?.limit ?? 5);
  const candWords = words(candidate);
  if (candWords.length < MIN_WORDS) {
    return { inconclusive: true, checked: 0, matches: [] };
  }
  const candSet = shingles(candidate);
  const matches: DedupMatch[] = [];
  let checked = 0;

  for (const prior of priors) {
    const priorWords = words(prior.text);
    if (priorWords.length < MIN_WORDS) continue;
    checked++;
    const overlap = containment(candSet, shingles(prior.text));
    const tOverlap = titleOverlap(candidate.slice(0, 300), prior.title);
    let verdict: DedupVerdict | null = null;
    if (overlap >= VERBATIM_THRESHOLD) verdict = "verbatim";
    else if (overlap >= SIMILAR_THRESHOLD) verdict = "similar";
    if (!verdict) continue;

    const phrase = sharedPhrase(candidate, prior.text);
    const reason =
      verdict === "verbatim"
        ? `You already have this one. "${prior.title}" shares ${pct(overlap)} of its wording with what you just pasted.`
        : `"${prior.title}" covers similar ground — ${pct(overlap)} of the shorter script's phrasing appears in both.`;

    matches.push({
      id: prior.id,
      title: prior.title,
      verdict,
      overlap: Math.round(overlap * 1000) / 1000,
      titleOverlap: Math.round(tOverlap * 1000) / 1000,
      phrase,
      createdAt: prior.createdAt ?? null,
      reason,
    });
  }

  matches.sort(
    (a, b) =>
      (a.verdict === b.verdict ? 0 : a.verdict === "verbatim" ? -1 : 1) ||
      b.overlap - a.overlap,
  );
  return { inconclusive: checked === 0, checked, matches: matches.slice(0, limit) };
}

/** Title-only pass, for when the candidate is a URL or a topic, not prose. */
export function findTitleDuplicates(
  candidateTitle: string,
  priors: PriorScript[],
  opts?: { limit?: number },
): DedupResult {
  const limit = Math.max(1, opts?.limit ?? 5);
  const matches: DedupMatch[] = [];
  let checked = 0;
  for (const prior of priors) {
    if (!prior.title.trim()) continue;
    checked++;
    const t = titleOverlap(candidateTitle, prior.title);
    if (t < TITLE_THRESHOLD) continue;
    matches.push({
      id: prior.id,
      title: prior.title,
      verdict: "similar",
      overlap: 0,
      titleOverlap: Math.round(t * 1000) / 1000,
      phrase: null,
      createdAt: prior.createdAt ?? null,
      reason: `"${prior.title}" is on the same subject — ${pct(t)} of its topic words match this title.`,
    });
  }
  matches.sort((a, b) => b.titleOverlap - a.titleOverlap);
  return { inconclusive: checked === 0, checked, matches: matches.slice(0, limit) };
}
