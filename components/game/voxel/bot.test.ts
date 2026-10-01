/** A scripted player walks every world's `route` with the real simulation — no teleporting, no flight powers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { VoxelGame, emptyControls, newSave } from "./model";
import { WORLDS } from "./worlds";
import { dist2, type Vec3 } from "./types";

/** Highest solid cell at or below the hero's feet in a column (ignores roofs overhead). */
const groundBelow = (g: VoxelGame, x: number, y: number, z: number) => {
  for (let cy = Math.floor(y + 0.5); cy >= 0; cy--) if (g.grid.solidAt(x, cy, z)) return cy;
  return -1;
};

export function walkRoute(g: VoxelGame, route: Vec3[], log: string[] = []) {
  for (const target of route) {
    let arrived = false;
    let frames = 0;
    let stuck = 0;
    let last = { ...g.position };
    while (frames++ < 60 * 12) {
      const dx = target.x - g.position.x,
        dz = target.z - g.position.z,
        d = Math.hypot(dx, dz);
      if (d < 0.45 && Math.abs(target.y - g.position.y) < 0.6 && g.grounded) {
        arrived = true;
        g.tick(1 / 60, { ...emptyControls(), interact: true }); // pull a lever if we stopped at one
        if (g.paused) g.resume();
        break;
      }
      const ux = d > 0.01 ? dx / d : 0,
        uz = d > 0.01 ? dz / d : 0;
      const aheadTop = groundBelow(g, g.position.x + ux * 0.75, g.position.y, g.position.z + uz * 0.75);
      const gapAhead = aheadTop + 1 < g.position.y - 0.5;
      const higher = target.y > g.position.y + 0.3;
      const jump = g.grounded && d > 0.6 && ((gapAhead && target.y >= g.position.y - 0.5) || (higher && d < 4.6));
      g.tick(1 / 60, { ...emptyControls(), x: d > 0.2 ? ux : 0, z: d > 0.2 ? uz : 0, jump, interact: frames % 30 === 0 });
      if (g.paused) g.resume();
      if (frames % 60 === 0) {
        stuck = dist2(last, g.position) < 0.2 ? stuck + 1 : 0;
        last = { ...g.position };
        if (stuck >= 3) break;
      }
    }
    log.push(`${arrived ? "ok " : "MISS"} ${JSON.stringify(target)} at ${JSON.stringify({ x: +g.position.x.toFixed(2), y: +g.position.y.toFixed(2), z: +g.position.z.toFixed(2) })}`);
    assert.ok(arrived, `world ${g.def.id}: never reached ${JSON.stringify(target)}\n${log.slice(-6).join("\n")}`);
  }
}

test("a bot with no flight powers clears every authored world along its route", () => {
  for (const w of WORLDS) {
    const save = newSave();
    save.world = w.id;
    const g = new VoxelGame(save);
    g.start();
    const log: string[] = [];
    walkRoute(g, w.route, log);
    assert.equal(g.keys.length, 3, `world ${w.id} keys: ${log.join("\n")}`);
    for (const c of g.cages) {
      g.position = { ...c.at, x: c.at.x - 1 };
      for (let i = 0; i < c.max; i++) {
        g.attackCooldown = 0;
        g.bash();
      }
      g.resume();
    }
    assert.equal(g.portalOpen, true, `world ${w.id} portal`);
    g.position = { ...w.portal };
    assert.equal(g.nextWorld(), true);
  }
});
