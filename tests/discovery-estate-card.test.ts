import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SaleCard, { type SaleCardData } from "../components/estate/sale-card";
const sale: SaleCardData = { slug: "example", title: "Example estate sale", areaLabel: "Independence", address: null, days: [], startsAtIso: "2026-07-17T13:00:00Z", addressPublishAtIso: null, highlights: [], status: "done" };
test("ended sale remains useful without advertising a current sale or address reveal", () => {
  const html = renderToStaticMarkup(React.createElement(SaleCard, { sale, headingLevel: 1 }));
  assert.match(html, /<h1\b/);
  assert.match(html, /Sale ended/);
  assert.match(html, /Hear about the next sale/);
  assert.doesNotMatch(html, /This weekend|Happening now|Doors are open|exact address released/);
});
