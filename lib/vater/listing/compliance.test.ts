/**
 * lib/vater/listing/compliance.test.ts
 *   npx tsx --test lib/vater/listing/compliance.test.ts
 *
 * Every fixture phrase from growth-engine/lib/fh_lint.py must BLOCK; WARN
 * rewrites must be deterministic; the prompt blocklist must catch the
 * Heartland §11.2.2 edits; MO/KS/PA end-card font ratios + blockers hold.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyRewrites,
  assertClean,
  BLOCK_RULES,
  endCardSpec,
  FairHousingError,
  frameLabelSpec,
  lintFairHousing,
  lintFields,
  lintPrompt,
  MATERIAL_CHANGE_SKUS,
  mlsSafePlan,
  STILL_SKUS,
  TESTIMONIAL_RULES,
  WARN_RULES,
  type ComplianceSku,
} from "./compliance";
import { LISTING_SKUS, LISTING_SKU_IDS } from "../listing-pricing";

/** One phrase per BLOCK rule, in rule order (mirrors the Python fixtures). */
const BLOCK_FIXTURES: Array<[phrase: string, cls: string]> = [
  ["This home is perfect for a family", "familial status"],
  ["A family-friendly street", "familial status"],
  ["No kids please", "familial status"],
  ["An empty-nester dream", "familial status"],
  ["Ultimate bachelor pad", "familial status / sex"],
  ["In a traditional neighborhood", "race / national origin"],
  ["An exclusive community", "race / national origin"],
  ["Full of good people", "race / national origin"],
  ["Walking distance to the church", "religion"],
  ["A Christian community", "religion"],
  ["Handicapped access", "disability"],
  ["Must be able to climb stairs", "disability"],
  ["Not suitable for the elderly", "disability"],
  ["No service animals", "disability"],
  ["Ideal for a woman", "sex"],
  ["Mother-in-law suite downstairs", "sex / familial status"],
  ["Perfect for young professionals", "age"],
  ["Adults only building", "age"],
  ["A safe neighborhood", "steering proxy"],
  ["A desirable part of town", "steering proxy"],
  ["Low-crime area", "steering proxy"],
  ["Great schools nearby", "steering proxy (schools)"],
  ["School ratings are excellent", "steering proxy (schools)"],
];

const TESTIMONIAL_FIXTURES: string[] = [
  "I love this kitchen",
  "My clients always ask for this",
  "In my experience this sells fast",
  "I can get you the best price",
];

describe("lintFairHousing — fh_lint.py parity", () => {
  it("has one fixture per BLOCK rule", () => {
    assert.equal(BLOCK_FIXTURES.length, BLOCK_RULES.length);
    assert.equal(TESTIMONIAL_FIXTURES.length, TESTIMONIAL_RULES.length);
  });

  for (const [phrase, cls] of BLOCK_FIXTURES) {
    it(`blocks: "${phrase}"`, () => {
      const r = lintFairHousing(phrase);
      assert.equal(r.ok, false, `expected BLOCK for "${phrase}"`);
      assert.ok(
        r.violations.some((v) => v.severity === "BLOCK" && v.class === cls),
        `expected class ${cls}, got ${JSON.stringify(r.violations)}`,
      );
    });
  }

  for (const phrase of TESTIMONIAL_FIXTURES) {
    it(`blocks persona testimonial: "${phrase}"`, () => {
      assert.equal(lintFairHousing(phrase).ok, false);
      // …but not when the speaker is the licensee themself.
      assert.equal(lintFairHousing(phrase, { testimonials: false }).ok, true);
    });
  }

  it("is case-insensitive and reports offsets", () => {
    const r = lintFairHousing("Bright living room. FAMILY FRIENDLY block.");
    assert.equal(r.ok, false);
    assert.equal(r.violations[0].offset, 20);
    assert.equal(r.violations[0].match, "FAMILY FRIENDLY");
  });

  it("passes clean property-only copy", () => {
    const r = lintFairHousing(
      "Three-bedroom ranch with a zero-step entry, new roof (2024), quartz counters and a fenced back yard. Lincoln Elementary is 0.4 miles away.",
    );
    assert.equal(r.ok, true);
    assert.equal(r.blocks, 0);
  });

  it("school NAMES are fine, quality adjectives are not", () => {
    assert.equal(lintFairHousing("Blue Valley School District").ok, true);
    assert.equal(lintFairHousing("top-rated school district").ok, false);
  });
});

describe("WARN rewrites", () => {
  it("master bedroom → primary bedroom (case preserved for the noun)", () => {
    const r = lintFairHousing("Huge master bedroom with a master closet");
    assert.equal(r.ok, true);
    assert.equal(r.warns, 2);
    assert.equal(r.violations[0].rewrite, "primary bedroom");
    assert.equal(r.violations[1].rewrite, "primary closet");
    assert.equal(applyRewrites("Huge master bedroom with a master closet"), "Huge primary bedroom with a primary closet");
  });

  it("applies every WARN rule", () => {
    const src = "master bath, walking distance to shops, within walking distance, handyman special, his and hers sinks";
    const out = applyRewrites(src);
    assert.equal(
      out,
      "primary bath, {{DISTANCE_MI}} miles from shops, {{DISTANCE_MI}} miles away, needs renovation, dual sinks",
    );
    assert.equal(WARN_RULES.length, 5);
  });

  it("assertClean throws FairHousingError on BLOCK, rewrites on WARN", () => {
    assert.throws(() => assertClean("great for families", "test"), FairHousingError);
    assert.equal(assertClean("master suite"), "primary suite");
  });
});

describe("lintFields", () => {
  it("lints every typed field and tags the field", () => {
    const r = lintFields({
      dictationRaw: "Sunny kitchen, master bath",
      features: ["fenced yard", "no kids"],
      roomType: "living room",
      style: "modern",
      address: "12 Church St", // never linted
    });
    assert.equal(r.ok, false);
    assert.deepEqual(
      r.violations.map((v) => [v.field, v.severity]),
      [
        ["dictationRaw", "WARN"],
        ["features", "BLOCK"],
      ],
    );
  });
});

describe("lintPrompt — Heartland §11.2.2 blocklist", () => {
  const blocked = [
    "add a lake view",
    "give it an ocean view",
    "with a pool",
    "remove the power lines",
    "erase the neighbor's house",
    "get rid of the highway",
    "add a window on the left wall",
    "open up the floor plan",
    "knock out the wall",
    "vaulted ceilings",
    "make the room bigger",
  ];
  for (const p of blocked) {
    it(`blocks "${p}" in both lanes`, () => {
      assert.equal(lintPrompt(p, "social").ok, false, p);
      assert.equal(lintPrompt(p, "mls").ok, false, p);
    });
  }

  it("twilight is allowed in social (forces label) and blocked in mls", () => {
    const social = lintPrompt("twilight sky, warm lamps", "social");
    assert.equal(social.ok, true);
    assert.equal(social.forcesLabel, true);
    const mls = lintPrompt("twilight sky, warm lamps", "mls");
    assert.equal(mls.ok, false);
  });

  it("passes personal-property staging language", () => {
    const r = lintPrompt("mid-century sofa, walnut coffee table, area rug, two floor plants, framed art", "mls");
    assert.equal(r.ok, true);
    assert.equal(r.forcesLabel, false);
  });
});

describe("endCardSpec — state rule packs", () => {
  const full = {
    agentDisplayName: "Jared Tolley",
    agentPhone: "(816) 555-0100",
    brokerName: "Your KC Homes LLC",
    brokerPhone: "(816) 555-0199",
    licenseNumber: "2019012345",
    licenseState: "MO",
    licenseStatus: "verified",
    narMember: true,
  };

  it("MO: broker ≥ agent/2, adjacent, EHO, REALTOR® only when verified + narMember", () => {
    const s = endCardSpec(full, "MO", "before_after");
    assert.equal(s.ok, true);
    assert.equal(s.rulePack, "MO");
    assert.equal(s.fontPx.agent, 43);
    assert.equal(s.fontPx.broker, 29);
    assert.ok(s.fontPx.agent / s.fontPx.broker <= 2);
    assert.equal(s.adjacent, true);
    assert.equal(s.eho, true);
    assert.equal(s.lines[0].text, "Jared Tolley, REALTOR® · MO Lic #2019012345 · (816) 555-0100");
    assert.equal(s.lines[1].text, "Your KC Homes LLC · (816) 555-0199");
    assert.equal(s.lines[2].text, "Equal Housing Opportunity");
    // Unverified → no REALTOR® mark even with narMember ticked.
    const unv = endCardSpec({ ...full, licenseStatus: "manual_review" }, "MO", "before_after");
    assert.ok(!unv.lines[0].text.includes("REALTOR"));
  });

  it("KS: agent ≤ 2× broker", () => {
    const s = endCardSpec(full, "KS", "beauty_shot");
    assert.equal(s.rulePack, "KS");
    assert.equal(s.maxAgentToBrokerRatio, 2);
    assert.ok(s.fontPx.agent <= 2 * s.fontPx.broker);
  });

  it("PA: equal size; unknown states use the PA (strictest) rule", () => {
    const pa = endCardSpec(full, "PA", "virtual_staging");
    assert.equal(pa.fontPx.agent, pa.fontPx.broker);
    const tx = endCardSpec(full, "TX", "virtual_staging");
    assert.equal(tx.rulePack, "default");
    assert.equal(tx.fontPx.agent, tx.fontPx.broker);
  });

  it("blockers: missing broker name / phone; license only for the mls lane", () => {
    const s = endCardSpec({ agentDisplayName: "J" }, "MO", "before_after");
    assert.equal(s.ok, false);
    assert.deepEqual(
      s.blockers.map((b) => b.code),
      ["no_broker_info", "no_broker_phone"],
    );
    const mls = endCardSpec({ ...full, licenseStatus: "unverified" }, "MO", "virtual_staging", { lane: "mls" });
    assert.deepEqual(
      mls.blockers.map((b) => b.code),
      ["no_license"],
    );
    const social = endCardSpec({ ...full, licenseStatus: "unverified" }, "MO", "virtual_staging", { lane: "social" });
    assert.equal(social.ok, true);
  });

  it("scales with the reference height", () => {
    const s = endCardSpec(full, "MO", "before_after", { refHeightPx: 1080 });
    assert.equal(s.fontPx.agent, 65);
    assert.equal(s.fontPx.broker, 43);
  });
});

describe("frameLabelSpec / mlsSafePlan", () => {
  it("labels are ASCII and required everywhere except the MLS-safe still", () => {
    for (const sku of LISTING_SKU_IDS) {
      for (const lane of ["social", "mls"] as const) {
        const f = frameLabelSpec(sku, lane);
        assert.ok(/^[\x20-\x7e]+$/.test(f.text), `${sku} label must be ASCII: ${f.text}`);
        assert.equal(f.position, "bottom-left");
        if (sku === "virtual_staging" && lane === "mls") assert.equal(f.required, false);
        else assert.equal(f.required, true);
      }
    }
    assert.equal(frameLabelSpec("virtual_staging", "social").captionLine, "Virtually staged");
    assert.equal(frameLabelSpec("before_after", "social").materialChange, true);
  });

  it("material-change / still sets agree with LISTING_SKUS", () => {
    for (const sku of LISTING_SKU_IDS) {
      assert.equal(MATERIAL_CHANGE_SKUS.has(sku as ComplianceSku), LISTING_SKUS[sku].materialChange, sku);
      assert.equal(STILL_SKUS.has(sku as ComplianceSku), LISTING_SKUS[sku].kind === "still", sku);
    }
  });

  it("MLS plan: staging allowed, reveal is social-only, agent tour never", () => {
    const stage = mlsSafePlan({ sku: "virtual_staging", licenseStatus: "verified" });
    assert.equal(stage.allowed, true);
    assert.deepEqual(stage.outputs, ["still", "txt"]);
    assert.equal(stage.photoDescription, "Virtually staged");
    assert.equal(stage.licenseOk, true);

    const reveal = mlsSafePlan({ sku: "before_after" });
    assert.equal(reveal.allowed, false);
    assert.match(reveal.reason ?? "", /not for MLS photo slots/);

    assert.equal(mlsSafePlan({ sku: "agent_tour" }).allowed, false);
    assert.equal(mlsSafePlan({ sku: "exterior_reveal", sourceKind: "streetview" }).allowed, false);
    assert.equal(mlsSafePlan({ sku: "exterior_reveal", sourceKind: "upload" }).allowed, true);
    assert.equal(mlsSafePlan({}).allowed, false);
  });
});
