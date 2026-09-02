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

test("changelog 1.24.3 is the current shipped version", () => {
  assert.equal(APP_VERSION, "1.24.3");
  assert.equal(CHANGELOG[0]?.version, "1.24.3");
});

test("script writer uses AI Gateway client, not a bare Anthropic constructor", () => {
  const src = readApp("lib/vater/script-writer-run.ts");
  assert.match(src, /anthropicClient\(/);
  assert.match(src, /anthropicModelId\(/);
  assert.equal(/new Anthropic\s*\(/.test(src), false);
  const write = readApp("app/api/vater/youtube/[id]/write-script/route.ts");
  const talk = readApp("app/api/vater/youtube/[id]/talk-script/route.ts");
  assert.match(write, /viaGateway=\$\{generated\.viaGateway\}/);
  assert.match(talk, /viaGateway=\$\{talked\.viaGateway\}/);
});

test("write-script and talk-script are 300s on the route, not in vercel.json", () => {
  const vercel = JSON.parse(readApp("vercel.json")) as {
    functions: Record<string, { maxDuration?: number }>;
  };
  const capped = [
    "app/api/vater/youtube/[id]/write-script/route.ts",
    "app/api/vater/youtube/[id]/talk-script/route.ts",
  ];
  for (const file of capped) {
    assert.match(readApp(file), /export const maxDuration = 300/, file);
    assert.equal(vercel.functions[file], undefined, file);
  }
  assert.ok(
    Object.keys(vercel.functions).length <= 50,
    `vercel.json functions has ${Object.keys(vercel.functions).length} keys (cap 50)`,
  );
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
