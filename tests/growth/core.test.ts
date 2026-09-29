import test from "node:test";
import assert from "node:assert/strict";
import { announcementSlot, reportWindow, resaleMath } from "../../lib/growth/core";
import { campaignDecision } from "../../lib/live/campaign";
import { validateStory, storyHtml } from "../../lib/growth/story-core";
test("Central reporting days survive both DST transitions",()=>{
  const spring=reportWindow("yesterday",new Date("2026-03-09T16:00:00Z"));
  assert.equal(spring.until.getTime()-spring.since.getTime(),23*3600000);
  const fall=reportWindow("yesterday",new Date("2026-11-02T16:00:00Z"));
  assert.equal(fall.until.getTime()-fall.since.getTime(),25*3600000);
});
test("live reminders stop on expiry/end and never catch up missed slots",()=>{
  const start=new Date("2026-09-29T01:00:00Z"),show={status:"live",startsAt:start,liveStartedAt:start,endedAt:null,confirmedUntil:new Date("2026-09-29T03:00:00Z")};
  assert.equal(announcementSlot(show,new Date("2026-09-29T01:59:00Z"))?.slot,1);
  assert.equal(announcementSlot(show,new Date("2026-09-29T03:00:00Z")),null);
  assert.equal(announcementSlot({...show,liveStartedAt:null},start),null);
  assert.equal(announcementSlot({...show,endedAt:start},start),null);
  const post={kind:"announce_reminder_1",dueAt:start,expiresAt:show.confirmedUntil};
  assert.equal(campaignDecision(post,{...show,endedAt:start},start),"canceled");
});
test("resale math includes fixed costs and rejects invalid inputs",()=>{
  assert.deepEqual(resaleMath(100,40,10,2,8,20,4),{profit:40,maximumBuy:60,breakEvenSale:50/.9,unitCost:10});
  assert.equal(resaleMath(10,2,100,0,0,0),null);
  assert.equal(resaleMath(10,NaN,2,0,0,0),null);
});
test("generated copy cannot introduce HTML, links, contacts or secrets",()=>{
  const s={title:"A practical new way to plan a haul",description:"A useful look at the public tools we built to help people plan their next haul.",paragraphs:Array(4).fill("I built this tool to help people compare their costs before buying a haul.")};
  assert.ok(validateStory(s));
  assert.ok(validateStory({...s,paragraphs:[...s.paragraphs,"The public checker needs no password or API key and does not sign into your site."]}));
  for(const content of ["<script>alert(1)</script>","https://evil.test/", "Email me at private@example.com", "The password is public"])
    assert.throws(()=>validateStory({...s,paragraphs:[...s.paragraphs,content.padEnd(60," ")]}));
  assert.match(storyHtml(s,"https://www.tolley.io/live","2026-09-01",true),/From the build archive/);
});

import {selectPublicFeature} from "../../lib/growth/source-core";
test("build evidence uses changed feature pages, never article summaries or private routes",()=>{
 const files=["app/blog/page.tsx","app/live/page.tsx","app/live/reselling/page.tsx","app/live/admin/private/page.tsx","app/live/[show]/page.tsx"].map(filename=>({filename,status:"modified"}));
 assert.equal(selectPublicFeature(files,["blog","live"])?.filename,"app/live/reselling/page.tsx");
 assert.equal(selectPublicFeature([{filename:"app/blog/page.tsx",status:"modified"}],["blog"]),undefined);
 assert.equal(selectPublicFeature([{filename:"app/live/reselling/page.tsx",status:"removed"}],["live"]),undefined);
});
