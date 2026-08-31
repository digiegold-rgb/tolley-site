import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jsonSafe } from "./json.ts";

describe("jsonSafe", () => {
  it("converts bigint to Number before JSON", () => {
    const out = jsonSafe({ views: 12n, nested: { likes: 3n }, arr: [1n] });
    assert.equal(out.views, 12);
    assert.equal(out.nested.likes, 3);
    assert.equal(out.arr[0], 1);
    assert.equal(JSON.stringify(out), '{"views":12,"nested":{"likes":3},"arr":[1]}');
  });

  it("leaves dates and ordinary numbers alone", () => {
    const d = new Date("2026-08-30T00:00:00.000Z");
    const out = jsonSafe({ day: d, n: 7 });
    assert.equal(out.day, d);
    assert.equal(out.n, 7);
  });
});
