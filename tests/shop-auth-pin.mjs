// Isolated validateShopAdmin fixtures. No network, no PIN/secrets from env.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

let session = null;
let cookie = null;
const stubs = {
  "@/auth": { auth: async () => session },
  "@/lib/admin-auth": { isAdminEmail: (email) => email === "owner@example.invalid" },
  "next/headers": { cookies: async () => ({ get: () => cookie }) },
};

const cache = new Map();
function load(relative) {
  const file = resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", code)((name) => {
    if (name in stubs) return stubs[name];
    if (name.startsWith("@/")) {
      for (const ext of [".ts", ".tsx"]) {
        if (existsSync(resolve(root, name.slice(2) + ext))) return load(name.slice(2) + ext);
      }
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

const { validateShopAdmin, getExpectedToken, verifyPin } = load("lib/shop-auth.ts");
process.env.AUTH_SECRET = "fixture-only";
process.env.SHOP_ADMIN_PIN = "fixture-only";

const owner = { user: { id: "owner", email: "owner@example.invalid" }, mfaRequired: false };
const customer = { user: { id: "customer", email: "customer@example.invalid" } };
const pinCookie = { value: getExpectedToken() };

session = owner;
cookie = null;
assert.equal(await validateShopAdmin(), true, "allowlist session with completed MFA, no cookie");

cookie = pinCookie;
session = { ...owner, mfaRequired: true };
assert.equal(await validateShopAdmin(), true, "valid PIN cookie unlocks with mfaRequired session");

session = { ...owner, impersonatedBy: "support" };
assert.equal(await validateShopAdmin(), true, "valid PIN cookie unlocks while impersonating");

session = null;
assert.equal(await validateShopAdmin(), true, "PIN cookie alone is enough");

cookie = null;
session = { ...owner, mfaRequired: true };
assert.equal(await validateShopAdmin(), false, "MFA still blocks session-based admin access");

session = { ...owner, impersonatedBy: "support" };
assert.equal(await validateShopAdmin(), false, "impersonation still blocks session-based admin access");

session = customer;
assert.equal(await validateShopAdmin(), false, "non-admin session without cookie is denied");

session = null;
assert.equal(await validateShopAdmin(), false, "anonymous without cookie is denied");

assert.equal(verifyPin("fixture-only"), true);
assert.equal(verifyPin("wrong"), false);

console.log("shop-auth PIN cookie vs MFA: passed");
