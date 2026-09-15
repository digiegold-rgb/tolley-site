import test from 'node:test';
import assert from 'node:assert/strict';
import {listingPriceCents,listingEstCostCents,listingDurationS} from './listing-pricing';
import {buildVideoPrompt} from './listing/prompts';

test('Beauty defaults to $5 for five seconds, including legacy unset duration',()=>{
 for(const durationS of [undefined,null,5]) {
  assert.equal(listingDurationS('beauty_shot',durationS),5);
  assert.equal(listingPriceCents('beauty_shot',{durationS}),500);
 }
});
test('every slider second scales the client total and the separate vertical render',()=>{
 for(let durationS=4;durationS<=30;durationS++){
  assert.equal(listingPriceCents('beauty_shot',{durationS}),durationS*100);
  assert.equal(listingPriceCents('beauty_shot',{durationS,reel:true}),durationS*200);
  assert.equal(listingEstCostCents('beauty_shot',{durationS}),durationS*50);
  assert.equal(listingEstCostCents('beauty_shot',{durationS,reel:true}),durationS*100);
  assert.match(buildVideoPrompt({sku:'beauty_shot',durationS}),new RegExp(`^${durationS} seconds`));
 }
});
test('invalid duration is rejected instead of billed then silently clamped',()=>{
 for(const durationS of [0,3,31,-1,5.5,NaN,Infinity]){
  assert.throws(()=>listingPriceCents('beauty_shot',{durationS}),RangeError);
  assert.throws(()=>listingDurationS('beauty_shot',durationS),RangeError);
 }
});
test('other products keep their own duration and price',()=>{
 assert.equal(listingPriceCents('virtual_staging',{durationS:30}),499);
 assert.equal(listingPriceCents('before_after',{durationS:30}),2900);
 assert.equal(listingDurationS('before_after',30),12);
});
