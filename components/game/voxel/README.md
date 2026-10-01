# Portal Hoppers: Blocky Worlds

The rebuild of Portal Hoppers as a blocky, bright, much harder 3D adventure. It lives at `/game/next` (noindex) until it
replaces `/game`; the current 3D game (`components/game/portal3d`) and the original 2D game (`/game/classic`) are untouched.

## Layout

- `types.ts` — block ids, `PHYS` tuning, entity/door/biome types, `Controls`, `Snapshot`.
- `grid.ts` — `VoxelGrid` (Uint8Array, dirty chunks, DDA raycast, sky flood-fill), `WorldBuilder` and the ASCII/box world DSL
  (`defineWorld`). Rows are z, characters are x; markers (`X` start, `P` portal, `$` coin, `k` key, `C` checkpoint, `s` star,
  `S` switch, `H` hopper) become entities. Doors are registered with `doorBox` + `door({ switchId | needsKeys | boss })`.
- `physics.ts` — axis-separated AABB sweep against the grid plus dynamic bodies (Cubo, pillars, movers), one-block step-up.
- `model.ts` — `VoxelGame`: the whole simulation (movement, Ultra Jump, double jump, stamina glide, bounce/crumble/ice/
  conveyor/spike/goo/water blocks, coins/keys/stars/checkpoints, levers and doors, cages, sparks, Cubo follow/stand/lift,
  sky ceiling, saves, aim ray). No React, no Three.
- `worlds/` — `biomes.ts` (one palette/sky/fog kit per world) and `w01.ts…` authored worlds; `index.ts` registers them.
- `render/` — `Scene.tsx` (fixed 60 Hz substeps, over-the-shoulder camera with wall avoidance, aim ray), `Terrain.tsx`
  (per-chunk InstancedMesh cubes with baked three-tone shading, rebuilt when cells change), `Sky.tsx`, `Actors.tsx`,
  `Entities.tsx`, `Fx.tsx`.
- `input.ts` — keyboard, pointer lock (mouse look + LMB bash + wheel power cycle) with drag fallback, gamepad, touch.
- `audio.ts` + `music.ts` — original Synth effects; `MusicPlayer` streams the looping tracks in `public/game/music/`
  (built by `scripts/game/build-music.py`, local ACE-Step, whisper vocal gate, bar-aligned loops, ogg + m4a) through the
  Synth's music bus with 1.2 s crossfades, falling back to the Sequencer patterns when a track is missing.
- Combat lives in `model.ts` too: `EnemyState` patrols (path back and forth, chase within range, contact damage with
  knockback, bash 1 / stomp 2), `BossState` machines (`sleep → idle → windup → charge → stagger`, armored unless staggered,
  weak point bash 4, stomp 2, Mega Punch 3, batted gear 6), projectiles, `peaceful` test hook, `bossDown` in the save.
- `render/Enemies.tsx` (Bolt-Bot, Forge Foreman, gears) and `render/Props.tsx` (spinning gears, smokestacks with smoke,
  lamps, steam vents, gantry crane) are procedural boxes; heroes/Cubo come from `public/game/models/blocky/` built by
  `scripts/game/build-blocky-models.py` (six clips: Idle, Run, Jump, Bash, Hurt, Cheer).
- `save.ts` — save v3 (`tolley-portal-hoppers-voxel-v3`), sanitized on read; older saves are ignored, never deleted.
- `VoxelShell.tsx` + `voxel.css` — title, HUD (hearts, sparks, keys, stamina), reticle, pause/settings, rescue modal.

## Rules every world must obey (enforced by tests)

- Exactly three keys, two or three checkpoints, every door registered.
- Keys, cages, the boss hall and the portal are sealed from the open sky (doors count as walls): flying never skips a room.
- The `route` waypoints are walkable with real physics and no flight powers (`bot.test.ts`).
- The portal opens only with all keys, all cages and the boss defeated. The boss hall door opens with the keys; the vault
  door opens when the boss falls (`door({ boss: true })`).
- World builder extras: `enemy(type, x, y, z, path)`, `boss(type, x, y, z, arena)`, `prop(type, x, y, z, rot, scale)`,
  `stripe(...)` hazard trims, `pillarsUnder(...)` support columns. Props never collide.

## Verification

```sh
node --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs --test components/game/voxel/*.test.ts
npx eslint components/game/voxel app/game/next tests/voxel-browser.mjs
node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p tsconfig.build.json
PORTAL_TEST_URL=http://localhost:3043 node tests/voxel-browser.mjs   # against a dev server, see below
```

The full site's `next dev` is too slow and unstable for browser tests (chunk timeouts); run an isolated Next app that
symlinks `components/game`, `public/game` and `node_modules` from this checkout (see `/home/jelly/tolley-game-iso`) and
start it with `next dev -p 3043 --webpack`. `?test=1` exposes `window.__voxel = { game, input, audio }` in development only
and defaults graphics to low; nothing is exposed in production.

## Milestones

M0 scaffold → **M1 blocky art + first combat slice + real music (1.56.5, this)** → M2 all ten worlds (kid playtest) →
M3 remaining enemy archetypes, the other nine bosses, Cubo place/bat, followers → M4 music for every world → M5 polish
and swap `/game`. Plan: `~/.claude/plans/tolley-io-game-ok-i-had-wise-zephyr.md`.
