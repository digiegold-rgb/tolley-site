import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.LISTING_SALES_TEST_URL || 'http://127.0.0.1:3024';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({reducedMotion:'reduce'});
const events=[];
let approved=true;
await context.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());
 if(u.origin!==new URL(base).origin && !['data:','blob:'].includes(u.protocol))return route.abort();
 if(u.pathname==='/api/vater/invite-request'){return route.fulfill({json:{ok:true,autoApproved:approved,product:'realestate'}});}
 if(u.pathname==='/api/analytics'){events.push(r.postDataJSON());return route.fulfill({json:{ok:true}});}
 return route.continue();
});
const page=await context.newPage();
page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const response=await page.goto(base+'/realestateanimated',{waitUntil:'networkidle',timeout:180000});
 assert.equal(response.status(),200);
 await page.waitForFunction(() => { const button=document.querySelector('[data-testid=invite-request-form] button[type=submit]'); return button && !button.disabled; });
 assert.equal(await page.getByTestId('hero-cta').getAttribute('data-track-event'),'listing_start');
 await page.getByTestId('hero-cta').click();
 assert.equal(new URL(page.url()).hash,'#start');
 assert.equal(await page.locator('[data-testid^="landing-sku-"]').count(),3);
 assert.equal(await page.locator('[data-testid^="landing-pack-"]').count(),0);
 assert.equal(await page.locator('[data-testid="footer-call"]').count(),0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow at '+width);
  await page.screenshot({path:'/tmp/listing-sales-'+width+'.png',fullPage:true});
 }
 await page.getByRole('textbox',{name:'Email for your seat'}).fill('listing-browser@example.invalid');
 await page.getByRole('button',{name:'Email my signup link'}).click();
 await page.getByRole('status').getByText('Your signup link has been sent.').waitFor();
 approved=false;
 await page.reload({waitUntil:'networkidle'});
 await page.getByRole('textbox',{name:'Email for your seat'}).fill('listing-browser@example.invalid');
 await page.getByRole('button',{name:'Email my signup link'}).click();
 await page.getByRole('status').getByText('Your request is saved.').waitFor();
 assert.match(await page.getByRole('status').innerText(),/has not been sent/);
 assert(events.some(e=>e.event==='listing_start'));
 assert(events.some(e=>e.event==='listing_signup_link_sent'));
 assert(events.some(e=>e.event==='listing_signup_pending'));
 assert.deepEqual(errors,[]);
 console.log('PASS: desktop/mobile, CTAs, current products only, automatic/pending signup states, tracking, no browser errors. Email and analytics mocked; no messages sent.');
}catch(e){await page.screenshot({path:'/tmp/listing-sales-error.png'});console.log((await page.locator('#start').innerText()).slice(-1600));throw e;}finally{await browser.close();}
