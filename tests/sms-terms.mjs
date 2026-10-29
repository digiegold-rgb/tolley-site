// Public A2P copy for the Tolley Cleanouts text line. Source checks only — no messages are sent.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const SENTENCE =
  "Mobile information and SMS consent will not be shared with third parties or affiliates for marketing or promotional purposes.";

const privacy = read("app/privacy/page.tsx");
assert.ok(privacy.includes(`<h2 className="text-lg font-semibold text-white/95 sm:text-xl">SMS</h2>`), "privacy page has an SMS heading");
assert.ok(privacy.includes(SENTENCE), "privacy page includes the required SMS sentence");

const terms = read("app/sms-terms/page.tsx");
for (const phrase of [
  "Tolley Cleanouts texts.",
  "appointment confirmations, quotes, job updates.",
  "Message frequency varies.",
  "Msg &amp; data rates may apply.",
  "Reply STOP to opt out, HELP for help.",
  'href="/privacy"',
  'href="/terms"',
]) {
  assert.ok(terms.includes(phrase), `sms-terms missing: ${phrase}`);
}

const form = read("components/cleanouts/quote-form.tsx");
assert.match(form, /const \[smsConsent, setSmsConsent\] = useState\(false\)/);
assert.match(form, /href="\/sms-terms"/);
assert.match(form, /href="\/privacy"/);
const checkbox = form.slice(form.indexOf('id="tc-sms-consent"'), form.indexOf("HeardAbout"));
assert.doesNotMatch(checkbox, /\brequired\b/, "SMS consent checkbox stays optional");

const retired = read("lib/retired-sites.ts");
assert.doesNotMatch(retired, /sms-terms/);
assert.match(read("app/sitemap.ts"), /\/sms-terms/);
assert.match(read("lib/company/route-inventory.json"), /app\/sms-terms\/page\.tsx/);

console.log("sms terms: public copy, optional consent, sitemap, and route classification passed.");
