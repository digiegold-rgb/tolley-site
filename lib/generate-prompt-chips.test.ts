import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAllowNsfw,
  applyBlockNsfw,
  defaultJobCard,
  hasNsfwWardrobeOverride,
  LADY2_LACY_PINK_PRESET_ID,
  LADY2_LACY_PINK_PROMPT,
} from "./generate-job-card.ts";
import {
  applyCamera,
  applyHair,
  applyLocation,
  CAMERA_CHIPS,
  CAMERA_MARKER_END,
  CAMERA_MARKER_START,
  clearCamera,
  clearHair,
  clearLocation,
  extractPromptChipBlock,
  HAIR_CHIPS,
  HAIR_MARKER_END,
  HAIR_MARKER_START,
  hasPromptChipBlock,
  LOCATION_CHIPS,
  LOCATION_MARKER_END,
  LOCATION_MARKER_START,
  promptChipId,
  stripPromptChipBlock,
} from "./generate-prompt-chips.ts";

const IDENTITY_LOCK = /same adult woman as the three grey-shirt/i;
const IDENTITY_KEEP = /Keep her exact face, bone structure, skin, hair, and age/;

function lady2Card() {
  return defaultJobCard(LADY2_LACY_PINK_PRESET_ID, {});
}

function chipLine(chips: { id: string; line: string }[], id: string): string {
  const hit = chips.find((c) => c.id === id);
  assert.ok(hit?.line, `missing chip ${id}`);
  return hit.line;
}

describe("Location / Hair / Camera prompt chips", () => {
  it("injects a marked Location block once and replaces instead of stacking", () => {
    const base = lady2Card();
    const bedroom = applyLocation(base, "bedroom-daylight");
    const bedroomAgain = applyLocation(bedroom, "bedroom-daylight");
    assert.deepEqual(bedroomAgain, bedroom);
    assert.equal(hasPromptChipBlock(bedroom.prompt, "location"), true);
    assert.equal(promptChipId(bedroom.prompt, "location"), "bedroom-daylight");
    assert.equal(bedroom.prompt.includes(LOCATION_MARKER_START), true);
    assert.equal(bedroom.prompt.includes(LOCATION_MARKER_END), true);
    assert.match(bedroom.prompt, /soft daylight bedroom/i);
    assert.match(bedroom.prompt, /sheer curtains/i);
    assert.equal(extractPromptChipBlock(bedroom.prompt, "location"), chipLine(LOCATION_CHIPS, "bedroom-daylight"));
    assert.equal(bedroom.prompt.indexOf(LOCATION_MARKER_START), bedroom.prompt.lastIndexOf(LOCATION_MARKER_START));
    assert.match(bedroom.prompt, IDENTITY_LOCK);
    assert.match(bedroom.prompt, IDENTITY_KEEP);
    assert.match(bedroom.prompt, /lacy pink/i);

    const hotel = applyLocation(bedroom, "luxury-hotel");
    assert.equal(promptChipId(hotel.prompt, "location"), "luxury-hotel");
    assert.match(hotel.prompt, /luxury hotel room/i);
    assert.doesNotMatch(hotel.prompt, /sheer curtains/i);
    assert.equal(hotel.prompt.indexOf(LOCATION_MARKER_START), hotel.prompt.lastIndexOf(LOCATION_MARKER_START));
  });

  it("Clear removes the Location block and leaves identity / wardrobe / camera", () => {
    const base = lady2Card();
    const applied = applyLocation(base, "golden-hour-outdoor");
    const cleared = applyLocation(applied, "clear");
    const clearedAgain = clearLocation(cleared);
    assert.deepEqual(clearedAgain, cleared);
    assert.equal(hasPromptChipBlock(cleared.prompt, "location"), false);
    assert.equal(promptChipId(cleared.prompt, "location"), "clear");
    assert.equal(cleared.prompt, base.prompt);
    assert.doesNotMatch(cleared.prompt, /\[\[location\]\]/);
    assert.match(cleared.prompt, /Camera: vertical 9:16 portrait/);
    assert.match(cleared.prompt, IDENTITY_LOCK);
  });

  it("Hair chips override style without touching the identity-keep sentence", () => {
    const base = lady2Card();
    const waves = applyHair(base, "soft-waves");
    assert.equal(promptChipId(waves.prompt, "hair"), "soft-waves");
    assert.equal(extractPromptChipBlock(waves.prompt, "hair"), chipLine(HAIR_CHIPS, "soft-waves"));
    assert.match(waves.prompt, /long hair down past shoulders/i);
    assert.match(waves.prompt, IDENTITY_KEEP);
    assert.equal(waves.prompt.includes(HAIR_MARKER_START), true);
    assert.equal(waves.prompt.includes(HAIR_MARKER_END), true);

    const pony = applyHair(waves, "high-ponytail");
    assert.equal(promptChipId(pony.prompt, "hair"), "high-ponytail");
    assert.match(pony.prompt, /high ponytail/i);
    assert.doesNotMatch(pony.prompt, /soft waves/i);
    assert.match(pony.prompt, IDENTITY_KEEP);
    assert.equal(pony.prompt.indexOf(HAIR_MARKER_START), pony.prompt.lastIndexOf(HAIR_MARKER_START));

    const cleared = applyHair(pony, "clear");
    assert.equal(cleared.prompt, base.prompt);
    assert.equal(hasPromptChipBlock(cleared.prompt, "hair"), false);
    assert.deepEqual(clearHair(cleared), cleared);
  });

  it("Camera replaces the preset Camera: line and Clear restores it", () => {
    const base = lady2Card();
    assert.match(base.prompt, /Camera: vertical 9:16 portrait, 85mm, eye-level/);
    assert.equal(promptChipId(base.prompt, "camera"), "clear");

    const low = applyCamera(base, "low-angle-35");
    const lowAgain = applyCamera(low, "low-angle-35");
    assert.deepEqual(lowAgain, low);
    assert.equal(promptChipId(low.prompt, "camera"), "low-angle-35");
    assert.equal(extractPromptChipBlock(low.prompt, "camera"), chipLine(CAMERA_CHIPS, "low-angle-35"));
    assert.match(low.prompt, /low angle, 35mm, looking up slightly/i);
    assert.doesNotMatch(low.prompt, /Camera: vertical 9:16 portrait, 85mm, eye-level/);
    assert.equal(low.prompt.includes(CAMERA_MARKER_START), true);
    assert.equal(low.prompt.includes(CAMERA_MARKER_END), true);
    assert.match(low.prompt, IDENTITY_LOCK);
    assert.match(low.prompt, /Lighting: soft studio key/);

    const wide = applyCamera(low, "full-body");
    assert.equal(promptChipId(wide.prompt, "camera"), "full-body");
    assert.match(wide.prompt, /full-body, wider 35mm/i);
    assert.doesNotMatch(wide.prompt, /looking up slightly/i);
    assert.equal(wide.prompt.indexOf(CAMERA_MARKER_START), wide.prompt.lastIndexOf(CAMERA_MARKER_START));

    const cleared = applyCamera(wide, "clear");
    assert.equal(promptChipId(cleared.prompt, "camera"), "clear");
    assert.equal(hasPromptChipBlock(cleared.prompt, "camera"), false);
    assert.match(cleared.prompt, /Camera: vertical 9:16 portrait, 85mm, eye-level, shallow depth of field\./);
    assert.equal(cleared.prompt, base.prompt);
    assert.deepEqual(clearCamera(cleared), cleared);
  });

  it("Clear on a prompt with no Camera: line just drops the marker", () => {
    const custom = { prompt: "Photoreal adult woman, red dress, same face.", preset: null };
    const applied = applyCamera(custom, "close-up");
    assert.match(applied.prompt, /close-up face and shoulders/i);
    const cleared = applyCamera(applied, "clear");
    assert.equal(cleared.prompt, custom.prompt);
    assert.equal(hasPromptChipBlock(cleared.prompt, "camera"), false);
  });

  it("unknown / empty chip ids behave as Clear", () => {
    const base = lady2Card();
    const applied = applyLocation(base, "beach-coastal");
    assert.equal(applyLocation(applied, "not-a-chip").prompt, base.prompt);
    assert.equal(applyHair(applied, "").prompt, applied.prompt);
  });

  it("strips orphan markers and does not invent Extra-image wiring", () => {
    const orphan = `Lady2 front.\n[[location]]\nLocation: leftover without end.`;
    assert.equal(stripPromptChipBlock(orphan, "location"), "Lady2 front.");
    const card = applyLocation({ prompt: orphan, preset: null }, "soft-studio");
    assert.equal(hasPromptChipBlock(card.prompt, "location"), true);
    assert.doesNotMatch(card.prompt, /extra_image|wardrobe keep-still|Extra #/i);
    assert.equal(Object.hasOwn(card, "extra_image_urls"), false);
  });

  it("dimensions stay independent and NSFW chips still invert", () => {
    const base = lady2Card();
    const located = applyLocation(base, "city-street-night");
    const haired = applyHair(located, "wet-look");
    const framed = applyCamera(haired, "three-quarter");
    assert.equal(promptChipId(framed.prompt, "location"), "city-street-night");
    assert.equal(promptChipId(framed.prompt, "hair"), "wet-look");
    assert.equal(promptChipId(framed.prompt, "camera"), "three-quarter");
    assert.match(framed.prompt, IDENTITY_LOCK);
    assert.match(framed.prompt, /lacy pink/i);

    const allowed = applyAllowNsfw(framed);
    assert.equal(hasNsfwWardrobeOverride(allowed.prompt), true);
    assert.equal(promptChipId(allowed.prompt, "location"), "city-street-night");
    assert.equal(promptChipId(allowed.prompt, "hair"), "wet-look");
    assert.equal(promptChipId(allowed.prompt, "camera"), "three-quarter");
    assert.match(allowed.prompt, /grey shirt/i);

    const blocked = applyBlockNsfw(allowed);
    assert.equal(hasNsfwWardrobeOverride(blocked.prompt), false);
    assert.equal(promptChipId(blocked.prompt, "location"), "city-street-night");
    assert.match(blocked.negative_prompt, /nsfw/);

    const locationCleared = applyLocation(blocked, "clear");
    assert.equal(promptChipId(locationCleared.prompt, "location"), "clear");
    assert.equal(promptChipId(locationCleared.prompt, "hair"), "wet-look");
    assert.equal(promptChipId(locationCleared.prompt, "camera"), "three-quarter");
  });

  it("leaves the default Lady2 preset prompt unchanged until a chip is clicked", () => {
    const card = lady2Card();
    assert.equal(card.prompt, LADY2_LACY_PINK_PROMPT);
    assert.equal(promptChipId(card.prompt, "location"), "clear");
    assert.equal(promptChipId(card.prompt, "hair"), "clear");
    assert.equal(promptChipId(card.prompt, "camera"), "clear");
  });

  it("treats a custom edited marker as no curated chip (not Clear)", () => {
    const prompt = `${LADY2_LACY_PINK_PROMPT}\n\n[[location]]\nLocation: Jared's warehouse loft, sodium practicals.\n[[/location]]`;
    assert.equal(promptChipId(prompt, "location"), "");
    assert.equal(hasPromptChipBlock(prompt, "location"), true);
  });
});
