import {OWNER,eligible,isOptOut,substantive,thankYou,publicReply,randomDelay,hash,validateShowUrl} from './core.mjs';

export class Engine {
  constructor(store,browser,{clock=Date.now,random=Math.random,inventory=null,classicStatus=async()=>({paused:true})}={}){
    this.inventory=inventory;this.classicStatus=classicStatus;this.binding=null;this.decisions=[];
    this.store=store;this.browser=browser;this.clock=clock;this.random=random;
    this.paused=true;this.phase='disconnected';this.error='';this.epoch=0;this.busy=false;
    this.snapshot=null;this.lastViewerChat=0;this.nextAnnouncement=0;this.pending=new Map();this.replies=new Map();this.startedAt=0;
  }
  status(){return {version:2,inventory:this.inventory?.summary()||null,binding:this.binding,decisions:this.decisions.slice(-60).reverse(),replyIntervalSeconds:60,paused:this.paused,phase:this.phase,error:this.error,busy:this.busy,show:this.snapshot,startedAt:this.startedAt,nextAnnouncement:this.nextAnnouncement,pendingDms:this.pending.size,settings:this.store.config(),factsVerified:!!this.snapshot&&this.store.factsShow()===this.snapshot.show,excluded:this.store.optouts(),messages:this.store.history(),events:this.store.events(this.snapshot?.show)};}
  pause(reason='Paused by owner.'){this.paused=true;this.epoch++;this.error=reason;this.pending.clear();this.replies.clear();}
  async connect(url){
    validateShowUrl(url);
    if(this.busy)throw Error('An operation is finishing. Please wait.');
    this.pause('');this.inventory?.reset();this.binding=null;this.busy=true;this.phase='connecting';this.snapshot=null;
    try{
      const s=await this.browser.attach(url);this.snapshot=s;
      const now=this.clock();for(const e of s.chat)this.store.event(s.show,e.user,e.text,now,true);
      this.phase='connected';this.error='Connected. Start the assistant when you are ready.';
      this.nextAnnouncement=now+randomDelay(this.store.config(),this.random);
    }catch(e){this.phase='error';this.error=e.message;throw e;}finally{this.busy=false;}
  }
  async resume(){
    const classic=await this.classicStatus();if(!classic.paused)throw Error("Classic is running. Pause Classic before starting Inventory V2.");
    const now=this.clock(),s=this.snapshot;
    if(this.busy||this.phase!=='connected'||!s?.ownerVerified||!s.inputEnabled||!s.liveFresh||now-s.at>12000)throw Error('Connect a live show and wait for a fresh observation first.');
    this.paused=false;this.error='';this.epoch++;this.startedAt=now;
    this.pending.clear();this.replies.clear();this.lastViewerChat=0;this.nextAnnouncement=now+randomDelay(this.store.config(),this.random);
    // Messages already visible before Start are not new interaction triggers.
    for(const e of s.chat)this.store.event(s.show,e.user,e.text,now,true);
  }
  configure(c){const result=this.store.configure(c);this.store.verifyFacts(this.snapshot?.show);this.epoch++;this.pending.clear();this.replies.clear();this.nextAnnouncement=this.clock()+randomDelay(result,this.random);return result;}
  async tick(){
    if(this.busy||!this.snapshot)return;
    this.busy=true;
    try{
      if(!this.paused&&!(await this.classicStatus()).paused){this.pause("Classic is running; Inventory V2 paused to prevent duplicate replies.");return;}
      const now=this.clock(),s=await this.browser.read();this.snapshot=s;
      if(!s.ownerVerified||!s.inputEnabled||!s.liveFresh){this.phase='unavailable';this.pause('Live chat is unavailable or stale. Sending is paused.');return;}
      if(this.phase==='unavailable'||this.phase==='error')this.error='Connection recovered. Sending remains paused; press Start when ready.';
      this.phase='connected';
      const c=this.store.config();
      const newEvents=[];
      for(const r of s.chat){
        const e=this.store.event(s.show,r.user,r.text,now,this.paused);
        if(isOptOut(r.text)&&r.user!==OWNER){this.store.optOut(r.user,now);this.pending.delete(r.user);}
        if(e&&!this.paused&&eligible(r.user,c)&&!this.store.optedOut(r.user)&&substantive(r.text)){
          newEvents.push(e);this.lastViewerChat=now;
          if(c.repliesEnabled)this.replies.set(e.id,e);
          if(c.dmEnabled&&!this.pending.has(r.user))this.pending.set(r.user,{event:e,due:now+c.dmDelay*1000});
        }
      }
      if(this.paused)return;
      if(now-this.startedAt>8*3600000){this.pause('Eight-hour session ended. Start again for a new show.');return;}
      // Responses take precedence over scheduled announcements and DMs.
      if(c.repliesEnabled&&now-this.store.last('public')>=60000&&this.store.count('public',now-3600000)<40){
        for(const [id,e] of this.replies){
          this.replies.delete(id);
          if(now-e.observed>120000||!eligible(e.user,c)||this.store.optedOut(e.user))continue;
          const epoch=this.epoch;
          const reply=await this.replyFor(e,{...c,faqs:this.store.factsShow()===s.show?c.faqs:[]});
          if(this.paused||epoch!==this.epoch)return;
          if(reply&&!reply.evidence&&this.store.recent('public',e.user,now-300000))continue;
          if(reply){await this.send({kind:'public',user:e.user,show:s.show,text:reply.text,reason:reply.reason,evidence:reply.evidence,dedupe:hash(s.show,'reply',e.id)});return;}
          break; // One inventory interpretation per tick; do not drain a room of questions at once.
        }
      }
      if(c.announcementsEnabled&&now>=this.nextAnnouncement){
        this.nextAnnouncement=now+randomDelay(c,this.random);
        // A quiet chat with no recent participant activity does not get repeated posts.
        if(!c.testUsers.length&&now-this.lastViewerChat<600000&&now-this.store.last('public')>=90000){
          const pool=c.announcements.filter(t=>!this.store.has(hash(s.show,'announcement',t)));
          if(pool.length){const text=pool[Math.floor(this.random()*pool.length)];await this.send({kind:'public',user:'',show:s.show,text,reason:'Scheduled announcement',dedupe:hash(s.show,'announcement',text)});return;}
        }
      }
      if(c.dmEnabled&&now-this.store.last('dm')>=30000&&this.store.count('dm',now-3600000)<60){
        for(const [user,p] of this.pending){
          if(p.due>now)continue;
          this.pending.delete(user);
          if(now-p.event.observed>600000||!eligible(user,c)||this.store.optedOut(user)||this.store.recent('dm',user,now-c.dmCooldownDays*86400000))continue;
          await this.send({kind:'dm',user,show:s.show,text:thankYou(user,p.event.text),reason:`Chat: ${p.event.text.slice(0,180)}`,dedupe:hash(s.show,'thank-you',user)});return;
        }
      }
    }catch(e){this.phase='error';this.pause(`Connection or send stopped: ${e.message}`);}finally{this.busy=false;}
  }
  async replyFor(e,c){
    const basic=publicReply(e.user,e.text,c);
    if(basic)return basic;
    if(!this.inventory)return null;
    const result=await this.inventory.answer(e.text,{user:e.user,show:e.show,binding:this.binding});
    this.decisions.push({at:this.clock(),user:e.user,question:e.text,...result});
    this.decisions=this.decisions.slice(-100);
    return result.text?{text:`@${e.user} ${result.text}`.slice(0,500),reason:`Inventory V2: ${result.reason}`,evidence:result.evidence} : null;
  }
  bindLineup(slug){
    if(!this.snapshot?.show)throw Error('Connect a show before selecting its lineup');
    if(!this.inventory?.fresh())throw Error('Refresh inventory before selecting a lineup');
    if(slug&&!this.inventory.data.lineups.some(l=>l.slug===slug))throw Error('Unknown lineup');
    this.epoch++;this.replies.clear();this.binding=slug?{slug,show:this.snapshot.show}:null;this.inventory.reset();
  }
  async send(m){
    const epoch=this.epoch;
    const guard=()=>{
      const c=this.store.config();
      if(this.paused||this.epoch!==epoch||this.snapshot?.show!==m.show)throw Error('Send cancelled after settings/session changed.');
      if(m.user&&(!eligible(m.user,c)||this.store.optedOut(m.user)))throw Error('Recipient excluded.');
      if(m.kind==='dm'&&!c.dmEnabled)throw Error('DM sending is disabled.');
      if(m.evidence&&!this.inventory?.validEvidence(m.evidence))throw Error('Inventory changed or expired before sending; host review required.');

      if(m.kind==='public'&&!(m.user?c.repliesEnabled:c.announcementsEnabled))throw Error('Public sending is disabled.');
    };
    if(!(await this.classicStatus()).paused)throw Error("Classic is running; Inventory V2 sending stopped.");
    if(m.evidence)await this.inventory.refresh();
    guard();if(m.kind==='public'&&(this.clock()-this.store.last('public')<60000||this.store.count('public',this.clock()-3600000)>=40))return;
    const id=this.store.reserve(m,this.clock());if(!id)return;
    try{
      if(m.kind==='dm')await this.browser.privateSend(m.user,m.text,guard);
      else await this.browser.publicSend(m.text,guard);
      this.store.finish(id,'sent','',this.clock());
    }catch(e){this.store.finish(id,'uncertain',e.message,this.clock());throw e;}
  }
}
