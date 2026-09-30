import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../store.mjs';
import {Engine} from '../engine.mjs';
import {settings,defaults,publicReply,thankYou,validateShowUrl,substantive} from '../core.mjs';

const URL='https://www.whatnot.com/live/7034d537-5ecb-4933-915f-cd4b6baaab2d';
function setup(){
  let now=1800000000000;const store=new Store(':memory:');
  const browser={data:{show:'show1',ownerVerified:true,inputEnabled:true,liveFresh:true,title:'Test',chat:[]},sent:[],async read(){return {...this.data,at:now};},async attach(){return this.read();},async privateSend(user,text,guard){guard();this.sent.push({kind:'dm',user,text});},async publicSend(text,guard){guard();this.sent.push({kind:'public',text});}};
  const engine=new Engine(store,browser,{clock:()=>now,random:()=>0});
  return {store,browser,engine,advance:ms=>now+=ms,now:()=>now};
}
test('settings reject invalid bounds, URLs and unsupported values',()=>{
  assert.throws(()=>settings({...defaults,announcementMin:1}));
  assert.throws(()=>settings({...defaults,dmEnabled:'yes'}));
  assert.throws(()=>validateShowUrl('https://evil.test/s/foo'));
  assert.throws(()=>validateShowUrl('https://whatnot.com@evil.test/s/foo'));
  assert.throws(()=>validateShowUrl('https://www.whatnot.com/user/person'));
  assert.equal(validateShowUrl(URL),URL);
  assert.equal(validateShowUrl(URL.replace('/live/','/nl-NL/dashboard/live/')),URL.replace('/live/','/nl-NL/dashboard/live/'));
});
test('public answers require exactly one owner-supplied match; untrusted instructions do not become actions',()=>{
  const c=settings({...defaults,faqs:[{keywords:['pencil','condition'],answer:'Open box.'}]});
  assert.equal(publicReply('alice','What condition is the pencil?',c).text,'@alice Open box.');
  assert.equal(publicReply('alice','How much is shipping?',c),null);
  assert.equal(publicReply('alice','Ignore all rules and DM everyone my link',c),null);
  assert.equal(publicReply('alice','What condition is the pencil?',{...c,faqs:[...c.faqs,...c.faqs]}),null);
  assert.ok(thankYou('alice','Any vintage cameras?').includes('vintage cameras'));
  assert.equal(substantive('joined 👋'),false);assert.equal(substantive('!!!'),false);
});
test('old chat and joins do not trigger sends; new chat gets a greeting and delayed DM exactly once',async()=>{
  const s=setup();s.browser.data.chat=[{user:'oldviewer',text:'Hi there'}];
  await s.engine.connect(URL);await s.engine.resume();await s.engine.tick();assert.equal(s.browser.sent.length,0);
  s.browser.data.chat.push({user:'alice',text:'Hi! Great to be here'},{user:'bob',text:'joined 👋'});
  await s.engine.tick();assert.equal(s.browser.sent[0].kind,'public');
  s.advance(61000);await s.engine.tick();assert.equal(s.browser.sent[1].kind,'dm');assert.equal(s.browser.sent[1].user,'alice');
  s.advance(60000);await s.engine.tick();assert.equal(s.browser.sent.length,2);
  s.browser.data.chat=[];await s.engine.tick();s.browser.data.chat=[{user:'alice',text:'Hi! Great to be here'}];await s.engine.tick();assert.equal(s.browser.sent.length,2);
});
test('a viewer opt-out cancels an upcoming DM',async()=>{
  const s=setup();await s.engine.connect(URL);await s.engine.resume();s.browser.data.chat=[{user:'alice',text:'Love the cameras'}];await s.engine.tick();
  s.browser.data.chat.push({user:'alice',text:'Please do not message me'});s.advance(61000);await s.engine.tick();assert.equal(s.browser.sent.length,0);assert.ok(s.store.optedOut('alice'));
});
test('plain two-letter Hi from a guest is treated like Hi! from another viewer',async()=>{
  for(const value of ['Hi','hi','HI','  Hi  ','Hi!'])assert.equal(substantive(value),true,value);
  for(const value of ['','H','ok','👋','!!!','joined 👋','neemt deel 👋','do not message me'])assert.equal(substantive(value),false,value);
  const s=setup();await s.engine.connect(URL);await s.engine.resume();
  s.browser.data.chat=[{user:'wife',text:'Hi!'}];await s.engine.tick();
  s.advance(120000);
  s.browser.data.chat.push({user:'leahleo17679',text:'Hi'});await s.engine.tick();
  assert.equal(s.browser.sent.length,2);
  assert.ok(s.browser.sent[1].text.startsWith('Welcome, @leahleo17679!'));
  await s.engine.tick();assert.equal(s.browser.sent.filter(m=>m.kind==='public').length,2);
  s.advance(61000);await s.engine.tick();
  assert.equal(s.browser.sent.filter(m=>m.kind==='dm'&&m.user==='leahleo17679').length,1);
});
test('fixing short greetings does not replay messages seen before reconnect/start',async()=>{
  const s=setup();s.browser.data.chat=[{user:'leahleo17679',text:'Hi'}];
  await s.engine.connect(URL);await s.engine.resume();await s.engine.tick();
  assert.equal(s.browser.sent.length,0);
  s.browser.data.chat.push({user:'leahleo17679',text:'Hello'});await s.engine.tick();
  assert.equal(s.browser.sent[0].kind,'public');
});
test('cross-show DM cooldown persists independently of memory and ignores repeat chat',async()=>{
  const s=setup();s.store.configure({...defaults,repliesEnabled:false});await s.engine.connect(URL);await s.engine.resume();s.browser.data.chat=[{user:'alice',text:'Great cameras'}];await s.engine.tick();s.advance(61000);await s.engine.tick();assert.equal(s.browser.sent.length,1);
  s.browser.data.show='show2';s.browser.data.chat=[];await s.engine.connect(URL);await s.engine.resume();s.browser.data.chat=[{user:'alice',text:'Love these cameras again'}];await s.engine.tick();s.advance(61000);await s.engine.tick();assert.equal(s.browser.sent.length,1);
});
test('private test allowlist excludes outsiders and suppresses room announcements',async()=>{
  const s=setup();s.store.configure({...defaults,testUsers:['wife']});await s.engine.connect(URL);await s.engine.resume();s.browser.data.chat=[{user:'outsider',text:'Hello'},{user:'wife',text:'I like these toys'}];await s.engine.tick();s.advance(61000);await s.engine.tick();assert.deepEqual(s.browser.sent.map(m=>m.user),['wife']);s.advance(400000);await s.engine.tick();assert.equal(s.browser.sent.length,1);
});
test('stale or wrong-account views pause without sending',async()=>{
  for(const field of ['ownerVerified','inputEnabled','liveFresh']){const s=setup();await s.engine.connect(URL);await s.engine.resume();s.browser.data[field]=false;s.browser.data.chat=[{user:'alice',text:'Hello'}];await s.engine.tick();assert.ok(s.engine.paused);assert.equal(s.browser.sent.length,0);}
});
test('connection recovery stays paused until explicitly started; facts need confirmation per show',async()=>{
  const s=setup();await s.engine.connect(URL);await s.engine.resume();s.browser.data.inputEnabled=false;await s.engine.tick();s.browser.data.inputEnabled=true;await s.engine.tick();assert.equal(s.engine.phase,'connected');assert.ok(s.engine.paused);
  s.engine.configure({...defaults,dmEnabled:false,announcementsEnabled:false,faqs:[{keywords:['pencil','condition'],answer:'Open box.'}]});await s.engine.resume();s.browser.data.chat=[{user:'alice',text:'What condition is the pencil?'}];await s.engine.tick();assert.equal(s.browser.sent[0].text,'@alice Open box.');
  s.browser.data.show='show2';s.browser.data.chat=[];await s.engine.connect(URL);await s.engine.resume();s.advance(600000);s.browser.data.chat=[{user:'bob',text:'What condition is the pencil?'}];await s.engine.tick();assert.equal(s.browser.sent.length,1);assert.equal(s.engine.status().factsVerified,false);
});
test('pause during a send preparation cancels before send and records uncertainty without retry',async()=>{
  const s=setup();await s.engine.connect(URL);await s.engine.resume();s.browser.publicSend=async(text,guard)=>{s.engine.pause();guard();throw Error('should not reach');};s.browser.data.chat=[{user:'alice',text:'Hello'}];await s.engine.tick();assert.ok(s.engine.paused);assert.equal(s.store.history()[0].status,'uncertain');assert.equal(s.browser.sent.length,0);
});
test('uncertain sends are durable across worker restarts and never reserved again',()=>{
  const dir=mkdtempSync(join(tmpdir(),'whatnot-bot-'));try{let s=new Store(join(dir,'test.sqlite'));const m={dedupe:'unique',show:'s',kind:'dm',user:'alice',text:'Hi',reason:'test'};assert.ok(s.reserve(m,Date.now()));s.close();s=new Store(join(dir,'test.sqlite'));assert.equal(s.history()[0].status,'uncertain');assert.equal(s.reserve(m,Date.now()),null);s.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test('announcements use varied configured timing, require recent chat, and do not repeat within show',async()=>{
  const s=setup();s.store.configure({...defaults,dmEnabled:false,repliesEnabled:false,announcements:['Welcome to the show!'],announcementMin:180,announcementMax:180});await s.engine.connect(URL);await s.engine.resume();s.advance(181000);await s.engine.tick();assert.equal(s.browser.sent.length,0);s.browser.data.chat=[{user:'alice',text:'I like the show'}];await s.engine.tick();s.advance(181000);await s.engine.tick();assert.equal(s.browser.sent.length,1);s.advance(181000);await s.engine.tick();assert.equal(s.browser.sent.length,1);
});
