import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION, CHANGELOG } from "./changelog";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readApp(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const FORCE_DYNAMIC = /export const dynamic\s*=\s*["']force-dynamic["']/;

test("changelog 1.20 is the current shipped version", () => {
  assert.equal(APP_VERSION, "1.20");
  assert.equal(CHANGELOG[0]?.version, "1.20");
});

test("root layout is not force-dynamic — that hung 1.17 collect-page-data", () => {
  const src = readApp("app/layout.tsx");
  assert.equal(FORCE_DYNAMIC.test(src), false);
  assert.equal(/export const revalidate\s*=\s*0/.test(src), false);
});

test("session/DB trees that hang SSG are marked at the route, not root", () => {
  for (const file of [
    "app/leads/layout.tsx",
    "app/shop/layout.tsx",
    "app/account/layout.tsx",
    "app/estate/layout.tsx",
    "app/pools/layout.tsx",
    "app/client/page.tsx",
    "app/page.tsx",
    "app/food/layout.tsx",
    "app/video/page.tsx",
    "app/video/studio/page.tsx",
    "app/animate/layout.tsx",
    "app/real-estate-agent/page.tsx",
    "app/real-estate-agent/[slug]/page.tsx",
  ]) {
    assert.match(readApp(file), FORCE_DYNAMIC, file);
  }
});

test("Force Kill confirm copy is unchanged", () => {
  const src = readApp("components/animate/screens/create/ForceKillControl.tsx");
  assert.match(
    src,
    /This will kill all current and future steps\. You will need to regenerate from step one\./,
  );
});

test("staticPageGenerationTimeout stays 60 so leftover SSG cannot occupy the slot", () => {
  const src = readApp("next.config.ts");
  assert.match(src, /staticPageGenerationTimeout:\s*60/);
});

test("collect workers stay at 1 so Standard 8GB can finish page-data", () => {
  const src = readApp("next.config.ts");
  assert.match(src, /experimental:\s*\{[\s\S]*cpus:\s*1/);
  assert.match(src, /staticGenerationMaxConcurrency:\s*1/);
  assert.match(src, /typescript:\s*\{\s*ignoreBuildErrors:\s*true\s*\}/);
  assert.equal(/NODE_OPTIONS/.test(src), false);
});
