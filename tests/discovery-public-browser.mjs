// Read-only public audit. AUDIT_BASE, AUDIT_OUT and optional AUDIT_PATHS configure the run.
// No form submissions or state-changing browser requests are allowed.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const base=process.env.AUDIT_BASE||'https://www.tolley.io';
const out=process.env.AUDIT_OUT||'/tmp/tolley-public-audit';
await fs.mkdir(out,{recursive:true});
const sitemap=await (await fetch(base+'/sitemap.xml')).text();
const paths=[...new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname).concat(['/animate/demo','/animate/terms','/animate/privacy','/wd/terms','/wd/privacy','/trailer/terms','/trailer/privacy','/rental/terms','/estate/terms','/estate/privacy','/sales/terms']))];
const only=process.env.AUDIT_PATHS?.split(',');
const targets=only||paths;
const browser=await chromium.launch({headless:true});
let cursor=0;const results=[];
await Promise.all(Array.from({length:3},async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/*',r=>{const q=r.request();if(!['GET','HEAD'].includes(q.method())||/google-analytics|googletagmanager|facebook.net|analytics.twitter|vercel-insights/.test(q.url()))return r.abort();return r.continue()});
 const page=await context.newPage();
 while(cursor<targets.length){const path=targets[cursor++];const row={path,issues:[],sizes:[]};let errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
 try{
 const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:120000}); row.status=response.status();row.finalUrl=page.url();
 const html=await response.text().catch(()=>page.content()); await fs.writeFile(out+'/'+encodeURIComponent(path)+'.html',html);
 await page.waitForTimeout(500);
 row.meta=await page.evaluate(()=>({title:document.title,description:document.querySelector('meta[name=description]')?.content,canonical:document.querySelector('link[rel=canonical]')?.href,robots:[...document.querySelectorAll('meta[name=robots]')].map(n=>n.content),h1:[...document.querySelectorAll('h1')].map(n=>n.textContent),text:document.body.innerText.slice(0,500),links:[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')),jsonLd:[...document.querySelectorAll('script[type="application/ld+json"]')].map(n=>{try{return JSON.parse(n.textContent)['@type']}catch{return 'INVALID'}})}));
 if(row.status!==200)row.issues.push('HTTP '+row.status);
 if(new URL(row.finalUrl).pathname!==path)row.issues.push('redirect');
 if(!row.meta.canonical)row.issues.push('missing canonical');
 else if(new URL(row.meta.canonical).href!==new URL(path,'https://www.tolley.io').href)row.issues.push('canonical mismatch');
 if(!row.meta.description)row.issues.push('missing description');
 if(!row.meta.h1.length)row.issues.push('missing h1');
 if(row.meta.robots.some(s=>s.includes('noindex')))row.issues.push('noindex');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.right>innerWidth+2&&s.position!=='fixed'&&s.visibility!=='hidden'}).slice(0,8).map(e=>({tag:e.tagName,cls:typeof e.className==='string'?e.className:'',text:e.textContent?.slice(0,100),right:Math.round(e.getBoundingClientRect().right)}))}));row.sizes.push(size);if(size.scrollWidth>width+2)row.issues.push('overflow '+width);}
 row.errors=[...new Set(errors)];
 }catch(e){row.issues.push(e.message.slice(0,200));}
 page.off('pageerror',onError);results.push(row);await fs.writeFile(out+'/results.json',JSON.stringify({base,checkedAt:new Date().toISOString(),results},null,2));
 console.log(JSON.stringify({n:results.length,total:targets.length,path,issues:row.issues,errors:row.errors}));
 }
 await context.close();
}));await browser.close();
if (results.some(r => r.issues.length || r.errors?.length)) process.exitCode = 1;
