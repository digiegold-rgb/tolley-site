import http from 'node:http';
import {readFileSync} from 'node:fs';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {SharedStore} from './shared-history.mjs';
import {Engine} from './engine.mjs';
import {WhatnotBrowser} from './browser.mjs';
import {Inventory} from './inventory.mjs';
import {normalizeUser,validUser,validateShowUrl} from './core.mjs';
const HERE=dirname(fileURLToPath(import.meta.url));

export async function classicStatus(){
  const r=await fetch('http://127.0.0.1:8111/snapshot',{signal:AbortSignal.timeout(2500)});
  if(!r.ok)throw Error('Cannot verify Classic status; V2 sending stays paused');
  const s=await r.json();return {paused:s.paused,phase:s.phase};
}
export function createServer(engine,{port=8112,csrf=randomBytes(32).toString('hex')}={}){
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};
  const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
  let previewBusy=false;
  return http.createServer(async(req,res)=>{
    const send=(code,obj)=>{res.writeHead(code,{...headers,'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
    try{
      if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return send(403,{error:'Invalid host'});
      const path=new URL(req.url,`http://127.0.0.1:${port}`).pathname;
      if(req.method==='GET'&&['/admin','/admin.js','/admin.css'].includes(path)){
        const file=path==='/admin'?'admin.html':path.slice(1);
        res.writeHead(200,{...headers,'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});return res.end(readFileSync(join(HERE,'web',file)));
      }
      if(req.method==='GET'&&path==='/snapshot')return send(200,{...engine.status(),csrf});
      if(req.method!=='POST'||path!=='/action')return send(404,{error:'Not found'});
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>24000)return send(413,{error:'Request too large'});}
      const body=JSON.parse(raw);if(!equal(body.csrf,csrf))return send(403,{error:'Refresh the page before making changes.'});
      switch(body.action){
        case 'connect':
          if(engine.busy)throw Error('An operation is finishing. Please wait.');validateShowUrl(body.url);
          engine.connect(body.url).catch(()=>{});return send(202,{ok:true});
        case 'start':await engine.inventory.refresh();if(!engine.inventory.fresh())throw Error('Inventory must be fresh before starting V2');await engine.resume();break;
        case 'pause':engine.pause();break;
        case 'settings':engine.configure(body.settings);break;
        case 'lineup':await engine.inventory.refresh();engine.bindLineup(String(body.slug||''));break;
        case 'refresh':await engine.inventory.refresh();break;
        case 'preview':{
          if(previewBusy)throw Error('An answer preview is already running');
          const question=String(body.question||'').trim();if(!question||question.length>500)throw Error('Enter a question up to 500 characters');
          previewBusy=true;
          try{return send(200,{ok:true,preview:await engine.inventory.answer(question,{user:'owner-preview',show:engine.snapshot?.show||'preview',binding:engine.binding})});}
          finally{previewBusy=false;}
        }
        case 'exclude':{const user=normalizeUser(body.user);if(!validUser(user))throw Error('Invalid username');engine.store.optOut(user,Date.now());engine.pending.delete(user);engine.epoch++;break;}
        default:return send(400,{error:'Unknown action'});
      }
      send(200,{ok:true});
    }catch(e){send(400,{error:e.message||'Invalid request'});}
  });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const root=join(homedir(),'.local/state/tolley-inventory-assistant');
  const store=new SharedStore(process.env.WHATNOT_BOT_V2_DB||join(root,'bot.sqlite3'),join(homedir(),'.local/state/tolley-whatnot-bot/bot.sqlite3'));
  const inventory=new Inventory({path:process.env.ASSISTANT_CATALOG||join(root,'catalog.json')});await inventory.refresh();
  const browser=new WhatnotBrowser();const engine=new Engine(store,browser,{inventory,classicStatus});
  const server=createServer(engine);server.listen(8112,'127.0.0.1',()=>console.log('Inventory V2 ready; sending paused'));
  const timer=setInterval(()=>engine.tick(),3000),refresh=setInterval(()=>inventory.refresh(),30000);
  for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{engine.pause('Worker stopping');clearInterval(timer);clearInterval(refresh);server.close();browser.disconnect().catch(()=>{}).finally(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
}
