# Portal Hoppers: Whisperwood

Original, family-friendly third-person browser adventure. `/game` and `/game/adventure` mount the 3D experience; `/game/classic` preserves the original engine and its `tolley-portal-hoppers-v1` save.

## Runtime

- `model.ts`: deterministic rules, combat, puzzle progression, authored hints, versioned local saves. `AdventureGame` is a mutable simulation; React only consumes snapshots.
- `Scene.tsx`: original procedural low-poly art, Rapier colliders and pushable stones, fixed 60 Hz character control, collision-aware camera, and actor presentation. No remote models, textures, music, font-based 3D labels, or asset accounts are required. Rapier WASM is bundled through the npm integration.
- `input.ts`: keyboard/mouse, standard-mapped gamepad, and original synthesized sound effects. Input clears on pause or lost focus. Gamepad disconnection pauses play.
- `AdventureShell.tsx`: loading, title, HUD, settings, completion, storage notices, and error recovery. WebGL context loss offers reload or Classic.

React 19 / Fiber 9 use React Three Rapier 2. Keep this compatibility when upgrading. The additional dependency is MIT-licensed; Three.js and the existing React wrappers remain in the site's dependency stack. All game geometry and sound in this directory are authored in code; no Nintendo assets or third-party art were imported.

## Adventure route

Awaken west/east/northwest forest beacons → Hall of Roots (push stone onto plate; earns boomerang) → Wind Gallery (three timed chimes) → Chamber of Light (sun, leaf, moon boomerang sequence) → Echo Court (plate plus stunned/defeated guard plus bell) → Heartwood Guardian (charge/counter, shield reflections, boomerang stun/counter). Five star seeds are optional. R resets loose stones; each room entrance is a checkpoint. Death resets transient encounters while retaining discoveries and solved puzzles.

Adventure and Challenge share the story. Challenge shortens attack telegraphs, counter windows, and the chime timer. No ads, purchases, chat, generated dialogue, online multiplayer, or backend game endpoints were added.

## Verification

```sh
node --import tsx --test components/game/adventure/model.test.ts
npx eslint components/game/adventure app/game
npx tsc --noEmit -p tsconfig.build.json
npm run build
# Start a local development server, then:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3027 npx playwright test tests/e2e/adventure.spec.ts tests/e2e/game.spec.ts
```

Adventure E2E tests refuse remote targets. `?test=1` exposes the simulation/input only in development, allowing deterministic positioning for physical collision tests; no test hooks are installed in production. Rule tests exercise the entire progression chain and all boss phase requirements. Browser tests must separately check real stone pushing and closed/open gate collisions.

Validated on 2026-09-20: seven rule tests, seven adventure browser checks, and three Classic regression checks passed, together with scoped ESLint and TypeScript checks. Browser checks used an isolated Next app containing the game source because the full development site repeatedly refreshed during tests. The full site's standalone `next build --webpack` completed successfully, including all three game routes. The initial local checkout had an unrelated `/stream` link-audit failure. The release is based on current production main, which already resolves that issue.

## Release checks

The 30–60 minute duration and 60 FPS desktop / 30 FPS integrated-graphics figures are design targets, not measured guarantees. Before a production rollout, play the full adventure on the kids' actual computer and test a physical controller. Tune challenge from that playtest. Automated software-rendered Chromium cannot establish hardware frame-rate or gamepad comfort. Test mouse capture, temple camera behavior, recovery after mistakes, and the elevated forest star seed. Check Safari/Firefox separately before claiming those browsers verified.

For rollback, point `app/game/page.tsx` back to the classic `GameShell`; both save namespaces remain intact. No database migration is involved.
