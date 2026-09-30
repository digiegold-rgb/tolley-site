const $=id=>document.getElementById(id);let csrf='',loaded=false,config={},snapshot=null,optionsKey='';
const el=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
const showError=e=>{$('notice').textContent=e.message;};
async function action(action,more={}){const r=await fetch('./action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf,action,...more})});const j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');await refresh();return j;}
function renderDecision(d,target){const item=el('div','','item');item.append(el('span',d.action,'badge'),el('strong',d.question||''),el('p',d.text||'Left for the host.'),el('small',`${d.reason}${d.source?' · '+d.source:''}`));target.append(item);}
async function refresh(){
 try{
  const r=await fetch('./snapshot',{cache:'no-store'});if(!r.ok)throw Error(r.status===401?'Sign in to Tolley with your owner account.':'V2 is unavailable');const s=await r.json();snapshot=s;csrf=s.csrf;
  $('notice').textContent=s.error||(!s.paused?'Inventory V2 is running.':'Inventory V2 is paused. You can preview answers without starting.');
  $('connection').textContent=`${s.paused?'Paused':'Running'} · ${s.show?.title||'No show connected'}`;
  $('start').disabled=s.busy||!s.paused||s.phase!=='connected'||!s.inventory?.ready;
  const inv=s.inventory;$('inventory').textContent=inv?.counts?`${inv.counts.listed} listed · ${inv.counts.draft} drafts · ${inv.counts.unavailable} sold/unavailable`:'Inventory not loaded';
  $('freshness').textContent=`${inv?.ready?'Fresh':'Not ready'}${inv?.generatedAt?' · refreshed '+new Date(inv.generatedAt).toLocaleTimeString():''} · ${inv?.model||''}${inv?.error?' · '+inv.error:''}`;
  const key=JSON.stringify(inv?.lineups||[]);if(key!==optionsKey){optionsKey=key;const current=$('lineup').value;$('lineup').replaceChildren(el('option','Backstock only — no show lineup confirmed'));$('lineup').firstChild.value='';for(const l of inv?.lineups||[]){const o=el('option',`${l.name} (${l.count} items)`);o.value=l.slug;$('lineup').append(o);}$('lineup').value=current;}
  $('binding').textContent=s.binding?`Confirmed: ${s.binding.slug} for show ${s.binding.show}`:'No lineup confirmed for this show; answers will not claim an item is in tonight’s lineup.';
  if(!loaded){config=s.settings;for(const k of ['repliesEnabled','dmEnabled','announcementsEnabled'])$(k).checked=config[k];$('announcements').value=config.announcements.join('\n');$('faqs').value=config.faqs.map(f=>f.keywords.join(', ')+' | '+f.answer).join('\n');for(const k of ['testUsers','excludedUsers'])$(k).value=config[k].join(', ');loaded=true;}
  $('decisions').replaceChildren();for(const d of s.decisions||[])renderDecision(d,$('decisions'));if(!s.decisions?.length)$('decisions').append(el('p','Product-question decisions appear here once V2 is running.','muted'));
  $('history').replaceChildren();for(const m of s.messages||[]){const item=el('div','','item');item.append(el('span',m.status,'badge '+m.status),el('strong',m.kind==='dm'?'DM · @'+m.user:'Public chat'),el('p',m.text),el('small',m.reason));$('history').append(item);}
 }catch(e){showError(e);$('start').disabled=true;}
}
$('pause').onclick=()=>action('pause').catch(showError);
$('start').onclick=()=>action('start').catch(showError);
$('refresh').onclick=()=>action('refresh').catch(showError);
$('connect-form').onsubmit=e=>{e.preventDefault();action('connect',{url:$('show-url').value}).catch(showError);};
$('lineup-form').onsubmit=e=>{e.preventDefault();action('lineup',{slug:$('lineup').value}).catch(showError);};
$('preview-form').onsubmit=async e=>{e.preventDefault();$('preview-button').disabled=true;try{const j=await action('preview',{question:$('question').value});$('answer').replaceChildren();renderDecision(j.preview,$('answer'));}catch(e){showError(e);}finally{$('preview-button').disabled=false;}};
$('settings-form').onsubmit=async e=>{e.preventDefault();try{const c={...config};for(const k of ['repliesEnabled','dmEnabled','announcementsEnabled'])c[k]=$(k).checked;c.announcements=$('announcements').value.split('\n').map(x=>x.trim()).filter(Boolean);c.faqs=$('faqs').value.split('\n').filter(x=>x.trim()).map(x=>{const i=x.indexOf('|');if(i<1)throw Error('Use matching words | verified answer');return {keywords:x.slice(0,i).split(',').map(x=>x.trim()),answer:x.slice(i+1).trim()};});for(const k of ['testUsers','excludedUsers'])c[k]=$(k).value.split(',').map(x=>x.trim()).filter(Boolean);await action('settings',{settings:c});config=c;$('saved').textContent='Saved';}catch(e){showError(e);}};
await refresh();setInterval(refresh,3000);
