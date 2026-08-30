import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mustRedeemInvite, studioAccessAllowed } from "./beta-access";

describe("mustRedeemInvite", () => {
  it("does not require a code for a Jelly public-beta signup", () => {
    assert.equal(mustRedeemInvite("jelly", null), false);
    assert.equal(mustRedeemInvite("jelly", ""), false);
  });

  it("still requires a code for Listing Studio", () => {
    assert.equal(mustRedeemInvite("realestate", null), true);
  });

  it("validates a supplied code on either door", () => {
    assert.equal(mustRedeemInvite("jelly", "JELLYABCD"), true);
    assert.equal(mustRedeemInvite("realestate", "JELLYABCD"), true);
  });
});

describe("studioAccessAllowed", () => {
  it("lets a public Jelly account in without an invite", () => {
    assert.equal(
      studioAccessAllowed({ owner: false, studio: false, invited: false, product: "jelly" }),
      true,
    );
  });

  it("blocks an uninvited Listing Studio account", () => {
    assert.equal(
      studioAccessAllowed({
        owner: false,
        studio: false,
        invited: false,
        product: "realestate",
      }),
      false,
    );
  });

  it("grandfathers owner, studio, and redeemed invites", () => {
    assert.equal(
      studioAccessAllowed({ owner: true, studio: false, invited: false, product: "realestate" }),
      true,
    );
    assert.equal(
      studioAccessAllowed({ owner: false, studio: true, invited: false, product: "realestate" }),
      true,
    );
    assert.equal(
      studioAccessAllowed({
        owner: false,
        studio: false,
        invited: true,
        product: "realestate",
      }),
      true,
    );
  });
});
