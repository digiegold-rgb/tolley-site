import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { signMfaProof, verifyMfaProof } from "./mfa-proof";

process.env.AUTH_SECRET = "mfa-monthly-test-only";
const issued = Date.UTC(2026, 8, 17);
const day = 24 * 60 * 60 * 1000;
const proof = signMfaProof("user", "session", "enrollment", issued);
const valid = (value: string, now: number) => verifyMfaProof(value, "user", "session", "enrollment", now);

test("verification survives daily visits and expires exactly 30 days after code entry", () => {
  for (const offset of [0, 13 * 3600000, day, 29 * day, 30 * day - 1000]) {
    assert(valid(proof, issued + offset));
  }
  assert(!valid(proof, issued + 30 * day));
  assert(!valid(proof, issued + 31 * day));
});

test("verification stays bound to the account, login session and authenticator", () => {
  assert(!verifyMfaProof(proof, "another-user", "session", "enrollment", issued));
  assert(!verifyMfaProof(proof, "user", "another-session", "enrollment", issued));
  assert(!verifyMfaProof(proof, "user", "session", "another-enrollment", issued));
  assert(!valid(proof + "x", issued));
  assert(!valid(proof + ".extra", issued));
});

test("existing 12-hour proofs keep their original expiry during rollout", () => {
  const payload = Buffer.from(JSON.stringify({ userId: "user", sessionId: "session",
    enrollment: "enrollment", exp: issued / 1000 + 12 * 3600 })).toString("base64url");
  const legacy = `${payload}.${createHmac("sha256", process.env.AUTH_SECRET!).update(`mfa:${payload}`).digest("base64url")}`;
  assert(valid(legacy, issued + 11 * 3600000));
  assert(!valid(legacy, issued + 12 * 3600000));
});
