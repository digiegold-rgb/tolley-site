import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { STUDIO_HOME, studioSignOutHome } from "./product";

describe("studioSignOutHome", () => {
  it("returns the Animate public homepage, never /", () => {
    assert.equal(studioSignOutHome("jelly"), "/animate");
    assert.equal(studioSignOutHome("/animate"), "/animate");
    assert.equal(studioSignOutHome("/animate?w=tab"), "/animate");
    assert.equal(studioSignOutHome("https://tolley.io/animate"), "/animate");
    assert.notEqual(studioSignOutHome("jelly"), "/");
  });

  it("keeps Listing Studio on its own homepage", () => {
    assert.equal(studioSignOutHome("realestate"), "/realestateanimated");
    assert.equal(studioSignOutHome("/realestateanimated"), "/realestateanimated");
    assert.equal(STUDIO_HOME.realestate, "/realestateanimated");
  });

  it("does not hijack T-Agent or other non-studio lanes", () => {
    assert.equal(studioSignOutHome("/"), null);
    assert.equal(studioSignOutHome("/leads"), null);
    assert.equal(studioSignOutHome("/settings"), null);
    assert.equal(studioSignOutHome(null), null);
  });
});

describe("studio Settings logout", () => {
  it("does not hard-code callbackUrl: '/' in the Animate header", async () => {
    const src = await readFile("components/animate/Header.tsx", "utf8");
    assert.equal(src.includes("callbackUrl: '/'"), false);
    assert.match(src, /studioSignOutHome/);
  });
});
