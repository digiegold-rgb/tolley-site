import { companyOfferings, offeringFacts } from "./catalog";

const stopWords = new Set("a an and are at be can do does for from how i in is it me much my of on or the to what where which who with you your".split(" "));
/** Deterministic retrieval of published facts, not generated answers or live inventory. */
export function publicKnowledge(query: string) {
  const terms = [...new Set((query.slice(0, 300).toLowerCase().match(/[a-z0-9]+/g) || []).filter(t => !stopWords.has(t)))];
  return companyOfferings().map(s => {
    const facts = offeringFacts(s.name)!;
    const body = JSON.stringify(facts);
    const searchable = `${s.name} ${facts.title} ${body}`.toLowerCase();
    const score = terms.reduce((total, term) => total + (s.name === term ? 4 : facts.title.toLowerCase().includes(term) ? 3 : searchable.includes(term) ? 1 : 0), 0);
    return { score, item: {
      id: `catalog:${s.name}`, title: facts.title, body, sources: [facts.url], audience: "public",
      evidence: { method: "product_registry", verification: "published_facts", reviewedAt: facts.reviewedAt, limitation: "Published prices and service terms; confirm availability with the provider." },
      // A source-review date is not a claim of a fresh inventory check.
      updatedAt: facts.reviewedAt ? `${facts.reviewedAt}T00:00:00.000Z` : null,
    } };
  }).filter(r => terms.length === 0 || r.score > 0).sort((a, b) => b.score - a.score).slice(0, 20).map(r => r.item);
}
