import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorized } from '@/lib/customer-history/sync-auth';
import { ackSchema,snapshotSchema } from '@/lib/beeper/contracts';
import { key,obj,save } from '@/lib/beeper/store';
export const dynamic='force-dynamic';
export const maxDuration=60;
const reply=(b:unknown,status=200)=>NextResponse.json(b,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 if(!authorized(req))return reply({error:'Unauthorized'},401);
 const rows=await prisma.hqSyncState.findMany({where:{id:{startsWith:'beeper:cmd:'},OR:[{meta:{path:['status'],equals:'queued'}},{meta:{path:['status'],equals:'processing'}}]},orderBy:{lastAttemptAt:'asc'},take:50});
 return reply({commands:rows.map(r=>r.meta)});
}
export async function POST(req:Request){
 if(!authorized(req))return reply({error:'Unauthorized'},401);
 const raw=await req.text();if(raw.length>2500000)return reply({error:'Too large'},413);
 let b;try{b=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400);}
 if(!b||typeof b!=='object')return reply({error:'Invalid request'},400);
 if(b.type==='claim'){
  const parsed=ackSchema.pick({id:true}).safeParse(b);if(!parsed.success)return reply({error:'Invalid claim'},400);
  const id=`beeper:cmd:${parsed.data.id}`;const row=await prisma.hqSyncState.findUnique({where:{id}});if(!row)return reply({error:'Unknown command'},404);
  const updated=await prisma.hqSyncState.updateMany({where:{id,meta:{path:['status'],equals:'queued'}},data:{meta:{...obj(row.meta),status:'processing',claimedAt:new Date().toISOString()}}});
  return reply({claimed:updated.count===1});
 }
 if(b.type==='ack'){
  const p=ackSchema.safeParse(b);if(!p.success)return reply({error:'Invalid acknowledgement'},400);
  const id=`beeper:cmd:${p.data.id}`;const row=await prisma.hqSyncState.findUnique({where:{id}});if(!row)return reply({error:'Unknown command'},404);
  await prisma.hqSyncState.updateMany({where:{id,OR:[{meta:{path:['status'],equals:'queued'}},{meta:{path:['status'],equals:'processing'}}]},data:{meta:{...obj(row.meta),status:p.data.status,detail:p.data.detail,completedAt:new Date().toISOString()}}});
  return reply({ok:true});
 }
 const parsed=snapshotSchema.safeParse(b);if(!parsed.success)return reply({error:'Invalid snapshot'},400);
 const s=parsed.data;
 for(const chat of s.chats)await save(key('chat',chat.id),chat);
 await save('beeper:status',{paused:s.paused,healthy:s.healthy,error:s.error});
 return reply({ok:true});
}
