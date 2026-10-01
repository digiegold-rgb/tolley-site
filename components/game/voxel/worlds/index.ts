/** Registry of authored worlds. `worldFor(n)` clamps to what exists so partial builds still run. */
import type { WorldDef } from "../grid";
import { W01 } from "./w01";

export const WORLDS: WorldDef[] = [W01];
export const worldFor = (n: number): WorldDef => WORLDS[Math.max(0, Math.min(WORLDS.length - 1, n - 1))];
export const LAST_WORLD = 10;
