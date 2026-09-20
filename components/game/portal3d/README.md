# Portal Hoppers 3D

This is the 3D adaptation of Portal Hoppers, replacing the unrelated Whisperwood game at `/game` and `/game/adventure`. The original 2D game and its save remain at `/game/classic`.

## What carries over

`worlds.ts` directly imports the original `worlds/levels.ts`: all ten world names, music assignments, rescue order and fifteen friends. Original introductions and Cubo dialogue are adapted where the 3D controls and terrain differ. It uses `worlds/friends.ts` for the heroes, dialogue, powers and friend identities. `audio.ts` plays the actual original `Synth` and `Sequencer` compositions and effects. The new 3D simulation translates jumping, Ultra Jump, bashing cages three times, stomping enemies, three-hit portal orbs, checkpoints, Cubo boosts, and the Power Wheel into free movement on X/Z with vertical jumping. Three bosses retain their original identities. Levels are newly arranged 3D adaptations, not exact tile-map extrusions.

## Original art pipeline

`scripts/game/build-models.py` is the editable Blender source. Run `blender -b --python scripts/game/build-models.py` (tested with Blender 4.0.2). It authors all meshes and materials, binds each hero to a skeleton, animates Idle/Run/Jump/Bash clips, and exports the GLBs in `public/game/models/`. Scenery is joined by material to reduce draw calls. There are no downloaded character models, paid generation services, or external asset URLs. All three heroes are real skinned meshes; Cubo deliberately preserves the original cube identity with rounded edges.

The renderer uses Three.js / React Three Fiber, `GLTFLoader` through drei, and cloned skeletons with animation mixers. The 3D platforming simulation uses shared data with unit-tested top-surface/rounded-footprint collisions. It does not need a remote service or physics WASM.

## Controls and sound

WASD/arrows move relative to the camera; Space jumps (stand still, hold and release to Ultra Jump); X bashes; E uses a portal/pipe or Cubo boost; Shift boosts; C uses an earned power; Q cycles powers; drag the world to orbit; F centers; Escape pauses. Standard controllers use left/right sticks, A jump, X bash, Y interact, B power, LB cycle, RB boost, Start pause. Touch uses a joystick, action buttons, drag camera, and a tappable Power Wheel.

Music starts on a user gesture, as browsers require. Every world uses its original track. Music and effects have independent volume controls, plus mute. Losing focus pauses and saves. Storage errors are surfaced without stopping play.

## Saves and compatibility

The versioned save key is `tolley-portal-hoppers-3d-v2`; no original or Whisperwood progress is overwritten or misinterpreted. Saved fields are validated and bounded. Hero, rescued powers, unlocked worlds, coins, secret stars, checkpoint, difficulty and audio mix persist. Saved worlds can be revisited from the title screen. The original game's two-player mode remains in Classic; the 3D adaptation currently has an AI Cubo companion.

## Verification

- `node --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs --test components/game/portal3d/model.test.ts`
- `PORTAL_TEST_URL=http://127.0.0.1:3037 node tests/portal-3d-browser.mjs`
- TypeScript and scoped ESLint.

The unit suite checks original data continuity, genuine skeleton/animation exports, corrupt saves, rescue/power progression, checkpoints, moving-platform carry, boss hit windows, all-world completion, and actual physics reachability for every main island and rescue branch (without teleporting between them). Browser tests use real keyboard and touch input, WebGL, AudioContext, saving/reloading, and all ten rendered worlds. Opt-in `?test=1` hooks are excluded from production.
