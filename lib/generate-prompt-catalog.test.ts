import assert from "node:assert/strict";
import { it } from "node:test";
import { defaultJobCard } from "./generate-job-card";
import { LOCATION_CHIPS, HAIR_CHIPS, CAMERA_CHIPS, applyLocation, applyHair, applyCamera, applyCustomPromptChoice, promptChipId } from "./generate-prompt-chips";
it("each searchable catalog has hundreds of unique, labeled prompt choices", () => {
  for (const choices of [LOCATION_CHIPS, HAIR_CHIPS, CAMERA_CHIPS]) {
    assert(choices.length > 350);
    assert.equal(new Set(choices.map(c => c.id)).size, choices.length);
    assert.equal(new Set(choices.map(c => c.label)).size, choices.length);
    assert(choices.every(c => c.id === "clear" || c.line.length > 15));
  }
});
it("catalog combinations and custom entries replace just their own prompt dimension", () => {
  const base = { ...defaultJobCard(null, {}), prompt: "Portrait of an adult. Wardrobe: blue suit." };
  const location = LOCATION_CHIPS.at(-1)!, hair = HAIR_CHIPS.at(-1)!, camera = CAMERA_CHIPS.at(-1)!;
  const picked = applyCamera(applyHair(applyLocation(base, location.id), hair.id), camera.id);
  assert.equal(promptChipId(picked.prompt, "location"), location.id);
  assert.equal(promptChipId(picked.prompt, "hair"), hair.id);
  assert.equal(promptChipId(picked.prompt, "camera"), camera.id);
  const custom = applyCustomPromptChoice(picked, "location", "A quiet library with amber lamps");
  assert.match(custom.prompt, /quiet library/); assert.match(custom.prompt, /Wardrobe: blue suit/);
  assert.equal(promptChipId(custom.prompt, "hair"), hair.id);
  assert.equal(promptChipId(custom.prompt, "camera"), camera.id);
  assert.equal(custom.prompt.includes(location.line), false);
  assert.equal(applyLocation(custom, "clear").prompt.includes("quiet library"), false);
});
