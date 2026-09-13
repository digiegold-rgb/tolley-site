import assert from "node:assert/strict";
import { test } from "node:test";
import { fixesPrivateUrl } from "./fixes-private-url";

test("Fixes doorway accepts only a configured HTTPS tailnet destination", () => {
  assert.equal(fixesPrivateUrl("https://tolley-fixes.example.ts.net"), "https://tolley-fixes.example.ts.net/");
  for (const value of [undefined, "", "http://spark.example.ts.net", "https://evil.com", "https://spark.ts.net.evil.com", "https://user:pass@spark.example.ts.net", "https://spark.example.ts.net:444", "https://spark.example.ts.net/?token=secret", "javascript:alert(1)"]) assert.equal(fixesPrivateUrl(value), null);
});
