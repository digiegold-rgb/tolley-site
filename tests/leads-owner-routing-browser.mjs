import assert from 'node:assert/strict';
import {randomBytes,scryptSync,createHmac} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {chromium} from 'playwright';
import {requireIsolatedServer,totp} from './helpers/owner-session.mjs';
// Next normalizes loopback request URLs to localhost, including Origin checks.
const base='http://localhost:3018';requireIsolatedServer(base.replace('localhost','127.0.0.1'));
const p=new PrismaClient(), users=[];
const password=randomBytes(18).toString('hex'),salt=randomBytes(16).toString('hex');
const browser=await chromium.launch({headless:true});
let workspace;
try {
 const owner=await p.user.create({data:{email:'security-admin@example.invalid',credentialAuth:{create:{passwordHash:`${salt}:${scryptSync(password,salt,64).toString('hex')}`}}}});users.push(owner.id);
 const tab=await p.user.create({data:{}});users.push(tab.id);
 workspace=await p.vaterWorkspace.create({data:{ownerUserId:owner.id,userId:tab.id,name:'Routing test studio'}});
 await p.leadSubscriber.create({data:{userId:owner.id,status:'active',tier:'team',onboarded:true,farmZips:[],farmCities:[],specialties:[]}});
 const context=await browser.newContext();
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!==base){if(route.request().isNavigationRequest())console.log('Unexpected navigation:',u.origin+u.pathname);return route.abort();}
  if(['/api/analytics','/api/pulse','/api/csp-report'].includes(u.pathname))return route.fulfill({status:200,body:'{}'});
  return route.continue();
 });
 const page=await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/leads/pricing');
 assert.equal(await page.getByRole('link',{name:'Sign in',exact:true}).getAttribute('href'),'/login?callbackUrl=%2Fleads');
 await page.getByRole('link',{name:'Sign in',exact:true}).click();await page.waitForURL('**/login?callbackUrl=*');
 // A network failure must release the button so another attempt is possible.
 await page.route('**/api/auth/callback/credentials**',route=>route.abort());
 await page.getByPlaceholder('you@agency.com').fill(owner.email);await page.locator('input[type=password]').fill(password);
 await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await page.getByText('Could not connect to sign in. Please try again.').waitFor();
 assert.equal(await page.getByRole('button',{name:'Sign In',exact:true}).isEnabled(),true);
 await page.unroute('**/api/auth/callback/credentials**');
 await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await page.waitForURL('**/login/mfa-challenge?callbackUrl=*');
 assert.equal(new URL(page.url()).searchParams.get('callbackUrl'),'/leads');
 console.log('PASS: pricing sign-in, recoverable network failure, credentials login, MFA redirect');
 // Read the enrollment created by the page from the API, then verify through
 // the real endpoint. All credentials and MFA material belong to this fixture.
 const setup=await context.request.post(base+'/api/auth/mfa/setup',{data:{},headers:{origin:base}});
 assert.equal(setup.status(),200,setup.ok()?'':await setup.text());const enrollment=await setup.json();
 const verification=await context.request.post(base+'/api/auth/mfa/verify',{data:{code:totp(enrollment.secret)},headers:{origin:base}});
 assert.equal(verification.status(),200);
 const signature=createHmac('sha256','security-test-secret-only').update(`jelly-ws:${owner.id}:${tab.id}`).digest('base64url');
 await context.addCookies([{name:'jelly_ws',value:`${tab.id}.${signature}`,url:base,httpOnly:true,sameSite:'Lax'}]);
 await page.goto(base+'/leads/pricing');await page.waitForURL(base+'/leads');
 assert.equal(await page.getByRole('button',{name:'Open my owner workspace',exact:true}).count(),0,'Main existing subscription is loaded despite Studio tab');
 const config=await context.request.get(base+'/api/leads/onboard');assert.equal(config.status(),200);assert.equal((await config.json()).subscriber.userId,owner.id);
 const checkout=await context.request.post(base+'/api/leads/subscribe',{data:{tier:'starter'},headers:{origin:base}});
 assert.deepEqual(await checkout.json(),{url:'/leads'});
 // Studio session still points at its selected tab.
 const studio=await (await context.request.get(base+'/api/auth/session')).json();assert.equal(studio.user.id,tab.id);
 await page.goto(base+'/login?callbackUrl=%2Fleads%2Fpricing');await page.waitForURL(base+'/leads');
 console.log('PASS: owner pricing and legacy login return to Today, root subscriber survives Studio tab, owner checkout is bypassed');
 // An unpaid customer cannot acquire access through the owner routing fix.
 const customer=await p.user.create({data:{email:`routing-${randomBytes(6).toString('hex')}@example.invalid`,credentialAuth:{create:{passwordHash:`${salt}:${scryptSync(password,salt,64).toString('hex')}`}}}});users.push(customer.id);
 const customerContext=await browser.newContext();
 const csrf=await (await customerContext.request.get(base+'/api/auth/csrf')).json();
 await customerContext.request.post(base+'/api/auth/callback/credentials',{form:{csrfToken:csrf.csrfToken,email:customer.email,password,callbackUrl:base+'/leads'}});
 const unpaid=await customerContext.request.get(base+'/leads',{maxRedirects:0});assert.equal(unpaid.headers().location,'/leads/pricing');
 assert.equal((await customerContext.request.get(base+'/api/leads/crm/tasks')).status(),403);
 assert.deepEqual(errors,[],'No browser JavaScript errors');
 console.log('PASS: unpaid customers still require access');
} finally {
 await browser.close();
 if(workspace)await p.vaterWorkspace.delete({where:{id:workspace.id}});
 await p.user.deleteMany({where:{id:{in:users}}});await p.$disconnect();
}
