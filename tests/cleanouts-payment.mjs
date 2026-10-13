// Public cleanout payment: lookup is rate-limited, cash only writes a note,
// card reuses or mints a Stripe link and continues at /pay, and amounts are rejected.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const nextServer = require("next/server");

const updates = [];
const stripeCalls = [];
let allow = true;
let stripeError = null;

function freshInvoice() {
  return {
    id: "inv_1",
    invoiceNumber: "INV-0147",
    status: "SENT",
    issueDate: new Date("2026-10-13T15:00:00Z"),
    dueDate: null,
    subTotal: 2000,
    total: 500,
    amountDue: 500,
    amountPaid: 0,
    reference: "CLEANOUT",
    notes: "Terms of Service: https://tolley.io/cleanouts/terms",
    stripePaymentLinkId: null,
    stripePaymentLinkUrl: null,
    contact: { name: "Ada Homeowner", email: "ada@example.com" },
    lineItems: [
      { description: "Cleanout – 12 Oak St – October 13, 2026", quantity: 1, lineAmount: 2000, sortOrder: 0 },
      { description: "Deposit due now (25%)", quantity: 1, lineAmount: 500, sortOrder: 1 },
      { description: "Balance due when the job is complete (not charged on this invoice)", quantity: 1, lineAmount: -2000, sortOrder: 2 },
    ],
  };
}

let stored = freshInvoice();

const stubs = {
  "@/lib/prisma": {
    prisma: {
      invoice: {
        findUnique: async ({ where }) => {
          if (where.invoiceNumber && where.invoiceNumber !== stored.invoiceNumber) return null;
          if (where.id && where.id !== stored.id) return null;
          if (stored.status === "VOID" && where.invoiceNumber) return stored;
          return stored;
        },
        update: async ({ data }) => {
          updates.push({ ...data });
          Object.assign(stored, data);
          return stored;
        },
      },
    },
  },
  "@/lib/rate-limit": {
    consumeRateLimit: async () => ({ allowed: allow, count: allow ? 1 : 13, limit: 12, retryAfterSeconds: 60 }),
    rateLimited: (rl) => nextServer.NextResponse.json(
      { error: "rate limited", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    ),
  },
  "@/lib/account/stripe-payment-link": {
    createInvoicePaymentLink: async (invoice) => {
      stripeCalls.push(invoice);
      if (stripeError) throw stripeError;
      return { paymentLinkId: "plink_1", paymentLinkUrl: "https://pay.stripe.com/test" };
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

const { GET, POST } = load("app/api/cleanouts/payment/route.ts");

function reset() {
  stored = freshInvoice();
  updates.length = 0;
  stripeCalls.length = 0;
  allow = true;
  stripeError = null;
}

function request(method, url, { json, form, headers = {} } = {}) {
  const init = {
    method,
    headers: {
      host: "www.tolley.io",
      origin: "https://www.tolley.io",
      "x-forwarded-for": "203.0.113.20",
      ...headers,
    },
  };
  if (json) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(json);
  }
  if (form) {
    init.headers["content-type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(form);
  }
  return new nextServer.NextRequest(url, init);
}

const lookedUp = await GET(request("GET", "https://www.tolley.io/api/cleanouts/payment?invoice=inv-0147"));
assert.equal(lookedUp.status, 200);
const body = await lookedUp.json();
assert.equal(body.invoice.invoiceNumber, "INV-0147");
assert.equal(body.invoice.amountDue, 500);
assert.equal(body.invoice.contactName, "Ada Homeowner");
assert.equal(body.invoice.lineItems.length, 3);
assert.equal("email" in body.invoice, false);
assert.equal("stripePaymentLinkUrl" in body.invoice, false);
assert.equal("id" in body.invoice, false);
assert.equal(JSON.stringify(body).includes("ada@example.com"), false);

reset();
const missing = await GET(request("GET", "https://www.tolley.io/api/cleanouts/payment?invoice=INV-9999"));
assert.equal(missing.status, 404);
const invalid = await GET(request("GET", "https://www.tolley.io/api/cleanouts/payment?invoice=147"));
assert.equal(invalid.status, 400);

reset();
stored.status = "VOID";
const voided = await GET(request("GET", "https://www.tolley.io/api/cleanouts/payment?invoice=INV-0147"));
assert.equal(voided.status, 404);

reset();
allow = false;
const limited = await GET(request("GET", "https://www.tolley.io/api/cleanouts/payment?invoice=INV-0147"));
assert.equal(limited.status, 429);

reset();
const amount = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "INV-0147", choice: "card", termsAccepted: "yes", amount: 25, total: 999 },
}));
assert.equal(amount.status, 400);
assert.equal(updates.length, 0);
assert.equal(stripeCalls.length, 0);
const amountBody = await amount.json();
assert.match(amountBody.error, /amount/i);

reset();
const noTerms = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "INV-0147", choice: "cash" },
}));
assert.equal(noTerms.status, 400);
assert.equal(updates.length, 0);

reset();
const offsite = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "INV-0147", choice: "cash", termsAccepted: "yes" },
  headers: { origin: "https://evil.example" },
}));
assert.equal(offsite.status, 403);
assert.equal(updates.length, 0);

reset();
const honeypot = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "INV-0147", choice: "cash", termsAccepted: "yes", company: "spam llc" },
}));
assert.equal(honeypot.status, 200);
assert.equal(updates.length, 0);
assert.equal(stripeCalls.length, 0);

reset();
const cash = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "INV-0147", choice: "cash", termsAccepted: true },
}));
assert.equal(cash.status, 200);
assert.deepEqual(await cash.json(), { ok: true, choice: "cash", invoiceNumber: "INV-0147" });
assert.equal(stripeCalls.length, 0);
assert.equal(updates.length, 1);
assert.deepEqual(Object.keys(updates[0]), ["notes"]);
assert.match(stored.notes, /Customer will pay by cash or check/);
assert.match(stored.notes, /No card or bank fee/);
assert.equal(stored.total, 500);
assert.equal(stored.amountDue, 500);
assert.equal(stored.status, "SENT");
const cashAgain = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "INV-0147", choice: "cash", termsAccepted: "yes" },
}));
assert.equal(cashAgain.status, 200);
assert.equal((stored.notes.match(/Customer will pay by cash or check/g) || []).length, 1);

reset();
const card = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "inv-0147", choice: "card", termsAccepted: "yes" },
}));
assert.equal(card.status, 200);
assert.deepEqual(await card.json(), { ok: true, choice: "card", nextUrl: "/pay/INV-0147" });
assert.equal(stripeCalls.length, 1);
assert.equal(stripeCalls[0].total, 500);
assert.equal(stripeCalls[0].invoiceNumber, "INV-0147");
assert.equal(stored.stripePaymentLinkUrl, "https://pay.stripe.com/test");
assert.equal(stored.total, 500);
assert.equal(stored.amountDue, 500);
assert.equal(updates.every((data) => !("total" in data) && !("amountDue" in data) && !("lineItems" in data)), true);
const cardAgain = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "INV-0147", choice: "card", termsAccepted: "yes" },
}));
assert.equal(cardAgain.status, 200);
assert.equal(stripeCalls.length, 1, "an existing Stripe link is reused");

reset();
stored.stripePaymentLinkUrl = "https://pay.stripe.com/existing";
stored.stripePaymentLinkId = "plink_existing";
const existing = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  form: { invoiceNumber: "INV-0147", choice: "card", termsAccepted: "yes" },
}));
assert.equal(existing.status, 303);
assert.equal(new URL(existing.headers.get("location")).pathname, "/pay/INV-0147");
assert.equal(stripeCalls.length, 0);

reset();
stripeError = new Error("stripe down");
const fallback = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "INV-0147", choice: "card", termsAccepted: "yes" },
}));
assert.equal(fallback.status, 200);
assert.equal((await fallback.json()).nextUrl, "/pay/INV-0147");
assert.equal(stored.stripePaymentLinkUrl, null);

reset();
stored.status = "PAID";
stored.amountDue = 0;
const paid = await POST(request("POST", "https://www.tolley.io/api/cleanouts/payment", {
  json: { invoiceNumber: "INV-0147", choice: "card", termsAccepted: "yes" },
}));
assert.equal(paid.status, 409);
assert.equal(stripeCalls.length, 0);
assert.equal(updates.length, 0);

console.log("cleanouts payment: lookup, cash note, Stripe link, and amount rejection passed.");
