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
const deliveries = [];
let inTransaction = false;
let rejectEnqueue = false;

const prismaStub = {
  async $transaction(fn) {
    const before = creates.length;
    inTransaction = true;
    try { return await fn(prismaStub); }
    catch (error) { creates.length = before; throw error; }
    finally { inTransaction = false; }
  },
  growthLead: {
    create: async ({ data }) => {
      creates.push(data);
      return { id: `lead_test_${creates.length}`, ...data, createdAt: new Date() };
    },
  },
};

const stubs = {
  "next/server": {
    ...nextServer,
    after: (fn) => Promise.resolve().then(fn),
  },
  "@/lib/prisma": {
    prisma: prismaStub,
  },
  "@/lib/customer-history/store": {
    recordLeadCustomer: async () => {},
  },
  "@/lib/rate-limit": {
    consumeRateLimit: async () => ({ allowed: true, count: 1, limit: 5, retryAfterSeconds: 0 }),
    rateLimited: (rl) => nextServer.NextResponse.json({ error: "rate limited", retryAfterSeconds: rl.retryAfterSeconds }, { status: 429 }),
  },
  "@/lib/lead-notification-outbox": {
    enqueueCleanoutNotification: async (tx, leadId, contact) => {
      assert.equal(tx, prismaStub);
      assert.equal(inTransaction, true, "alert is saved in the lead transaction");
      if (rejectEnqueue) throw new Error("Simulated outbox storage failure");
      alerts.push({ leadId, contact });
    },
    deliverLeadNotifications: async (leadId) => {
      assert.equal(inTransaction, false, "delivery happens only after commit");
      deliveries.push(leadId);
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
assert.deepEqual(await ok.json(), { ok: true, leadId: "lead_test_1" });
assert.equal(creates.length, 1);
assert.equal(creates[0].offer, "cleanout");
assert.equal(creates[0].source, "cleanouts-page");
assert.equal(creates[0].stage, "replied");
assert.equal(creates[0].name, "Ada Homeowner");
assert.equal(creates[0].phone, "816-555-0100");
assert.equal(creates[0].address, "100 Main St, Independence, MO");
assert.equal(creates[0].notes, "Garage full of furniture");
assert.equal(creates[0].attribution.smsConsent.optedIn, false, "omitted consent is stored as not opted in");

const declined = await post({
  name: "No Texts",
  phone: "816-555-0101",
  smsConsent: false,
});
assert.equal(declined.status, 200);
assert.equal(creates[1].attribution.smsConsent.optedIn, false);

const optedIn = await post({
  name: "Yes Texts",
  phone: "816-555-0102",
  smsConsent: true,
});
assert.equal(optedIn.status, 200);
assert.equal(creates[2].attribution.smsConsent.optedIn, true);

await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
assert.equal(alerts.length, 3);
assert.deepEqual(alerts[0], { leadId: "lead_test_1", contact: {
  name: "Ada Homeowner", phone: "816-555-0100", address: "100 Main St, Independence, MO",
} });
assert.deepEqual(deliveries, ["lead_test_1", "lead_test_2", "lead_test_3"]);

rejectEnqueue = true;
await assert.rejects(post({ phone: "816-555-0103" }), /outbox storage failure/);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(creates.length, 3, "failed alert storage rolls the lead transaction back");
assert.equal(deliveries.length, 3, "failed transactions never trigger delivery");

console.log("cleanouts quote: GrowthLead write and Telegram owner alert path passed.");
