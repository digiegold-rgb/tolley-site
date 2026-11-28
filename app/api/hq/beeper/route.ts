import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateWdAdmin } from '@/lib/wd-auth';
import { chatSchema, commandSchema, noteSchema } from '@/lib/beeper/contracts';
import { key,obj,save } from '@/lib/beeper/store';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET() {
 if(!(await validateWdAdmin()).authed)return reply({error:'Unauthorized'},401);
 const [state,rows,notes,commands]=await Promise.all([
 prisma.hqSyncState.findUnique({where:{id:'beeper:status'}}),
 prisma.hqSyncState.findMany({where:{id:{startsWith:'beeper:chat:'}},orderBy:{lastSuccessAt:'desc'},take:200}),
 prisma.hqSyncState.findMany({where:{id:{startsWith:'beeper:note:'}},take:1000}),
 prisma.hqSyncState.findMany({where:{id:{startsWith:'beeper:cmd:'}},orderBy:{lastAttemptAt:'desc'},take:50})]);
 const byID=new Map(notes.map(n=>[obj(n.meta).chatId,n.meta]));
 return reply({state:state?{...obj(state.meta),syncedAt:state.lastSuccessAt}:null,chats:rows.flatMap(r=>{const p=chatSchema.safeParse(r.meta);return p.success?[{...p.data,note:byID.get(p.data.id)||null,syncedAt:r.lastSuccessAt}]:[];}),commands:commands.map(c=>c.meta)});
}
export async function POST(req:Request) {
 if(!(await validateWdAdmin()).authed)return reply({error:'Unauthorized'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Forbidden'},403);
 const raw=await req.text();if(raw.length>30000)return reply({error:'Too large'},413);
 let b;try{b=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400);}
 if(b.action==='save'){
  const parsed=noteSchema.safeParse(b);if(!parsed.success)return reply({error:'Invalid notes'},400);
  const n=parsed.data;
  if(!await prisma.hqSyncState.findUnique({where:{id:key('chat',n.chatId)}}))return reply({error:'Unknown conversation'},404);
  if(n.customerId&&!await prisma.hqCustomer.findFirst({where:{id:n.customerId,deletedAt:null}}))return reply({error:'Unknown customer'},400);
  await save(key('note',n.chatId),n);return reply({ok:true});
 }
 const p=commandSchema.safeParse(b);if(!p.success)return reply({error:'Invalid command'},400);
 const c=p.data;const id=`beeper:cmd:${c.requestId}`;
 const existing=await prisma.hqSyncState.findUnique({where:{id}});
 if(existing){const old=obj(existing.meta);if(old.action!==c.action||old.chatId!==c.chatId||old.text!==c.text)return reply({error:'Request ID reused'},409);return reply({ok:true,command:old});}
 const row=c.chatId?await prisma.hqSyncState.findUnique({where:{id:key('chat',c.chatId)}}):null;
 if(c.chatId&&!row)return reply({error:'Unknown conversation'},404);
 if(c.action==='send'){
  const state=await prisma.hqSyncState.findUnique({where:{id:'beeper:status'}});
  if(!state?.lastSuccessAt||Date.now()-state.lastSuccessAt.getTime()>90000||!obj(state.meta).healthy)return reply({error:'Connector offline. Wait for a fresh sync before sending.'},409);
  const chat=chatSchema.parse(row!.meta);
  if(chat.messages.at(-1)?.id!==c.expectedMessageId)return reply({error:'Conversation changed. Refresh before sending.'},409);
 }
 const command={...c,id:c.requestId,status:'queued',createdAt:new Date().toISOString(),...(c.action.startsWith('listing-')?{listing:obj(row?.meta).listing}:{})};
 // Create-only makes repeated HTTP submissions idempotent, including concurrent clicks.
 try{await prisma.$transaction(async tx=>{
  if(c.action==='send')await tx.hqSyncState.create({data:{id:key('sendlock',`${c.chatId}:${c.expectedMessageId}`),meta:{commandId:c.requestId},lastAttemptAt:new Date()}});
  await tx.hqSyncState.create({data:{id,meta:command,lastAttemptAt:new Date()}});
 });}catch(e){if(!(e instanceof Error)||!('code'in e)||e.code!=='P2002')throw e;return reply({error:'A reply is already queued for this conversation version. Refresh and check its status.'},409);}
 return reply({ok:true,command},202);
}
