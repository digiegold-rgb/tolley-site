import assert from 'node:assert/strict';
import {mkdirSync,copyFileSync,rmSync,existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import {listingPriceCents,listingEstCostCents} from '../lib/vater/listing-pricing.ts';
const base='http://127.0.0.1:3026', fixture='app/realestateanimated/duration-test';
if(existsSync(fixture))throw Error('Fixture exists; refusing to overwrite');
mkdirSync(fixture);copyFileSync('tests/fixtures/listing-duration-page.tsx',fixture+'/page.tsx');
let job={id:'duration-fixture',sku:'beauty_shot',status:'draft',step:5,durationS:5,sourceKind:'upload',sourceImageUrls:['/room.png'],features:[],address:'Test room',engine:'seedance',look:'photoreal',lane:'social',reel:false};
let stageBody, stageCount=0, staleQuote=false, writes=0;
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin!==base&&!['data:','blob:'].includes(u.protocol))return route.abort();
  if(u.pathname==='/api/vater/listing/duration-fixture'){
   if(req.method()==='PATCH'){writes++;await new Promise(r=>setTimeout(r,30));job={...job,...req.postDataJSON()};}
   return route.fulfill({json:{job}});
  }
  if(u.pathname.endsWith('/preflight'))return route.fulfill({json:{ok:true,blockers:[],warnings:[],priceCents:listingPriceCents(job.sku,job)+(staleQuote?100:0),durationS:job.durationS,estCostCents:listingEstCostCents(job.sku,job),balanceCents:10000,unmetered:false,lines:[`${job.durationS} seconds`],licenseVerified:false,agentProfileComplete:true}});
  if(u.pathname.endsWith('/stage')){stageCount++;stageBody=req.postDataJSON();return route.fulfill({json:{job:{...job,status:'rendering'}}});}
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{unmetered:false}});
  return route.continue();
 });
 await page.goto(base+'/realestateanimated/duration-test',{waitUntil:'networkidle',timeout:180000});
 const slider=page.getByRole('slider',{name:'Video length'}), total=page.getByTestId('listing-duration-price');
 await expect(slider).toHaveValue('5');await expect(total).toContainText('$5');
 await slider.press('End');await expect(slider).toHaveValue('30');await expect(total).toContainText('$30');
 await slider.press('Home');await expect(slider).toHaveValue('4');await expect(total).toContainText('$4');
 for(let n=4;n<15;n++)await slider.press('ArrowRight');
 await expect(total).toContainText('$15');await expect.poll(()=>job.durationS).toBe(15);
 await page.reload({waitUntil:'networkidle'});await expect(slider).toHaveValue('15');
 await page.getByTestId('listing-reel').check();await expect(total).toContainText('$30');
 await page.getByTestId('listing-pay').click();
 await expect(page.getByRole('dialog')).toContainText('$30');
 await page.getByTestId('money-confirm-submit').click();
 await expect.poll(()=>stageCount).toBe(1);assert.deepEqual(stageBody,{priceCents:3000,durationS:15});
 assert.equal(job.durationS,15);assert(job.reel);assert(writes>0);
 staleQuote=true;await page.getByTestId('listing-pay').click();
 await expect(page.getByTestId('listing-pay-error')).toContainText('saved length or price changed');assert.equal(stageCount,1,'stale quote must not start a render');
 for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await page.screenshot({path:'/tmp/listing-duration-'+width+'.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');}
 assert.deepEqual(errors,[]);
 console.log('PASS: 4–30s live pricing, saved duration after reload, serialized autosave, Reel pricing, exact confirmation payload, stale quote blocked, desktop/mobile. APIs mocked; no render or payment.');
}finally{await browser.close();rmSync(fixture,{recursive:true});rmSync('.next/dev/types/app/realestateanimated/duration-test',{recursive:true,force:true});}
