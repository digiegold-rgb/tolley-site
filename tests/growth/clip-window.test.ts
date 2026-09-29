import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '../../lib/prisma';
import {matchShowForClip} from '../../lib/live/publish';
if(!process.env.DATABASE_URL?.endsWith('/tolley_growth_hq_test')) throw Error('Fixture DB required');
test('a schedule lease cannot authorize footage; a confirmed live window can',async()=>{
 const start=new Date('2026-01-01T01:00:00Z'),end=new Date('2026-01-01T02:00:00Z');
 const show=await prisma.liveShow.create({data:{title:'Schedule lease fixture',category:'Electronics',startsAt:start,confirmedUntil:end,whatnotUrl:'https://www.whatnot.com/live/test',status:'confirmed',durationMin:60}});
 assert.equal(await matchShowForClip(start.toISOString(),10,40),null);
 await prisma.liveShow.update({where:{id:show.id},data:{status:'live',liveStartedAt:start}});
 assert.equal(await matchShowForClip(start.toISOString(),10,40),show.id);
 await prisma.liveShow.update({where:{id:show.id},data:{status:'ended',endedAt:new Date(+start+20000)}});
 assert.equal(await matchShowForClip(start.toISOString(),10,40),null);
 await prisma.liveShow.delete({where:{id:show.id}});
});after(()=>prisma.$disconnect());
