// Optional real storage smoke: LISTING_REAL_UPLOAD=1 requires a Blob token.
// Uses an isolated UI fixture and the real SDK/policy; no customer job or paid render.
import assert from 'node:assert/strict';
import {mkdirSync,copyFileSync,rmSync,existsSync,readFileSync,writeFileSync,truncateSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {expect} from '@playwright/test';
import {generateClientTokenFromReadWriteToken} from '@vercel/blob/client';
import {del} from '@vercel/blob';
import {listingPhotoTokenPolicy} from '../lib/vater/listing/photo-upload.ts';
const real=process.env.LISTING_REAL_UPLOAD==='1';
const base='http://127.0.0.1:3026',fixture='app/realestateanimated/photo-test';
if(existsSync(fixture))throw Error('Fixture exists');
mkdirSync(fixture);copyFileSync('tests/fixtures/listing-photo-page.tsx',fixture+'/page.tsx');
const browser=await chromium.launch();let uploadedUrl;
try{
 const page=await browser.newPage({viewport:{width:390,height:900}});let handshakes=0;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/vater/upload',async route=>{
  const req=route.request();assert(req.postDataBuffer().length<2048,'function only receives a tiny token request');
  const body=req.postDataJSON();assert.equal(body.type,'blob.generate-client-token');assert.equal(body.payload.multipart,true);handshakes++;
  if(!real)return route.fulfill({status:401,json:{error:'Unauthorized'}});
  const token=await generateClientTokenFromReadWriteToken({token:process.env.BLOB_READ_WRITE_TOKEN,pathname:body.payload.pathname,...listingPhotoTokenPolicy(body.payload.pathname)});
  return route.fulfill({json:{type:'blob.generate-client-token',clientToken:token}});
 });
 await page.route('**/api/analytics**',r=>r.fulfill({json:{ok:true}}));
 await page.goto(base+'/realestateanimated/photo-test',{waitUntil:'networkidle',timeout:180000});
 await expect(page.getByTestId('listing-dropzone')).toContainText('100 MB');
 await page.getByTestId('listing-upload').setInputFiles({name:'camera.cr3',mimeType:'image/x-canon-cr3',buffer:Buffer.from('raw')});
 await expect(page.getByTestId('listing-photo-error')).toContainText('Export RAW');assert.equal(handshakes,0);
 writeFileSync('/tmp/listing-oversized-test.jpg','');truncateSync('/tmp/listing-oversized-test.jpg',100*1024*1024+1);
 await page.getByTestId('listing-upload').setInputFiles('/tmp/listing-oversized-test.jpg');
 await expect(page.getByTestId('listing-photo-error')).toContainText('bigger than 100 MB');assert.equal(handshakes,0);
 const bytes=real?readFileSync('/tmp/listing-large-camera.jpg'):Buffer.alloc(12*1024*1024);
 await page.getByTestId('listing-upload').setInputFiles(real?'/tmp/listing-large-camera.jpg':{name:'DSC03023.JPEG',mimeType:'image/jpeg',buffer:bytes});
 if(real){
  await expect(page.getByTestId('saved-photo')).toContainText('https://',{timeout:180000});
  uploadedUrl=await page.getByTestId('saved-photo').textContent();
  const downloaded=Buffer.from(await(await fetch(uploadedUrl)).arrayBuffer());
  assert.equal(createHash('sha256').update(downloaded).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
  await expect(page.getByTestId('listing-next')).toBeEnabled();
  await page.waitForFunction(()=>document.querySelector('[data-testid="listing-photo-preview"]')?.naturalWidth>0);
  console.log('PASS real direct multipart upload:',bytes.length,'bytes; downloaded original matches SHA-256; preview loaded and Next enabled.');
 }else{
  await expect(page.getByTestId('listing-photo-error')).toBeVisible({timeout:30000});
  await expect(page.getByTestId('listing-choose-photo')).toBeEnabled();
  await expect(page.getByTestId('listing-next')).toBeDisabled();
 }
 assert.equal(handshakes,1);assert.deepEqual(errors,[]);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 console.log('PASS unsupported/oversized files blocked before storage, large file uses JSON token handshake, mobile fits.');
}finally{
 rmSync('/tmp/listing-oversized-test.jpg',{force:true});
 await browser.close();rmSync(fixture,{recursive:true});rmSync('.next/dev/types/app/realestateanimated/photo-test',{recursive:true,force:true});
 if(uploadedUrl)await del(uploadedUrl);
}
