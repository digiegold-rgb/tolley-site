// Run against a disposable `next dev --webpack --port 3026` server, without production env.
// Installs a component fixture for the run, then removes it. API/images are mocked.
import assert from 'node:assert/strict';
import {mkdirSync,copyFileSync,rmSync,existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {expect} from '@playwright/test';
const base='http://127.0.0.1:3026', fixture='app/realestateanimated/delivery-test';
if(existsSync(fixture)) throw Error('Fixture path already exists; refusing to overwrite it');
mkdirSync(fixture);copyFileSync('tests/fixtures/listing-delivery-page.tsx',fixture+'/page.tsx');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let polls=0, approvals=0, paidRetries=0;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
await page.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());
 if(u.origin!==base&&!['data:','blob:'].includes(u.protocol))return route.abort();
 if(u.pathname==='/test-broken.png')return route.fulfill({status:404,body:'Missing'});
 if(/^\/test-.*\.png$/.test(u.pathname))return route.fulfill({contentType:'image/png',body:png});
 if(u.pathname.endsWith('/poll')){polls++;return route.fulfill({status:503,json:{error:'Test renderer unavailable'}});}
 if(u.pathname.endsWith('/approve-still')){approvals++;return route.fulfill({status:503,json:{error:'Test approval'}});}
 if(u.pathname.endsWith('/restage')){paidRetries++;return route.fulfill({status:503,json:{error:'Unexpected paid retry'}});}
 if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});
 return route.continue();
});
const wait=fn=>page.waitForFunction(fn);
try{
 const response=await page.goto(base+'/realestateanimated/delivery-test',{waitUntil:'networkidle',timeout:180000});assert.equal(response.status(),200);
 await page.getByTestId('listing-missing-still').waitFor();
 assert.equal(await page.getByTestId('listing-approve-still').count(),0);
 assert.equal(await page.getByTestId('listing-restage').count(),0);
 await expect.poll(()=>polls,{timeout:30000,message:'stranded approval resumes checking delivery'}).toBeGreaterThan(0);
 await page.getByRole('button',{name:'broken',exact:true}).click();
 await page.getByText('The preview could not load.',{exact:false}).waitFor();
 assert(await page.getByTestId('listing-approve-still').isDisabled());assert(await page.getByTestId('listing-restage').isDisabled());
 await page.getByRole('button',{name:'valid',exact:true}).click();
 await wait(()=>!document.querySelector('[data-testid=listing-approve-still]')?.disabled);
 assert(await page.getByTestId('listing-restage').isEnabled());
 await page.getByRole('button',{name:'beauty-legacy',exact:true}).click();
 await wait(()=>!document.querySelector('[data-testid=listing-approve-still]')?.disabled);
 assert.equal(await page.getByTestId('listing-staged-still').getAttribute('src'),'/test-original.png');
 assert.equal(await page.getByTestId('listing-restage').count(),0);
 assert.equal(await page.getByTestId('listing-phase-staging').count(),0);
 await page.getByTestId('listing-approve-still').click();
 await page.getByText('Test approval',{exact:true}).waitFor();assert.equal(approvals,1);assert.equal(paidRetries,0);
 await page.getByRole('button',{name:'beauty-filming',exact:true}).click();
 assert.equal(await page.getByTestId('listing-phase-filming').getAttribute('data-state'),'active');
 assert.equal(await page.getByTestId('listing-phase-staging').count(),0);
 assert.equal(await page.getByTestId('listing-approval').count(),0);
 await page.getByRole('button',{name:'beauty-price',exact:true}).click();
 assert.equal(await page.getByRole('radiogroup',{name:'Look',exact:true}).count(),0);
 await page.getByText('A slow camera move through your original photo.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'ready',exact:true}).click();
 assert.equal(await page.getByTestId('listing-video').getAttribute('src'),'/test-video.mp4');
 assert.equal(await page.getByTestId('listing-download').getAttribute('href'),'/test-video.mp4');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:950});
  await page.getByRole('button',{name:'beauty-legacy',exact:true}).click();
  await page.screenshot({path:'/tmp/listing-delivery-'+width+'.png'});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: missing/404 previews cannot approve or buy retries; valid images unlock; legacy Beauty uses original; direct Beauty films; ready video downloads; desktop/mobile, no browser errors. APIs mocked; no render spend or messages.');
}finally{await browser.close();rmSync(fixture,{recursive:true});rmSync('.next/dev/types/app/realestateanimated/delivery-test',{recursive:true,force:true});}
