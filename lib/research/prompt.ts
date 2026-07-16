/**
 * Deep Research prompt templates.
 *
 * The research prompt is the product: it forces the OpenManus agent to
 * cite a URL it actually visited for every claim, cross-check key claims
 * against 2+ independent domains, and label anything it couldn't verify —
 * then emit one fenced JSON block we can parse deterministically.
 *
 * Structured prompts with an explicit output contract are the shape we
 * verified works reliably on local Qwen (see lib/dossier/synthesis.ts) —
 * open-ended prompts loop.
 */

export interface ResearchSource {
  url: string;
  title: string;
  quote?: string;
}

export interface ResearchClaim {
  text: string;
  sources: ResearchSource[];
  verified: boolean;
  confidence: number; // 0-100
}

export interface ResearchAnswer {
  answerMarkdown: string;
  claims: ResearchClaim[];
  overallConfidence: number; // 0-100
  unverifiedNotes?: string;
}

export function buildResearchPrompt(query: string): string {
  return `You are a verification-obsessed research agent. Research this question and produce a fully-cited answer.

QUESTION: "${query}"

RULES — non-negotiable:
1. Every factual claim in your answer MUST cite a source URL you actually visited. Use web_search to FIND candidate pages, then READ each page you cite (crawl4ai or browser_use). NEVER cite a search-result snippet you did not open.
2. Key claims need 2+ independent sources (different domains). A claim with only one source must be marked verified=false.
3. If you cannot verify something, say so explicitly in unverified_notes. NEVER guess or fill gaps from prior knowledge without labeling it "unverified — model knowledge".
4. Prefer primary sources: manufacturer pages, official datasheets, standards bodies, government records, then reputable distributors/databases.
5. Keep the answer focused on the question. A table is good when comparing options.

OUTPUT CONTRACT — after your research is complete, your FINAL step must be ONE python_execute call that prints exactly this, starting on the first line:

RESEARCH_ANSWER_JSON
\`\`\`json
{
  "answer_markdown": "the full answer in markdown — headings, tables, inline [linked](url) citations",
  "claims": [
    {
      "text": "one factual claim from the answer",
      "sources": [{"url": "https://...", "title": "page title", "quote": "verbatim sentence from the page that supports the claim"}],
      "verified": true,
      "confidence": 90
    }
  ],
  "overall_confidence": 0-100,
  "unverified_notes": "anything you could not confirm, and why"
}
\`\`\`

Then call the terminate tool. Keep the JSON valid: escape quotes and newlines inside strings. Do not add commentary after the JSON block.`;
}

export function buildVerifyPrompt(claims: ResearchClaim[]): string {
  const list = claims
    .map((c, i) => {
      const urls = c.sources.map((s) => s.url).join(" | ");
      return `${i}. CLAIM: ${c.text}\n   URLS: ${urls}`;
    })
    .join("\n");

  return `Fact-check pass. For each claim below, fetch its URL(s) with crawl4ai and check whether the page content actually supports the claim. Do NOT search for new sources. Do NOT use prior knowledge — only what the fetched pages say.

${list}

OUTPUT CONTRACT — your FINAL step must be ONE python_execute call that prints exactly this, starting on the first line:

VERIFY_VERDICTS_JSON
\`\`\`json
{
  "verdicts": [
    {"claim_index": 0, "url": "https://...", "supported": true, "evidence_quote": "verbatim sentence from the page"}
  ]
}
\`\`\`

Use supported: true | false | "unreachable" (page failed to load). One verdict per claim/URL pair. Then call the terminate tool.`;
}
