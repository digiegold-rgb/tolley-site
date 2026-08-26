import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.AUTH_SECRET = "test-secret-do-not-ship";

const {
  WS_COOKIE,
  buildWsCookie,
  buildWsToken,
  clearWsCookie,
  parseWsToken,
} = await import("./workspace-token.ts");

const ROOT = "cmroot000000000000000000";
const TAB = "cmtab0000000000000000000";
const OTHER = "cmother00000000000000000";

describe("workspace token", () => {
  it("round-trips for the login that minted it", () => {
    const token = buildWsToken(ROOT, TAB);
    assert.equal(parseWsToken(token, ROOT), TAB);
  });

  it("is inert for any other login (HMAC bound to the root)", () => {
    const token = buildWsToken(ROOT, TAB);
    assert.equal(parseWsToken(token, OTHER), null);
  });

  it("rejects tampering with the tab id", () => {
    const token = buildWsToken(ROOT, TAB);
    const [, sig] = token.split(".");
    assert.equal(parseWsToken(`${OTHER}.${sig}`, ROOT), null);
  });

  it("rejects malformed values", () => {
    assert.equal(parseWsToken("", ROOT), null);
    assert.equal(parseWsToken(null, ROOT), null);
    assert.equal(parseWsToken("just-one-part", ROOT), null);
    assert.equal(parseWsToken("a.b.c", ROOT), null);
    assert.equal(parseWsToken(buildWsToken(ROOT, TAB), null), null);
  });

  it("changes with the secret (rotation revokes every cookie)", () => {
    const token = buildWsToken(ROOT, TAB);
    process.env.AUTH_SECRET = "rotated";
    assert.equal(parseWsToken(token, ROOT), null);
    process.env.AUTH_SECRET = "test-secret-do-not-ship";
  });

  it("cookie shapes are httpOnly, lax, path=/, and clear() zeroes maxAge", () => {
    const set = buildWsCookie(ROOT, TAB);
    assert.equal(set.name, WS_COOKIE);
    assert.equal(set.httpOnly, true);
    assert.equal(set.sameSite, "lax");
    assert.equal(set.path, "/");
    assert.ok(set.maxAge > 0);
    assert.equal(parseWsToken(set.value, ROOT), TAB);
    const cleared = clearWsCookie();
    assert.equal(cleared.name, WS_COOKIE);
    assert.equal(cleared.maxAge, 0);
    assert.equal(cleared.value, "");
  });
});
