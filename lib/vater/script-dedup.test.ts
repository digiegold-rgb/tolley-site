import test from "node:test";
import assert from "node:assert/strict";
import {
  containment,
  findDuplicates,
  findTitleDuplicates,
  normalize,
  sharedPhrase,
  shingles,
  titleOverlap,
  MIN_WORDS,
} from "./script-dedup";

const A = `
Most people think the fastest way to build wealth is to earn more money.
It is not. The fastest way to build wealth is to keep more of what you already
earn, and the difference between those two sentences is about forty thousand
dollars a year for the average household in this country. Linda and I learned
that the hard way, sitting at a kitchen table with a stack of statements we had
been too scared to open for most of a year. What we found in those envelopes
changed how we thought about money for good.
`;

// Same material, rewritten the way rule 26 asks for: new opening, new
// structure, different example. Should NOT trip rule 27.
const A_REWRITTEN = `
There is a story people tell about getting rich, and it starts with a bigger
paycheck. That story is wrong. The households that actually pull ahead are the
ones that stop leaking what they already bring home. I found that out at a
kitchen table, across from Linda, with a pile of envelopes neither of us had
wanted to open. The number hiding in that pile was larger than any raise I had
ever been given, and it had been sitting there the whole time.
`;

const B = `
Compound interest is the only force in personal finance that works while you
are asleep. Nobody explains it properly, so most people meet it far too late to
matter. If you put away two hundred dollars a month starting at twenty five,
and you never raise that number once, you will retire with more than the person
who starts at forty and saves three times as much every single month.
`;

test("normalize + shingles", () => {
  assert.equal(normalize("Don't — really! 12 things."), "dont really 12 things");
  assert.equal(shingles("one two three", 8).size, 0, "too short to shingle");
  assert.equal(shingles("a b c d e f g h i", 8).size, 2);
});

test("containment is symmetric and bounded", () => {
  const s = shingles(A);
  assert.equal(containment(s, s), 1);
  assert.equal(containment(s, new Set()), 0);
  assert.equal(containment(new Set(), s), 0);
});

test("rule 27 — an exact resubmit is flagged verbatim", () => {
  const r = findDuplicates(A, [{ id: "p1", title: "The Forty Thousand Dollar Leak", text: A }]);
  assert.equal(r.inconclusive, false);
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].verdict, "verbatim");
  assert.equal(r.matches[0].overlap, 1);
  assert.match(r.matches[0].reason, /already have this one/i);
});

test("rule 27 — a longer paste containing an existing script still trips", () => {
  const padded = `${"Some unrelated preamble sentence here. ".repeat(30)}${A}`;
  const r = findDuplicates(padded, [{ id: "p1", title: "The Leak", text: A }]);
  assert.equal(r.matches[0]?.verdict, "verbatim", "containment must not be diluted by length");
});

test("rule 26/27 — a genuine rewrite is NOT flagged verbatim", () => {
  const r = findDuplicates(A_REWRITTEN, [{ id: "p1", title: "The Leak", text: A }]);
  const m = r.matches[0];
  if (m) assert.notEqual(m.verdict, "verbatim", `rewrite scored ${m.overlap}`);
});

test("unrelated scripts do not match at all", () => {
  const r = findDuplicates(A, [{ id: "p2", title: "Compound Interest", text: B }]);
  assert.equal(r.matches.length, 0);
});

test("too-short candidate is inconclusive, never a false clear", () => {
  const r = findDuplicates("only a handful of words here", [{ id: "p1", title: "x", text: A }]);
  assert.equal(r.inconclusive, true);
  assert.equal(r.matches.length, 0);
});

test("empty history is inconclusive, not 'no duplicates'", () => {
  const r = findDuplicates(A, []);
  assert.equal(r.inconclusive, true);
});

test("priors too short to judge are skipped, not counted as checked", () => {
  const r = findDuplicates(A, [{ id: "p1", title: "stub", text: "three words only" }]);
  assert.equal(r.checked, 0);
  assert.equal(r.inconclusive, true);
});

test("rule 28 — the overlap is named, not just scored", () => {
  const p = sharedPhrase(A, A);
  assert.ok(p && p.split(" ").length >= 8, "must return a real phrase");
  assert.equal(sharedPhrase(A, B), null);
});

test("verbatim sorts ahead of similar", () => {
  const r = findDuplicates(A, [
    { id: "sim", title: "Similar", text: `${A.slice(0, 400)} ${B}` },
    { id: "same", title: "Same", text: A },
  ]);
  assert.equal(r.matches[0].id, "same");
  assert.equal(r.matches[0].verdict, "verbatim");
});

test("title overlap ignores stopwords", () => {
  assert.equal(titleOverlap("The Truth About Compound Interest", "Compound Interest, The Truth"), 1);
  assert.ok(titleOverlap("Buying vs Renting", "Compound Interest Explained") < 0.2);
});

test("title-only pass flags same-subject titles", () => {
  const r = findTitleDuplicates("The Truth About Compound Interest", [
    { id: "p2", title: "Compound Interest, The Real Truth", text: B },
    { id: "p3", title: "Buying Versus Renting", text: A },
  ]);
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].id, "p2");
});

test("MIN_WORDS is the documented shingle floor", () => {
  assert.equal(MIN_WORDS, 24);
});
