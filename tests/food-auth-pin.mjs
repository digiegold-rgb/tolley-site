// Isolated kitchen PIN vs MFA fixtures. No network, no PIN/secrets from env.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

let session = null;
let cookie = null;
let household = null;
let jwt = null;
const stubs = {
  "@/auth": { auth: async () => session },
  "@/lib/admin-auth": { isAdminEmail: (email) => email === "owner@example.invalid" },
  "next-auth/jwt": { getToken: async () => jwt },
  "next/headers": {
    cookies: async () => ({ get: () => cookie }),
    headers: async () => new Headers({ "x-tolley-pathname": "/food" }),
  },
  "next/navigation": {
    redirect: (path) => {
      throw new Error("REDIRECT:" + path);
    },
    notFound: () => {
      throw new Error("NOT_FOUND");
    },
  },
  "next/font/google": { Fredoka: () => ({ variable: "--font-fredoka" }) },
  "@/lib/prisma": {
    prisma: {
      foodHousehold: {
        findUnique: async ({ where }) =>
          household && where?.userId === household.userId ? household : null,
      },
    },
  },
  "@/components/animate/StudioLoader": () => null,
  "@/components/animate/landing/AnimateLanding": () => "LANDING",
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
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name in stubs) return stubs[name];
      if (name.startsWith("@/")) {
        for (const ext of [".ts", ".tsx"]) {
          if (existsSync(resolve(root, name.slice(2) + ext))) return load(name.slice(2) + ext);
        }
      }
      if (name === "react/jsx-runtime") return require("react/jsx-runtime");
      return require(name);
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}

process.env.AUTH_SECRET = "fixture-only";
process.env.SHOP_ADMIN_PIN = "fixture-only";
process.env.FOOD_FAMILY_USER_ID = "family-owner";
process.env.FOOD_ADMIN_EMAILS = "owner@example.invalid";

const { getExpectedToken } = load("lib/shop-auth.ts");
const {
  resolveFoodAccess,
  getFoodApiUserId,
  getFoodHousehold,
  requireFoodAccess,
  isFoodPinGateExempt,
} = load("lib/food/auth.ts");

const pinCookie = { value: getExpectedToken() };
const owner = { user: { id: "owner", email: "owner@example.invalid" }, mfaRequired: false };
const saas = { user: { id: "saas-user", email: "saas@example.invalid" } };
const familyHousehold = {
  id: "hh-family",
  userId: "family-owner",
  name: "Ruthann's Kitchen",
  subscriptionStatus: "none",
  members: [],
};
const saasHousehold = {
  id: "hh-saas",
  userId: "saas-user",
  name: "SaaS Kitchen",
  subscriptionStatus: "active",
  members: [],
};

// PIN cookie unlocks with mfaRequired (session.user wiped, same as auth.ts).
cookie = pinCookie;
session = { mfaRequired: "verify" };
household = familyHousehold;
assert.deepEqual(await resolveFoodAccess(), {
  ok: true,
  via: "pin",
  userId: "family-owner",
});
assert.equal(await getFoodApiUserId(), "family-owner");
assert.equal((await getFoodHousehold())?.id, "hh-family");
const pinAccess = await requireFoodAccess({ callbackUrl: "/food/compare" });
assert.equal(pinAccess.via, "pin");
assert.equal(pinAccess.userId, "family-owner");

// PIN cookie alone (no NextAuth session) is enough.
session = null;
assert.equal((await resolveFoodAccess()).via, "pin");
assert.equal(await getFoodApiUserId(), "family-owner");

// Missing cookie + pending MFA still gates kitchen (no email exemption).
cookie = null;
session = { mfaRequired: "verify" };
assert.deepEqual(await resolveFoodAccess(), { ok: false, via: null, userId: null });
assert.equal(await getFoodApiUserId(), null);
await assert.rejects(
  () => requireFoodAccess({ callbackUrl: "/food" }),
  /REDIRECT:\/food$/,
  "mfaRequired without PIN must not bounce to /login/mfa-challenge",
);

// Anonymous without cookie is denied.
session = null;
assert.equal((await resolveFoodAccess()).ok, false);

// Completed SaaS session still unlocks without the family PIN.
cookie = null;
session = saas;
household = saasHousehold;
assert.deepEqual(await resolveFoodAccess(), {
  ok: true,
  via: "session",
  userId: "saas-user",
});
const saasAccess = await requireFoodAccess();
assert.equal(saasAccess.via, "session");
assert.equal(saasAccess.userId, "saas-user");

// SaaS session without a subscription still hits billing — PIN does not.
household = { ...saasHousehold, subscriptionStatus: "none" };
await assert.rejects(() => requireFoodAccess(), /REDIRECT:\/food\/billing$/);
cookie = pinCookie;
session = { mfaRequired: "verify" };
household = familyHousehold;
const familyNoSub = await requireFoodAccess();
assert.equal(familyNoSub.via, "pin", "PIN skips the SaaS paywall");

// PIN without FOOD_FAMILY_USER_ID: pending JWT sub maps the household.
// JWT sub without a PIN must not unlock (that would be an MFA exemption).
cookie = pinCookie;
session = { mfaRequired: true };
jwt = { sub: "pending-owner" };
const prevFamily = process.env.FOOD_FAMILY_USER_ID;
delete process.env.FOOD_FAMILY_USER_ID;
household = { ...familyHousehold, userId: "pending-owner" };
assert.deepEqual(await resolveFoodAccess(), {
  ok: true,
  via: "pin",
  userId: "pending-owner",
});
cookie = null;
assert.deepEqual(
  await resolveFoodAccess(),
  { ok: false, via: null, userId: null },
  "pending JWT without PIN must not unlock /food",
);
cookie = pinCookie;
jwt = null;
assert.deepEqual(await resolveFoodAccess(), { ok: true, via: "pin", userId: null });
assert.equal(await getFoodApiUserId(), null);
await assert.rejects(() => requireFoodAccess(), /REDIRECT:\/food\/settings$/);
process.env.FOOD_FAMILY_USER_ID = prevFamily;
household = familyHousehold;

// Admin / business stay off the family PIN gate.
assert.equal(isFoodPinGateExempt("/food"), false);
assert.equal(isFoodPinGateExempt("/food/recipes"), false);
assert.equal(isFoodPinGateExempt("/food/admin"), true);
assert.equal(isFoodPinGateExempt("/food/business"), true);

// MFA still required on owner tools and /food/admin — PIN does not unlock them.
const { requireOwnerTool } = load("lib/leads/owner-tool-auth.ts");
session = { mfaRequired: "verify" };
cookie = pinCookie;
await assert.rejects(
  () => requireOwnerTool("/leads"),
  /REDIRECT:\/login\/mfa-challenge/,
  "leads owner tools still require MFA",
);

const Animate = load("app/animate/page.tsx").default;
session = { mfaRequired: true };
await assert.rejects(
  () => Animate({ searchParams: Promise.resolve({}) }),
  /REDIRECT:\/login\/mfa-challenge/,
  "animate studio still requires MFA",
);

const FoodAdmin = load("app/food/admin/page.tsx").default;
session = { mfaRequired: "verify" };
await assert.rejects(
  () => FoodAdmin(),
  /REDIRECT:\/login\/mfa-challenge\?callbackUrl=\/food\/admin/,
  "/food/admin funnel dashboard still requires MFA",
);

const { GET: getHousehold } = load("app/api/food/household/route.ts");
cookie = null;
session = { mfaRequired: "verify" };
assert.equal((await getHousehold()).status, 401, "food API still gates without PIN");
cookie = pinCookie;
household = familyHousehold;
session = { mfaRequired: "verify" };
const unlocked = await getHousehold();
assert.equal(unlocked.status, 200, "food API unlocks with PIN + mfaRequired session");
assert.equal((await unlocked.json()).household.id, "hh-family");

console.log("food-auth PIN cookie vs MFA: passed");
