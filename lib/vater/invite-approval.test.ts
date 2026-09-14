import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldAutoApproveInvite } from "./invite-approval";

describe("self-service invite approval", () => {
  it("admits Listing visitors from direct, search, referral, and paid traffic", () => {
    for (const source of [undefined, "", "google", "customer-referral", "fb"]) {
      assert.equal(shouldAutoApproveInvite("realestate", source), true);
    }
  });
  it("preserves Jelly source restrictions and configuration", () => {
    assert.equal(shouldAutoApproveInvite("jelly", undefined), false);
    assert.equal(shouldAutoApproveInvite("jelly", "google"), false);
    assert.equal(shouldAutoApproveInvite("jelly", " FB "), true);
    assert.equal(shouldAutoApproveInvite("jelly", "google", "google, partner"), true);
    assert.equal(shouldAutoApproveInvite("jelly", "fb", "google"), false);
    assert.equal(shouldAutoApproveInvite("jelly", "referral", "*"), true);
    assert.equal(shouldAutoApproveInvite("jelly", undefined, "*"), false);
  });
});
