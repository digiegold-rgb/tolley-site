// Tolley Net consult POST reaches the GrowthLead write and Telegram owner alert.
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
    enqueueNetNotification: async (tx, leadId, contact) => {
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

const { POST } = load("app/api/net/quote/route.ts");

function post(body) {
  return POST(new nextServer.NextRequest("https://www.tolley.io/api/net/quote", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  }));
}

const empty = await post({});
assert.equal(empty.status, 400);
assert.equal(creates.length, 0, "empty submissions are not stored");
assert.equal(alerts.length, 0, "empty submissions do not alert");

const badEmail = await post({ email: "not-an-email" });
assert.equal(badEmail.status, 400);
assert.equal(creates.length, 0);

const ok = await post({
  name: "Ada Gamer",
  phone: "816-555-0100",
  email: "ada@example.com",
  city: "Independence",
  problem: "Ping spikes upstairs",
  gaming: "yes",
  devices: "A PC and a console",
  preferredTime: "Saturday morning",
});
assert.equal(ok.status, 200);
assert.deepEqual(await ok.json(), { ok: true, leadId: "lead_test_1" });
assert.equal(creates.length, 1);
assert.equal(creates[0].offer, "net");
assert.equal(creates[0].source, "tolley-net");
assert.equal(creates[0].stage, "replied");
assert.equal(creates[0].name, "Ada Gamer");
assert.equal(creates[0].phone, "816-555-0100");
assert.equal(creates[0].email, "ada@example.com");
assert.equal(creates[0].city, "Independence");
assert.match(creates[0].notes, /Project needs: Ping spikes upstairs/);
assert.match(creates[0].notes, /Gaming: yes/);
assert.equal(creates[0].attribution.offer, "net");
assert.equal(creates[0].attribution.source, "tolley-net");
assert.equal(creates[0].attribution.gaming, true);

const typedEmail = await post({
  name: "Bad Email",
  phone: "816-555-0101",
  email: "not an email",
});
assert.equal(typedEmail.status, 200);
assert.equal(creates[1].email, null);
assert.match(creates[1].notes, /Email as typed: not an email/);

const nameOnly = await post({ name: "Name Only" });
assert.equal(nameOnly.status, 400);
assert.equal(creates.length, 2, "a name without reachable contact is not saved");
const emailOnly = await post({ email: "office@example.com", projectType: "Small business", organization: "Example Office", timeline: "Next month" });
assert.equal(emailOnly.status, 200);
assert.match(creates[2].notes, /Business \/ organization: Example Office/);
assert.match(creates[2].notes, /Project timing: Next month/);
assert.equal(creates[2].email, "office@example.com");
assert.equal(creates[2].offer, "net");
assert.equal(creates[2].source, "tolley-net");
assert.equal(creates[2].phone, null);

await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
assert.equal(alerts.length, 3);
assert.deepEqual(alerts[0], { leadId: "lead_test_1", contact: {
  name: "Ada Gamer", phone: "816-555-0100", email: "ada@example.com", city: "Independence",
} });
assert.deepEqual(deliveries, ["lead_test_1", "lead_test_2", "lead_test_3"]);

rejectEnqueue = true;
await assert.rejects(post({ phone: "816-555-0103" }), /outbox storage failure/);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(creates.length, 3, "failed alert storage rolls the lead transaction back");
assert.equal(deliveries.length, 3, "failed transactions never trigger delivery");

console.log("net quote: GrowthLead write and Telegram owner alert path passed.");
