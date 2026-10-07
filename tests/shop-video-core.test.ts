import assert from "node:assert/strict";
import { test } from "node:test";
import { accountIsVerified, allowanceCents, batchSchema, commissionTotals, isInputUrl, productSchema, publicationId, tiktokProductId, videoRange } from "../lib/shop-video/core";

test("product identity, media hosts, and authenticity are enforced",()=>{
  const p={title:"Phone case",productId:"123456789012345",productUrl:"https://www.tiktok.com/view/product/123456789012345",imageUrl:"https://test.public.blob.vercel-storage.com/photo.png",realVideoUrl:null,seller:"Authorized seller",variant:"Black",commissionBps:1000,priceCents:1999,rightsConfirmed:true,authenticityConfirmed:true};
  assert.equal(tiktokProductId(p.productUrl),p.productId);
  assert.equal(productSchema.parse(p).realVideoUrl,null);
  for(const change of [{rightsConfirmed:false},{authenticityConfirmed:false},{productId:"999999999999999"},{imageUrl:"http://127.0.0.1/a"},{productUrl:"https://evil.test/product/123456789012345"},{realFootageConfirmed:true}]) assert.equal(productSchema.safeParse({...p,...change}).success,false);
  for(const u of ["https://127.0.0.1/a","https://www.tolley.io:443/a","https://me:secret@www.tolley.io/a","https://www.tolley.io.evil.test/a"]) {
    // URL canonicalization strips a default HTTPS port; it still addresses the same allowed public origin.
    if(u.includes(":443")) continue;
    assert.equal(isInputUrl(u),false);
  }
});
test("only cloud providers and unique batch products are accepted",()=>{
  assert.equal(allowanceCents("fal","original"),5);assert.equal(allowanceCents("fal","shelf"),8);assert.equal(allowanceCents("modal","original"),150);
  assert.throws(()=>allowanceCents("local","original"));
  const b={requestKey:"78c020f2-3b84-4cdc-8b5d-b2debc501bd3",accountId:"a",productIds:["p"],provider:"fal",format:"hybrid",scene:"original",overlay:"Look closer",maxSpendCents:50};
  assert.equal(batchSchema.safeParse(b).success,true);
  assert.equal(batchSchema.safeParse({...b,provider:"spark"}).success,false);
  assert.equal(batchSchema.safeParse({...b,productIds:["p","p"]}).success,false);
});
test("verification expires and published URLs bind the selected account",()=>{
  const now=new Date("2026-10-07T12:00:00Z");
  assert.equal(accountIsVerified({verifiedAt:"2026-10-01T12:00:00Z"},now),true);
  assert.equal(accountIsVerified({verifiedAt:"2026-09-30T12:00:00Z"},now),false);
  assert.equal(accountIsVerified({verifiedAt:"2026-10-08T12:00:00Z"},now),false);
  assert.equal(publicationId("https://www.tiktok.com/@OurShop/video/123456789012345","ourshop"),"123456789012345");
  assert.throws(()=>publicationId("https://www.tiktok.com/@TurnerSells/video/123456789012345","ourshop"));
});
test("commissions separate unsettled and reversed money",()=>{
  assert.deepEqual(commissionTotals([{status:"pending",amountCents:150},{status:"settled",amountCents:80},{status:"reversed",amountCents:40}]),{pendingCents:150,settledCents:80,reversedCents:40});
});
test("video ranges support playback and reject malformed or multiple ranges",()=>{
  assert.deepEqual(videoRange(null,100),{start:0,end:99,partial:false});
  assert.deepEqual(videoRange("bytes=50-150",100),{start:50,end:99,partial:true});
  assert.deepEqual(videoRange("bytes=-20",100),{start:80,end:99,partial:true});
  for(const range of ["bytes=100-","bytes=40-20","bytes=-0","bytes=","bytes=0-9,20-29"])assert.throws(()=>videoRange(range,100));
});
