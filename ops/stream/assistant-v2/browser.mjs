import {OWNER,normalizeUser,showId,validateShowUrl} from './core.mjs';
const PLAYWRIGHT=process.env.WHATNOT_BOT_PLAYWRIGHT||'/home/jelly/dgx-services/whatnot-sync-worker/node_modules/playwright/index.mjs';
export class WhatnotBrowser {
  constructor({endpoint='http://127.0.0.1:9222',fixture=false}={}){this.endpoint=endpoint;this.fixture=fixture;this.browser=null;this.page=null;this.dmPage=null;this.expectedShow=null;}
  async connect(){
    if(this.browser?.isConnected())return;
    const {chromium}=await import(PLAYWRIGHT);
    this.browser=await chromium.connectOverCDP(this.endpoint,{timeout:20000});
  }
  async attach(url){
    validateShowUrl(url);await this.connect();
    // Own tab: never navigate, close, or type into the user's live/OBS Tools tab.
    if(this.page&&!this.page.isClosed())await this.page.close();
    this.page=await this.browser.contexts()[0].newPage();
    this.ownsPage=true;
    this.lastTimer=null;this.timerChangedAt=0;
    this.page.setDefaultTimeout(10000);
    await this.page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await this.page.locator('[data-wn-action="seller_live.chat.input"]').waitFor({state:'visible',timeout:25000});
    this.expectedShow=showId(this.page.url());
    if(!this.expectedShow)throw Error('The link did not open a Whatnot show.');
    // The host SPA redirects and replaces the chat box after initial rendering.
    // Require two healthy observations and an advancing timer before declaring ready.
    let previous=null;
    for(let i=0;i<20;i++){
      const snapshot=await this.read();
      if(snapshot.ownerVerified&&snapshot.inputEnabled&&snapshot.liveFresh){
        if(previous&&previous.timer!==snapshot.timer)return snapshot;
        previous=snapshot;
      }else previous=null;
      await this.page.waitForTimeout(1500);
    }
    throw Error('A stable live chat connection for treasure_hauls could not be verified.');
  }
  async read(){
    if(!this.page||this.page.isClosed())throw Error('Show tab is closed. Connect the show again.');
    const sid=showId(this.page.url());
    if(!sid||sid!==this.expectedShow)throw Error('Show tab changed. Connect the correct show again.');
    const data=await this.page.evaluate(()=>{
      const visible=e=>!!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
      const input=document.querySelector('[data-wn-action="seller_live.chat.input"]');
      const timer=document.querySelector('[data-testid="seller-live-elapsed-time"]');
      const rows=[...document.querySelectorAll('[data-testid="seller-live-chat-message"]')];
      const chat=rows.map(e=>{
        const button=[...e.querySelectorAll('button[aria-label]')].find(b=>b.querySelector('strong'));
        const user=button?.textContent?.trim();
        const text=button?.parentElement?.parentElement?.querySelector(':scope > strong')?.textContent?.trim();
        return {user,text};
      }).filter(r=>r.user&&r.text);
      const avatar=document.querySelector('#team-invite-profile-menu-anchor img');
      const account=[...document.querySelectorAll('a[href]')].find(a=>a.textContent.trim()==='@treasure_hauls'&&/\/user\/treasure_hauls\/?$/.test(a.pathname));
      const identity=avatar?avatar.getAttribute('alt')==='treasure_hauls':!!account;
      const title=document.querySelector('h1')?.innerText||document.title.split('·')[0].trim();
      return {ownerVerified:identity&&!!input&&!!timer,inputEnabled:visible(input)&&!input.disabled,timer:timer?.textContent?.trim()||'',title,viewerCount:document.querySelector('[data-testid="seller-live-viewer-chip"]')?.textContent?.trim()||null,chat};
    });
    data.chat=data.chat.map(r=>({...r,user:normalizeUser(r.user)}));
    const now=Date.now();
    if(this.lastTimer!==data.timer){this.lastTimer=data.timer;this.timerChangedAt=now;}
    return {...data,liveFresh:!!this.timerChangedAt&&now-this.timerChangedAt<15000,show:sid,url:this.page.url(),at:now};
  }
  async assertShow(){const s=await this.read();if(!s.ownerVerified||!s.inputEnabled||!s.liveFresh||!/^\d+:\d{2}:\d{2}$/.test(s.timer))throw Error('Live host view is unavailable.');return s;}
  async publicSend(text,guard){
    await this.assertShow();guard();
    const input=this.page.locator('[data-wn-action="seller_live.chat.input"]');
    if(await input.inputValue())throw Error('Chat input contains an existing draft; leaving it untouched.');
    await input.fill(text);guard();
    await input.press('Enter');
    await this.page.waitForFunction(({owner,text})=>[...document.querySelectorAll('[data-testid="seller-live-chat-message"]')].some(e=>{
      const b=[...e.querySelectorAll('button[aria-label]')].find(x=>x.querySelector('strong'));
      return b?.textContent?.trim()===owner&&b?.parentElement?.parentElement?.querySelector(':scope > strong')?.textContent?.trim()===text;
    }),{owner:OWNER,text},{timeout:12000});
  }
  async privateSend(user,text,guard){
    await this.assertShow();guard();
    if(!this.dmPage||this.dmPage.isClosed()){this.dmPage=await this.browser.contexts()[0].newPage();this.ownsDm=true;}
    const p=this.dmPage;p.setDefaultTimeout(12000);
    await p.goto(`https://www.whatnot.com/user/${encodeURIComponent(user)}`,{waitUntil:'domcontentloaded',timeout:25000});
    const profileUrl=new URL(p.url());
    if(profileUrl.origin!=='https://www.whatnot.com'||!profileUrl.pathname.endsWith(`/user/${user}`))throw Error('Recipient profile did not match.');
    const message=p.locator('a[href*="participantId="]').first();
    await message.waitFor({state:'attached',timeout:15000});
    const target=new URL(await message.getAttribute('href'),p.url());
    if(target.origin!=='https://www.whatnot.com'||!/^\/(?:[a-z]{2}-[A-Z]{2}\/)?dashboard\/inbox$/.test(target.pathname))throw Error('Unexpected message destination.');
    await p.goto(target.href,{waitUntil:'domcontentloaded',timeout:25000});
    if(new URL(p.url()).origin!=='https://www.whatnot.com')throw Error('Unexpected inbox origin.');
    const input=p.getByTestId('input-message');await input.waitFor({state:'visible',timeout:20000});
    const matched=await p.locator('a[href]').evaluateAll((es,u)=>es.some(a=>new URL(a.href).pathname.endsWith(`/user/${u}`)),user);
    if(!matched)throw Error('Message recipient could not be verified.');
    if(await input.inputValue())throw Error('Message input contains an existing draft; leaving it untouched.');
    const body=await p.locator('body').innerText();
    if(body.includes(text))throw Error('This message is already visible. No duplicate sent.');
    if(/\b(stop|don'?t|do not|no more|quit)\b.{0,35}\b(dm|dms|messages?|messaging|contact|bot)\b|\bunsubscribe\b/i.test(body.slice(body.lastIndexOf('Profiel bekijken')+1)))throw Error('Possible opt-out in this conversation. Review it manually.');
    await input.fill(text);
    await this.assertShow();guard();
    await p.getByTestId('button-send-message').click();
    await p.waitForFunction(t=>{const i=document.querySelector('[data-testid="input-message"]');return i&&i.value===''&&document.body.innerText.includes(t);},text,{timeout:15000});
  }
  async disconnect(){
    if(this.ownsPage&&this.page&&!this.page.isClosed())await this.page.close().catch(()=>{});
    if(this.ownsDm&&this.dmPage&&!this.dmPage.isClosed())await this.dmPage.close().catch(()=>{});
    if(this.browser)await this.browser.close();this.browser=null;
  }
}
