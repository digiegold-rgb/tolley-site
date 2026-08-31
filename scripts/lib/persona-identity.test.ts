import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePersonaIdentity } from "./persona-identity.ts";

describe("parsePersonaIdentity", () => {
  it("uses the file's description for both ladies and does not invent traits", () => {
    const p = parsePersonaIdentity({
      description: "FROM FILE ONLY",
      face: "/tmp/character-ref.png",
    });
    assert.equal(p.ladies.length, 2);
    assert.equal(p.ladies[0].name, "Lady 1");
    assert.equal(p.ladies[1].name, "Lady 2");
    assert.equal(p.ladies[0].description, "FROM FILE ONLY");
    assert.equal(p.ladies[1].description, "FROM FILE ONLY");
    assert.equal(p.facePath, "/tmp/character-ref.png");
  });

  it("prefers per-lady bags when present", () => {
    const p = parsePersonaIdentity({
      lady1: { name: "A", description: "desc-a", role: "host" },
      lady2: { name: "B", description: "desc-b" },
    });
    assert.equal(p.ladies[0].name, "A");
    assert.equal(p.ladies[1].description, "desc-b");
    assert.equal(p.ladies[0].role, "host");
  });

  it("hard-errors when there is no description anywhere", () => {
    assert.throws(() => parsePersonaIdentity({}), /no description/);
  });
});
