import test from "node:test";
import assert from "node:assert/strict";
import { summarizeImpactActions, validAffiliateDestination, validImpactLink, type ImpactAction } from "../../lib/live/impact-core";
const since = new Date("2026-09-01T00:00:00Z"), until = new Date("2026-10-01T00:00:00Z");
const action = (overrides: Partial<ImpactAction> = {}): ImpactAction => ({ Id: "one", CampaignId: 23513, State: "PENDING", Payout: "1.25", Currency: "USD", EventDate: "2026-09-20T00:00:00Z", ...overrides });
test("affiliate destinations reject invites and arbitrary redirects", () => {
  assert.equal(validAffiliateDestination("https://www.whatnot.com/user/treasure_hauls"), true);
  assert.equal(validAffiliateDestination("https://www.whatnot.com/live/abc"), true);
  assert.equal(validAffiliateDestination("https://whatnot.com/show/abc"), true);
  for(const u of ["https://www.whatnot.com/invite/treasure_hauls","https://www.whatnot.com.evil.test/live/abc","https://evil.test/live/abc","https://www.whatnot.com/live/abc?redirect=evil","https://me@www.whatnot.com/live/abc"])assert.equal(validAffiliateDestination(u),false);
  assert.equal(validImpactLink("https://whatnot.pxf.io/c/7857130/1943216/23513?u=hello"),true);
  for(const u of ["https://whatnot.pxf.io.evil.test/c/7857130/1943216/23513","https://whatnot.pxf.io/c/other/1943216/23513","http://whatnot.pxf.io/c/7857130/1943216/23513"])assert.equal(validImpactLink(u),false);
});
test("Impact reports deduplicate actions, separate currencies/states, and exclude other windows/programs", () => {
  const s=summarizeImpactActions([action(),action(),action({Id:"two",State:"APPROVED",Payout:"2.50"}),action({Id:"three",State:"REVERSED",Payout:"1"}),action({Id:"four",Currency:"EUR"}),action({Id:"other-program",CampaignId:1}),action({Id:"old",EventDate:"2026-08-01T00:00:00Z"})],since,until);
  assert.equal(s.actions,4);
  assert.deepEqual(s.groups,[{state:"PENDING",currency:"USD",actions:1,commission:1.25},{state:"APPROVED",currency:"USD",actions:1,commission:2.5},{state:"REVERSED",currency:"USD",actions:1,commission:1},{state:"PENDING",currency:"EUR",actions:1,commission:1.25}]);
  assert.equal("paidCash" in s,false);
});
test("unknown or malformed commissions fail instead of silently becoming zero", () => {
  for(const a of [action({State:"UNKNOWN"}),action({Payout:""}),action({Payout:"NaN"}),action({EventDate:"invalid"}),action({Currency:""})])assert.throws(()=>summarizeImpactActions([a],since,until));
  assert.deepEqual(summarizeImpactActions([],since,until),{actions:0,groups:[]});
});
