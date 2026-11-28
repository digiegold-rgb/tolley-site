import test from "node:test";
import assert from "node:assert/strict";
import { getSubsite } from "../lib/subsites";
import { discoveryText } from "../lib/discovery";
import { publicKnowledge } from "../lib/company/public-knowledge";
import { capabilities } from "../lib/company/catalog";
import { validateActionFields } from "../lib/agent-manifest";
import { BUSINESS_URL, businessJsonLd } from "../lib/business";

test("worldwide service is retrievable with a sourced inquiry and no invented price", () => {
  const service = getSubsite("business")!;
  assert.equal(service.discovery?.disposition, "offering");
  assert.match(service.serviceArea!, /Worldwide/);
  assert.equal(service.pricing, undefined);
  assert.equal(businessJsonLd().areaServed, "Worldwide");
  for (const full of [false, true]) assert.ok(discoveryText(full).includes(BUSINESS_URL));
  const result = publicKnowledge("custom business software workflow automation")[0];
  assert.equal(result.id, "catalog:business");
  assert.deepEqual(result.sources, [BUSINESS_URL]);
  const inquiry = capabilities().find(c => c.id === "business.request_business_project")!;
  assert.equal(inquiry.mode, "intake");
  assert.equal(inquiry.pricing.kind, "free");
  assert.match(inquiry.limitations.join(" "), /not a confirmed booking/);
});
test("inquiry requires an actual workflow and problem but accepts international locations", () => {
  const action = getSubsite("business")!.actions[0];
  assert.match(validateActionFields(action, { workflow: "paperwork" })!, /problem/);
  assert.match(validateActionFields(action, { workflow: "invalid", problem: "Help" })!, /workflow/);
  for (const country of ["United Kingdom", "Australia", "日本", "Brasil"]) {
    assert.equal(validateActionFields(action, { workflow: "inventory", problem: "Keep item condition and storage locations together", country, timeZone: "Asia/Tokyo" }), null);
  }
});
