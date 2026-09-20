import test from "node:test";
import assert from "node:assert/strict";
import { broadcastLabel, canAutoPublish, contribution, showSchema, campaignSource } from "../../lib/live/core";
test("arming and encoding never assert platform live",()=>{
  assert.match(broadcastLabel({armed:true,obs:{streaming:false},destinations:{}}),/waiting/);
  assert.match(broadcastLabel({armed:true,obs:{streaming:true},destinations:{}}),/Encoding/);
  assert.equal(broadcastLabel({armed:true,obs:{streaming:true},destinations:{youtube:{running:true}}}),"Sending to platforms");
});
test("free inventory still incurs fees, fulfillment and ads",()=>{
  const r=contribution({sales:313,fees:52.25,inventory:0,fulfillment:10,refunds:0,ads:5,labor:30,minutes:120,orders:44,settled:false});
  assert.equal(r.afterAds,245.75);assert.equal(r.perHour,107.875);assert.ok(r.breakEvenExtraSales!>5);
  assert.equal(contribution({sales:0,fees:1,inventory:0,fulfillment:0,refunds:0,ads:5,labor:0,minutes:60,orders:0,settled:false}).breakEvenExtraSales,null);
});
test("uncertain, malformed or unsafe review cannot publish",()=>{
 const safe={transcriptSafe:true,visualSafe:true,humiliationFree:true,profanityHandled:true,noCurrentOffer:true,confidence:.98,reason:"clear"};
 assert.equal(canAutoPublish(safe),true);
 for(const k of ["transcriptSafe","visualSafe","humiliationFree","profanityHandled","noCurrentOffer"]) assert.equal(canAutoPublish({...safe,[k]:false}),false);
 assert.equal(canAutoPublish({...safe,confidence:.94}),false);assert.equal(canAutoPublish({}),false);
});
test("show links cannot redirect to arbitrary hosts",()=>{
 const s={title:"Garage finds",category:"Electronics",startsAt:"2026-09-22T17:00:00-05:00",durationMin:120,whatnotUrl:"https://www.whatnot.com/live/abc-123"};
 assert.equal(showSchema.safeParse(s).success,true);
 for(const url of ["javascript:alert(1)","https://whatnot.com.evil.test/live/123","https://evil.test/live/123","https://user@whatnot.com/live/123","https://whatnot.com/live/123?next=https://evil.test"]) assert.equal(showSchema.safeParse({...s,whatnotUrl:url}).success,false);
 assert.equal(campaignSource('<script>'),"script");
});
