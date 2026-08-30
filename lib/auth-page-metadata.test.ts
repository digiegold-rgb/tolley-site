import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authPageMetadata } from "./auth-page-metadata";

describe("authPageMetadata", () => {
  it("brands the Animate funnel as Jelly Studio · Tolley.io", () => {
    const signup = authPageMetadata("/animate", "signup");
    const login = authPageMetadata("/animate", "login");
    assert.equal(signup.title, "Create account | Jelly Studio · Tolley.io");
    assert.equal(login.title, "Sign in | Jelly Studio · Tolley.io");
    assert.equal(String(signup.title).includes("t-agent"), false);
  });

  it("never inherits the root t-agent title", () => {
    const bare = authPageMetadata("/leads/dashboard", "signup");
    assert.equal(bare.title, "Create account | Tolley.io");
    assert.equal(String(bare.title).toLowerCase().includes("t-agent"), false);
  });
});
