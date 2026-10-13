// Cleanout legal copy, deposit math, and the unlisted payment page.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");

function load(file) {
  file = resolve(root, file);
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const localRequire = (name) => {
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(file), name);
      for (const extension of ["", ".ts", ".tsx", ".js"]) {
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

const legal = load("lib/legal-cleanouts.ts");
const source = readFileSync(resolve(root, "lib/legal-cleanouts.ts"), "utf8");

assert.equal(/tolley cleanouts/i.test(source), false);
assert.equal(/trip[ -]?fee/i.test(source), false);
assert.equal(source.includes("[DATE]"), false);
assert.match(source, /October 13, 2026/);
assert.match(source, /jared@yourkchomes\.com/);
assert.match(source, /913-283-3826/);
assert.match(source, /Your KC Homes LLC/);

function texts(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => texts(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => texts(item, out));
  return out;
}

const terms = texts(legal.TERMS_SECTIONS).join("\n");
const privacy = texts(legal.PRIVACY_SECTIONS).join("\n");
assert.match(terms, /25% deposit/);
assert.match(terms, /over \$1,000/);
assert.match(terms, /50% of the sale price/);
assert.match(terms, /30% of the sale price/);
assert.match(terms, /you keep the item/);
assert.match(terms, /negotiable/);
assert.match(terms, /within 30 days/);
assert.doesNotMatch(terms, /trip[ -]?fee/i);
assert.doesNotMatch(privacy, /Tolley Cleanouts/);
assert.match(privacy, /Your KC Homes LLC/);
assert.match(legal.CLEANOUT_INVOICE_NOTE, /https:\/\/tolley\.io\/cleanouts\/terms/);
assert.equal(legal.CLEANOUT_REFERENCE, "CLEANOUT");
assert.equal(
  legal.cleanoutJobDescription("  12 Oak St ", "2026-10-13"),
  "Cleanout – 12 Oak St – October 13, 2026",
);
assert.equal(legal.cleanoutJobDescription("12 Oak St", "2026-10-13").includes("–"), true);

const blank = { description: "", quantity: 1, unitAmount: 0, accountId: "" };
const job = (amount) => [{ description: "Cleanout – 12 Oak St – October 13, 2026", quantity: 1, unitAmount: amount, accountId: "rev" }];
const sum = (lines) => Math.round(lines.reduce((total, line) => total + line.quantity * line.unitAmount, 0) * 100) / 100;

assert.equal(legal.syncCleanoutDepositLines(job(1000), blank).length, 1);
assert.equal(legal.syncCleanoutDepositLines(job(800), blank).length, 1);
const over = legal.syncCleanoutDepositLines(job(2000), blank);
assert.equal(over.length, 3);
assert.equal(over[1].description, "Deposit due now (25%)");
assert.equal(over[1].unitAmount, 500);
assert.equal(over[1].accountId, "rev");
assert.equal(over[2].unitAmount, -2000);
assert.equal(sum(over), 500);
assert.deepEqual(legal.syncCleanoutDepositLines(over, blank), over);

const barely = legal.syncCleanoutDepositLines(job(1000.01), blank);
assert.equal(barely.length, 3);
assert.equal(sum(barely), barely[1].unitAmount);
assert.equal(legal.syncCleanoutDepositLines(job(999.99), blank).length, 1);

const two = legal.syncCleanoutDepositLines([
  { description: "A", quantity: 1, unitAmount: 600, accountId: "" },
  { description: "B", quantity: 2, unitAmount: 300, accountId: "rev" },
], blank);
assert.equal(sum(two.filter((line) => !legal.isCleanoutManagedLine(line.description))), 1200);
assert.equal(two[2].unitAmount, 300);
assert.equal(sum(two), 300);

let notes = legal.withCleanoutPaymentNotes("Job note", "cash", new Date("2026-10-13T18:00:00Z"));
assert.equal(notes.includes(legal.CASH_NOTE_MARKER), true);
assert.equal(notes.includes(legal.TERMS_ACCEPTED_MARKER), true);
assert.equal(notes.startsWith("Job note"), true);
const again = legal.withCleanoutPaymentNotes(notes, "cash", new Date("2026-10-14T18:00:00Z"));
assert.equal(again, notes);
const cardOnly = legal.withCleanoutPaymentNotes(null, "card", new Date("2026-10-13T18:00:00Z"));
assert.equal(cardOnly.includes(legal.CASH_NOTE_MARKER), false);
assert.equal(legal.normalizeInvoiceNumber(" inv-0147 "), "INV-0147");
assert.equal(legal.normalizeInvoiceNumber("147"), null);
assert.equal(legal.normalizeInvoiceNumber("INV-0147;drop"), null);
assert.equal(legal.hasForbiddenAmountKey(["choice", "amount"]), true);
assert.equal(legal.hasForbiddenAmountKey(["invoiceNumber", "termsAccepted"]), false);

const page = readFileSync(resolve(root, "app/cleanouts/page.tsx"), "utf8");
assert.match(page, /href="\/cleanouts\/terms"/);
assert.match(page, /href="\/cleanouts\/privacy"/);
assert.doesNotMatch(page, /\/cleanouts\/payment/);

const paymentPage = readFileSync(resolve(root, "app/cleanouts/payment/page.tsx"), "utf8");
assert.match(paymentPage, /index:\s*false/);
assert.match(paymentPage, /follow:\s*false/);
assert.doesNotMatch(paymentPage, /type="number"/);
assert.doesNotMatch(paymentPage, /name="amount"/);
assert.match(paymentPage, /name="invoice"/);
assert.match(paymentPage, /name="termsAccepted"/);
assert.match(paymentPage, /\/homes\/logo\.svg/);

const sitemap = readFileSync(resolve(root, "app/sitemap.ts"), "utf8");
assert.match(sitemap, /\$\{BASE\}\/cleanouts\/terms/);
assert.match(sitemap, /\$\{BASE\}\/cleanouts\/privacy/);
assert.doesNotMatch(sitemap, /\$\{BASE\}\/cleanouts\/payment/);

const termsPage = readFileSync(resolve(root, "app/cleanouts/terms/page.tsx"), "utf8");
const privacyPage = readFileSync(resolve(root, "app/cleanouts/privacy/page.tsx"), "utf8");
assert.match(termsPage, /CleanoutLegalDocument/);
assert.match(privacyPage, /CleanoutLegalDocument/);

console.log("legal cleanouts: copy, deposit math, and unlisted payment page passed.");
