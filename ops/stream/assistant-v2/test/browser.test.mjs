import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '/home/jelly/dgx-services/whatnot-sync-worker/node_modules/playwright/index.mjs';
import {WhatnotBrowser} from '../browser.mjs';

const sid='7034d537-5ecb-4933-915f-cd4b6baaab2d';
const fixture=`<!doctype html><a href="/user/treasure_hauls">@treasure_hauls</a><h1>Private fixture show</h1><div data-testid="seller-live-elapsed-time">00:10:00</div><div data-testid="seller-live-viewer-chip">2</div><div id="chat"></div><form id="form"><input data-wn-action="seller_live.chat.input"></form><script>
let ticks=0;setInterval(()=>document.querySelector('[data-testid="seller-live-elapsed-time"]').textContent='00:10:'+String(++ticks).padStart(2,'0'),1000);
window.emit=(user,text)=>{const row=document.createElement('div');row.dataset.testid='seller-live-chat-message';const wrap=document.createElement('div');const top=document.createElement('div');const b=document.createElement('button');b.setAttribute('aria-label','Open actions for @'+user);const u=document.createElement('strong');u.textContent=user;b.append(u);top.append(b);const m=document.createElement('strong');m.textContent=text;wrap.append(top,m);row.append(wrap);document.querySelector('#chat').append(row);};
emit('alice','Hello from a viewer');document.querySelector('#form').onsubmit=e=>{e.preventDefault();const i=document.querySelector('input');emit('treasure_hauls',i.value);i.value='';};</script>`;
test('browser adapter reads real selector shapes, confirms public echo and verifies exact DM recipient',async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext();let dmSends=0;
  await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname!=='www.whatnot.com')return route.abort();
    if(u.pathname===`/live/${sid}`)return route.fulfill({contentType:'text/html',body:fixture});
    if(u.pathname==='/user/alice')return route.fulfill({contentType:'text/html',body:'<a href="/dashboard/inbox?participantId=alice-id">Message</a>'});
    if(u.pathname==='/dashboard/inbox')return route.fulfill({contentType:'text/html',body:`<a href="/user/alice">Profiel bekijken</a><div id="messages"></div><textarea data-testid="input-message"></textarea><button data-testid="button-send-message">Send</button><script>document.querySelector('button').onclick=()=>{const i=document.querySelector('textarea');const p=document.createElement('p');p.textContent=i.value;document.querySelector('#messages').append(p);i.value='';fetch('/fixture-sent',{method:'POST'});};</script>`});
    if(u.pathname==='/fixture-sent'){dmSends++;return route.fulfill({body:'ok'});}
    return route.abort();
  });
  const bot=new WhatnotBrowser();bot.browser=browser;
  try{
    await bot.attach(`https://www.whatnot.com/live/${sid}`);
    const s=await bot.read();assert.equal(s.ownerVerified,true);assert.deepEqual(s.chat,[{user:'alice',text:'Hello from a viewer'}]);
    await bot.publicSend('Thanks for joining us!',()=>{});
    assert.equal((await bot.read()).chat.at(-1).text,'Thanks for joining us!');
    await bot.privateSend('alice','Thanks for chatting about cameras!',()=>{});assert.equal(dmSends,1);
    await bot.page.locator('input').fill('Human draft');await assert.rejects(()=>bot.publicSend('Replacement',()=>{}),/existing draft/);assert.equal(await bot.page.locator('input').inputValue(),'Human draft');
    await bot.page.locator('input').fill('');await assert.rejects(()=>bot.publicSend('Cancelled',()=>{throw Error('Paused');}),/Paused/);assert.ok(!(await bot.read()).chat.some(e=>e.text==='Cancelled'));
    await bot.page.locator('a').evaluate(e=>e.href='/user/wrongaccount');assert.equal((await bot.read()).ownerVerified,false);
    await assert.rejects(()=>bot.publicSend('Wrong account',()=>{}),/unavailable/);
  }finally{await browser.close();}
});
