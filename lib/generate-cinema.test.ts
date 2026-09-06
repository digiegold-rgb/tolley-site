import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { DEFAULT_MOTION_NEGATIVE } from "./generate-motion-card.ts";
import { isBlockedStudioRequest } from "./generate-director.ts";
import {
  CINEMA_RECIPE,
  canGenerateCinemaBeat,
  cinemaGenerateClientError,
  cinemaUsdEstimate,
  estimateCinema,
  formatCinemaFalError,
  isFalPartnerOrPolicyError,
  loadEstateProofTemplate,
  nextGeneratableCinemaBeat,
  parseCinemaQueue,
  planCinemaQueue,
} from "./generate-cinema.ts";
import { ESTATE_PROOF_BEATS } from "./generate-cinema-estate.ts";

const FRONT = "https://blob.example/estate-a/front.png";

describe("cinema estate template + queue", () => {
  it("loads proof-estate-01 as 8 sequential beats with VO scaffolds", () => {
    const q = loadEstateProofTemplate({ imageUrls: [FRONT] });
    assert.equal(q.recipe, CINEMA_RECIPE);
    assert.equal(q.beats.length, 8);
    assert.equal(q.beats[0].id, "c01");
    assert.equal(q.beats[7].id, "c08");
    assert.equal(q.beats[0].seconds, 10);
    assert.equal(q.generate_audio, true);
    assert.match(q.beats[0].prompt, /She says exactly/);
    assert.match(q.beats[0].prompt, /@Image1/);
    assert.equal(nextGeneratableCinemaBeat(q)?.id, "c01");
    assert.equal(canGenerateCinemaBeat(q, q.beats[1].id).ok, false);
  });

  it("plans one beat per script line and estimates Seedance spend", () => {
    const q = planCinemaQueue({
      script: "Welcome.\nStep inside.",
      imageUrls: [FRONT],
    });
    assert.equal(q.beats.length, 2);
    assert.match(q.beats[0].prompt, /She says exactly: "Welcome."/);
    const e = estimateCinema(q);
    assert.equal(e.fal_calls, 2);
    assert.equal(e.usd, cinemaUsdEstimate(q.beats[0].seconds + q.beats[1].seconds, "seedance").usd);
    assert.equal(e.needs_confirm, e.usd > 5);
    assert.match(e.note, /Seedance/);
  });

  it("does not scan the default negative for child/minor refuse tokens", () => {
    assert.match(DEFAULT_MOTION_NEGATIVE, /\bchild\b/);
    const q = loadEstateProofTemplate({ imageUrls: [FRONT] });
    assert.equal(isBlockedStudioRequest(q.beats[0].prompt).blocked, false);
    assert.equal(isBlockedStudioRequest(q.beats[0].negative_prompt).blocked, true);
  });

  it("maps partner/face filter errors to the Kling fallback hint", () => {
    assert.equal(isFalPartnerOrPolicyError("HTTP 422 content_policy_violation partner filter"), true);
    assert.match(formatCinemaFalError("HTTP 422 partner face filter"), /Kling 3 Pro/);
    assert.match(cinemaGenerateClientError({}) || "", /Plan beats first|Run remaining/i);
    assert.equal(cinemaGenerateClientError({ child: { id: "x" } }), null);
  });

  it("keeps the checked-in fixture in sync with the estate template", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const raw = JSON.parse(readFileSync(join(root, "docs/fixtures/proof-estate-01-beats.json"), "utf8"));
    assert.equal(raw.beats.length, ESTATE_PROOF_BEATS.length);
    assert.equal(raw.beats[0].id, "c01");
    assert.equal(raw.beats[0].vo, ESTATE_PROOF_BEATS[0].vo);
  });

  it("parses a shotlist JSON import", () => {
    const q = planCinemaQueue({
      shotlist: {
        title: "import",
        beats: [{ id: "x1", seconds: 6, vo: "Hello there.", prompt: "" }],
      },
      imageUrls: [FRONT],
    });
    assert.equal(q.beats.length, 1);
    assert.equal(q.beats[0].seconds, 6);
    assert.match(q.beats[0].prompt, /Hello there/);
    assert.equal(parseCinemaQueue(q).recipe, CINEMA_RECIPE);
  });
});
