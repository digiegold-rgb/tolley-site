// Quote POST reaches the existing GrowthLead write and Telegram owner alert.
// Prisma, the rate limiter, and Telegram are stubbed — no network or database.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const nextServer = require("next/server");

const creates = [];
const alerts = [];

const stubs = {
  "next/server": {
    ...nextServer,
    after: (fn) => Promise.resolve().then(fn),
  },
  "@/lib/prisma": {
    prisma: {
      growthLead: {
        create: async ({ data }) => {
          creates.push(data);
          return { id: "lead_test", ...data };
        },
      },
    },
  },
  "@/lib/rate-limit": {
    consumeRateLimit: async () => ({ allowed: true, count: 1, limit: 5, retryAfterSeconds: 0 }),
    rateLimited: (rl) => nextServer.NextResponse.json({ error: "rate limited", retryAfterSeconds: rl.retryAfterSeconds }, { status: 429 }),
  },
  "@/lib/budget/notify": {
    notifyTelegram: async (message) => {
      alerts.push(message);
      return { ok: true };
    },
  },
};

const cache = new Map();
function load(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const localRequire = (name) => {
    if (name in stubs) return stubs[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(file), name);
      for (const extension of ["", ".ts", ".tsx", ".js", "/index.ts"]) {
        const candidate = base + extension;
        if (existsSync(candidate) && statSync(candidate).isFile()) return load(candidate);
      }
    }
    return require(name);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", source)(
    localRequire,
    mod,
    mod.exports,
    file,
    dirname(file),
  );
  return mod.exports;
}

const { POST } = load("app/api/cleanouts/quote/route.ts");

function post(body) {
  return POST(new nextServer.NextRequest("https://www.tolley.io/api/cleanouts/quote", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  }));
}

const empty = await post({});
assert.equal(empty.status, 400);
assert.equal(creates.length, 0, "empty submissions are not stored");
assert.equal(alerts.length, 0, "empty submissions do not alert");

const ok = await post({
  name: "Ada Homeowner",
  phone: "816-555-0100",
  address: "100 Main St, Independence, MO",
  details: "Garage full of furniture",
});
assert.equal(ok.status, 200);
assert.deepEqual(await ok.json(), { ok: true, leadId: "lead_test" });
assert.equal(creates.length, 1);
assert.equal(creates[0].offer, "cleanout");
assert.equal(creates[0].source, "cleanouts-page");
assert.equal(creates[0].stage, "replied");
assert.equal(creates[0].name, "Ada Homeowner");
assert.equal(creates[0].phone, "816-555-0100");
assert.equal(creates[0].address, "100 Main St, Independence, MO");
assert.equal(creates[0].notes, "Garage full of furniture");

await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
assert.equal(alerts.length, 1);
assert.match(alerts[0], /Cleanout quote request: Ada Homeowner 816-555-0100/);
assert.match(alerts[0], /100 Main St, Independence, MO/);

console.log("cleanouts quote: GrowthLead write and Telegram owner alert path passed.");
