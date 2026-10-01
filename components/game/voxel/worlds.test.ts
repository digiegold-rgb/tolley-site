import { test } from "node:test";
import assert from "node:assert/strict";
import { WORLDS } from "./worlds";
import { B, isSolid } from "./types";
import { FRIENDS } from "../worlds/friends";

test("every authored world parses with a start, portal, three keys, checkpoints and registered doors", () => {
  for (const w of WORLDS) {
    assert.ok(w.start && w.portal, `world ${w.id} markers`);
    assert.equal(w.entities.filter((e) => e.kind === "key").length, 3, `world ${w.id} keys`);
    const cps = w.entities.filter((e) => e.kind === "checkpoint");
    assert.ok(cps.length >= 2 && cps.length <= 3, `world ${w.id} checkpoints`);
    assert.ok(w.doors.length >= 3, `world ${w.id} doors`);
    for (const d of w.doors) {
      assert.ok(d.cells.length > 0, `world ${w.id} door ${d.id} has cells`);
      for (const c of d.cells) assert.equal(w.grid.get(c.x, c.y, c.z), B.door, `door ${d.id} cell is a door block`);
    }
    for (const e of w.entities) if (e.kind === "cage") assert.ok(FRIENDS.some((f) => f.id === e.friend));
    // The start stands on solid ground below the sky ceiling.
    assert.ok(isSolid(w.grid.get(w.start.x, w.start.y - 1, w.start.z)), `world ${w.id} start has ground`);
    assert.ok(w.start.y < w.ceiling && w.portal.y < w.ceiling);
  }
});

test("keys, cages, the boss hall and the portal are sealed away from the open sky", () => {
  for (const w of WORLDS) {
    const sky = w.grid.floodFromSky(w.ceiling);
    const cell = (p: { x: number; y: number; z: number }) => sky[w.grid.index(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))];
    for (const e of w.entities) {
      if (e.kind === "key" || e.kind === "cage") assert.equal(cell(e.at), 0, `world ${w.id} ${e.kind} ${"id" in e ? e.id : e.friend} is reachable from the sky`);
    }
    assert.equal(cell(w.portal), 0, `world ${w.id} portal is reachable from the sky`);
    assert.equal(cell(w.start), 1, `world ${w.id} start should be outdoors`);
  }
});

test("world 1 route waypoints all sit on or just above solid ground", () => {
  const w = WORLDS[0];
  for (const p of w.route) {
    let top = -1;
    for (let y = Math.floor(p.y) - 1; y >= 0; y--)
      if (w.grid.solidAt(p.x, y, p.z)) {
        top = y;
        break;
      }
    assert.ok(top >= 0, `waypoint ${JSON.stringify(p)} over void`);
    assert.ok(Math.abs(top + 1 - p.y) < 0.01, `waypoint ${JSON.stringify(p)} not at ground level (top ${top})`);
  }
});
