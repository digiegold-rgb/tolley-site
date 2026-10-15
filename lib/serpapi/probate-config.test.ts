import test from "node:test";
import assert from "node:assert/strict";
import {
  claimDecedent,
  isLikelyDecedent,
  parseObitResult,
  type ObitTarget,
} from "./probate-config";

const independence: ObitTarget = {
  site: "legacy.com",
  region: "Independence, MO",
  county: "Jackson",
  state: "MO",
};

const PERSON_URL = "https://www.legacy.com/us/obituaries/person/john-a-smith";

function candidate(title: string, snippet = "of Independence, Missouri passed away on March 1, 2026") {
  return {
    url: PERSON_URL,
    title,
    snippet,
    city: "Independence",
    state: "MO",
  };
}

test("non-person titles are rejected", () => {
  for (const title of [
    "Oak Park Library",
    "AdventHealth South Overland Park",
    "Coffee Shop Kansas City",
    "KC Star Obits Today",
  ]) {
    assert.equal(isLikelyDecedent(candidate(title)), false, title);
    assert.equal(
      parseObitResult(
        { title, link: PERSON_URL, snippet: candidate(title).snippet },
        independence
      ),
      null,
      title
    );
  }
});

test("legacy.com person obituary with a death year and matching state is accepted", () => {
  const item = {
    title: "John A. Smith Obituary (1943 - 2026)",
    link: PERSON_URL,
    snippet: "of Independence, Missouri",
    date: "2026-10-14",
  };
  assert.equal(
    isLikelyDecedent({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
      city: "Independence",
      state: "MO",
    }),
    true
  );
  const parsed = parseObitResult(item, independence);
  assert.ok(parsed);
  assert.equal(parsed.decedentName, "John A. Smith");
  assert.equal(parsed.decedentAge, 83);
  // Year-only death dates are January 1 of that year at noon UTC, not the search date.
  assert.equal(parsed.obitDate?.toISOString(), "2026-01-01T12:00:00.000Z");
});

test("a different of-city state is rejected and a missing one is not", () => {
  const item = {
    title: "John A. Smith Obituary (1943 - 2026)",
    link: PERSON_URL,
    snippet: "of Dallas, Texas",
  };
  assert.equal(isLikelyDecedent({ ...candidate(item.title, item.snippet), url: item.link }), false);
  assert.equal(parseObitResult(item, independence), null);
  assert.equal(parseObitResult({ ...item, snippet: "of Wichita, KS" }, independence), null);
  assert.equal(parseObitResult({ ...item, snippet: "of Independence, Kansas" }, independence), null);

  const noResidence = parseObitResult(
    { ...item, snippet: "Services will be announced." },
    independence
  );
  assert.ok(noResidence);
  assert.ok(parseObitResult({ ...item, snippet: "of Independence, MO" }, independence));
  assert.ok(parseObitResult({ ...item, snippet: "of Independence, Missouri" }, independence));
});

test("passed away and died dates are stored at noon UTC instead of the search date", () => {
  const died = parseObitResult(
    {
      title: "John A. Smith Obituary",
      link: PERSON_URL,
      snippet: "of Independence, Missouri, died March 4, 2026",
      date: "2026-10-01",
    },
    independence
  );
  assert.equal(died?.obitDate?.toISOString(), "2026-03-04T12:00:00.000Z");

  const passed = parseObitResult(
    {
      title: "John A. Smith Obituary (1943 - 2026)",
      link: PERSON_URL,
      snippet: "of Independence, MO passed away on March 14, 2026",
      date: "2026-10-14",
    },
    independence
  );
  assert.equal(passed?.obitDate?.toISOString(), "2026-03-14T12:00:00.000Z");
});

test("a title lifespan is kept when the snippet only mentions a relative's death", () => {
  const parsed = parseObitResult(
    {
      title: "John A. Smith Obituary (1943 - 2026)",
      link: PERSON_URL,
      snippet:
        "of Independence, Missouri. Preceded in death by his wife, who died on January 1, 1999.",
    },
    independence
  );
  assert.equal(parsed?.obitDate?.toISOString(), "2026-01-01T12:00:00.000Z");
});

test("an obituary with no death year or date is rejected", () => {
  assert.equal(
    parseObitResult(
      {
        title: "John A. Smith Obituary",
        link: PERSON_URL,
        snippet: "of Independence, Missouri",
      },
      independence
    ),
    null
  );
});

test("the target city name in a title is rejected", () => {
  assert.equal(
    parseObitResult(
      {
        title: "Independence Community Obituary (1943 - 2026)",
        link: PERSON_URL,
        snippet: "Services will be announced.",
      },
      independence
    ),
    null
  );
});

test("Obit is a whole word and Obits is not", () => {
  assert.equal(
    isLikelyDecedent({
      url: "https://www.kansascity.com/obits/today",
      title: "KC Star Obits Today",
      snippet: "passed away on March 1, 2026",
      city: "Independence",
      state: "MO",
    }),
    false
  );
  const obit = parseObitResult(
    {
      title: "Jane Q. Doe Obit (1931 - 2026)",
      link: "https://www.obittree.com/obituary/jane-q-doe",
      snippet: "of Independence, Missouri",
    },
    independence
  );
  assert.equal(obit?.decedentName, "Jane Q. Doe");
});

test("duplicates collapse by normalized name and death date within a run", () => {
  const first = parseObitResult(
    {
      title: "John A. Smith Obituary (1943 - 2026)",
      link: PERSON_URL,
      snippet: "of Independence, Missouri",
    },
    independence
  );
  const again = parseObitResult(
    {
      title: "John A Smith Obituary (1943 - 2026)",
      link: "https://www.legacy.com/us/obituaries/name/john-a-smith-obituary?id=9",
      snippet: "of Independence, MO",
    },
    independence
  );
  const otherYear = parseObitResult(
    {
      title: "John A. Smith Obituary (1943 - 2025)",
      link: "https://www.legacy.com/us/obituaries/person/john-a-smith-2025",
      snippet: "of Independence, Missouri",
    },
    independence
  );
  const otherPerson = parseObitResult(
    {
      title: "Jane Q. Doe Obituary (1931 - 2026)",
      link: "https://www.obittree.com/obituary/jane-q-doe",
      snippet: "passed away on January 2, 2026",
    },
    independence
  );
  assert.ok(first?.obitDate && again?.obitDate && otherYear?.obitDate && otherPerson?.obitDate);

  const seen = new Set<string>();
  assert.equal(claimDecedent(seen, first.decedentName, first.obitDate), true);
  assert.equal(claimDecedent(seen, again.decedentName, again.obitDate), false);
  assert.equal(claimDecedent(seen, otherYear.decedentName, otherYear.obitDate), true);
  assert.equal(claimDecedent(seen, otherPerson.decedentName, otherPerson.obitDate), true);
  assert.equal(seen.size, 3);
});
