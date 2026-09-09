import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {requireIsolatedServer,totp} from './helpers/owner-session.mjs';
import {PrismaClient} from '@prisma/client';
import {encode} from 'next-auth/jwt';
const base='http://127.0.0.1:3018';
requireIsolatedServer(base);
const p=new PrismaClient(), key=randomUUID(), users=[], leads=[], subscribers=[], tags=[];
let failure;
async function cookie(user,sid=randomUUID()){
 const token=await encode({secret:'security-test-secret-only',salt:'authjs.session-token',
  token:{sub:user.id,email:user.email,sv:0,svAt:Math.floor(Date.now()/1000),authSessionId:sid,authAt:Math.floor(Date.now()/1000)},maxAge:3600});
 return 'authjs.session-token='+token;
}
async function request(path,jar='',method='GET',body,origin=base){
 const response=await fetch(base+path,{method,redirect:'manual',headers:{cookie:jar,origin,'content-type':'application/json'},
  ...(body!==undefined?{body:JSON.stringify(body)}:{})});
 return {response,status:response.status,data:await response.json().catch(()=>null)};
}
try{
 const a=await p.user.create({data:{email:'security-a-'+key+'@example.invalid'}});
 const b=await p.user.create({data:{email:'security-b-'+key+'@example.invalid'}});
 const free=await p.user.create({data:{email:'security-free-'+key+'@example.invalid'}});
 const admin=await p.user.create({data:{email:'security-admin@example.invalid'}});
 users.push(a.id,b.id,free.id,admin.id);
 for(const u of [a,b]){const s=await p.leadSubscriber.create({data:{userId:u.id,status:'active',farmZips:[],farmCities:[],specialties:[],onboarded:true}});subscribers.push(s.id);}
 const source=await p.lead.create({data:{score:80,notes:'operator-private',status:'closed'}});leads.push(source.id);
 const ac=await cookie(a),bc=await cookie(b),fc=await cookie(free),ad=await cookie(admin);
 assert.equal((await request('/api/leads')).status,401);
 assert.equal((await request('/api/leads',fc)).status,403);
 assert.equal((await request('/api/leads',ac,'PATCH',{id:source.id,notes:'A private note',status:'contacted'})).status,200);
 let result=await request('/api/leads',bc);
 assert.equal(result.status,200);assert.equal(result.data.leads.find(l=>l.id===source.id).notes,null);
 assert.equal((await p.lead.findUniqueOrThrow({where:{id:source.id}})).notes,'operator-private');
 assert.equal((await request('/api/leads',ac,'PATCH',{id:source.id,score:999})).status,400);
 result=await request('/api/leads',ac,'POST',{source:'fsbo_manual',notes:'Private manual lead',ownerName:'A contact'});
 assert.equal(result.status,201);leads.push(result.data.id);
 assert.equal((await request('/api/leads',bc,'PATCH',{id:result.data.id,notes:'B must not write'})).status,404);
 assert.equal((await request('/api/leads/crm/tasks',bc,'POST',{title:'Must not link foreign lead',leadId:result.data.id})).status,404);
 assert.equal((await request('/api/leads/crm/deals',bc,'POST',{title:'Must not link foreign lead',leadId:result.data.id})).status,404);
 const tag=await p.tag.create({data:{subscriberId:subscribers[1],name:'Private B tag '+key}});tags.push(tag.id);
 assert.equal((await request('/api/leads/crm/tags/assign',bc,'POST',{tagId:tag.id,leadId:result.data.id})).status,404);
 assert.equal((await request('/api/leads/crm/pipeline',ac,'PATCH',{leadId:source.id,newStage:'interested'})).status,200);
 assert.equal((await request('/api/leads',bc)).data.leads.find(l=>l.id===source.id).status,'new');
 assert.equal((await request('/api/leads',ad)).status,401);
 assert.equal((await request('/api/wd/auth','','POST',{pin:'security-test-admin-only'})).status,401);
 result=await request('/api/auth/mfa/setup',ad,'POST',{});
 assert.equal(result.status,200,JSON.stringify(result.data));const setup=result.data;
 assert.equal((await request('/api/auth/mfa/verify',ad,'POST',{code:totp(setup.secret)},'https://wrong.example')).status,403);
 result=await request('/api/auth/mfa/verify',ad,'POST',{code:totp(setup.secret)});
 assert.equal(result.status,200,JSON.stringify(result.data));
 const proofCookie=result.response.headers.getSetCookie().find(c=>c.startsWith('tolley_mfa=')).split(';')[0];
 const verified=ad+'; '+proofCookie;
 assert.equal((await request('/api/leads',verified)).status,200);
 assert.equal((await request('/api/wd/auth',verified,'POST',{})).status,200);
 assert.equal((await request('/api/leads',(await cookie(admin))+'; '+proofCookie)).status,401,'proof must not transfer between logins');
 assert.equal((await request('/api/auth/mfa/disable',verified,'POST',{code:totp(setup.secret)})).status,403,'owners cannot disable MFA');
 assert.equal((await request('/api/auth/mfa/verify',ad,'POST',{code:totp(setup.secret)})).status,403,'TOTP replay');
 const recoveries=await Promise.all([1,2].map(()=>request('/api/auth/mfa/verify',ad,'POST',{code:setup.backupCodes[0],isBackupCode:true})));
 assert.deepEqual(recoveries.map(r=>r.status).sort(),[200,403],'backup code consumed once');
 console.log('PASS: HTTP unpaid/customer isolation, private manual leads, pipeline isolation, owner enrollment, MFA session binding, PIN bypass rejection, origin checks, TOTP replay and concurrent recovery-code use.');
}catch(error){failure=error;throw error;}finally{
 try {
 await p.tag.deleteMany({where:{id:{in:tags}}});
 await p.lead.deleteMany({where:{id:{in:leads}}});
 await p.customerLeadState.deleteMany({where:{subscriberId:{in:subscribers}}});
 await p.user.deleteMany({where:{id:{in:users}}});
 }catch(error){if(!failure)throw error;}finally{await p.$disconnect();}
}
