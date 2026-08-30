import test from "node:test";
import assert from "node:assert/strict";
import { ANIMATE_GENERATION_ROUTES, isAnimateGenerationRoute } from "./generation-routes";

test("Force Kill header routes are the generation chrome, not account pages", () => {
  for (const route of [
    "create",
    "progress",
    "library",
    "editor",
    "video-editor",
    "script-review",
    "animation",
    "autopilot",
    "recent",
  ]) {
    assert.equal(isAnimateGenerationRoute(route), true, route);
  }
  assert.equal(ANIMATE_GENERATION_ROUTES.has("queue"), true);
  for (const route of ["pricing", "course", "rules", "team", "api-keys", "listing", "dashboard"]) {
    assert.equal(isAnimateGenerationRoute(route), false, route);
  }
});
