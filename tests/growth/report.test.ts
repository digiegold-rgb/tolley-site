import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '../../lib/prisma';
import {growthReport} from '../../lib/growth/report';
import {centralDate} from '../../lib/live/campaign';
if(!process.env.DATABASE_URL?.endsWith('/tolley_growth_hq_test'))throw Error('Disposable growth DB required');
const ids=['visual-report-post','visual-report-queued','visual-report-click','visual-report-impact'];
test('daily chart counts published records, separates affiliate events, and uses Central dates',async()=>{
 const date=new Date();date.setUTCDate(date.getUTCDate()-1);date.setUTCHours(2,0,0,0);
 const before=await growthReport('7');
 try{
 await prisma.liveCampaignPost.create({data:{id:ids[0],kind:'preview',platform:'facebook',accountId:'fixture',caption:'Fixture post',status:'posted',dueAt:date,expiresAt:new Date(+date+3600000),createdAt:date,updatedAt:date}});
 await prisma.liveCampaignPost.create({data:{id:ids[1],kind:'preview',platform:'facebook',accountId:'fixture',caption:'Fixture queue',status:'queued',dueAt:date,expiresAt:new Date(+date+3600000),createdAt:date,updatedAt:date}});
 await prisma.siteEvent.createMany({data:[{id:ids[2],site:'live',path:'/go/show',event:'show_click',createdAt:date},{id:ids[3],site:'live',path:'/go/show',event:'impact_click',createdAt:date}]});
 const after=await growthReport('7'),day=centralDate(date);
 const previous=before.daily.find(d=>d.day===day),current=after.daily.find(d=>d.day===day)!;
 assert.equal(current.posts-(previous?.posts||0),1);
 assert.equal(current.clicks-(previous?.clicks||0),1);
 assert.notEqual(day,date.toISOString().slice(0,10));
 }finally{await prisma.liveCampaignPost.deleteMany({where:{id:{in:ids}}});await prisma.siteEvent.deleteMany({where:{id:{in:ids}}});}
});after(()=>prisma.$disconnect());
