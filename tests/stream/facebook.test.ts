import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../lib/prisma';
import { facebookReel } from '../../lib/live/publish';
import { postFacebook } from '../../lib/social/facebook';
const input={id:'test',source:'stream',accountId:'test-page',mediaType:'video' as const,mediaUrl:'https://media.example.test/clip.mp4',caption:'Past show',title:'Test',hashtags:[]};
test('stream Facebook never falls through generic account routing',async()=>{assert.equal((await postFacebook(input)).ok,false)});
test('Facebook Reel persists identity before upload and uses dedicated finish operation',async()=>{
 if(!process.env.DATABASE_URL?.endsWith('/tolley_live_growth_test')) throw new Error('Test DB required');
 await prisma.platformConnection.upsert({where:{subscriberId_platform_platformAccountId:{subscriberId:'social-suite',platform:'facebook_page:test-page',platformAccountId:'test-page'}},create:{subscriberId:'social-suite',platform:'facebook_page:test-page',platformAccountId:'test-page',accessToken:'test-only',status:'active'},update:{}});
 const original=globalThis.fetch;let checkpoint='';const calls:string[]=[];
 globalThis.fetch=async(url,options)=>{const u=String(url);calls.push(u);if(u.includes('?fields=id'))return Response.json({id:'test-page'});if(String(options?.body).includes('upload_phase=start'))return Response.json({video_id:'remote-id',upload_url:'https://rupload.facebook.com/video-upload/test'});if(u.includes('rupload.')){assert.equal(checkpoint,'remote-id');return Response.json({success:true});}assert.match(String(options?.body),/upload_phase=finish/);assert.match(String(options?.body),/video_state=PUBLISHED/);return Response.json({success:true});};
 try{const r=await facebookReel(input,'test-page',async id=>{checkpoint=id});assert.equal(r.externalId,'remote-id');assert.equal(calls.length,4);}finally{globalThis.fetch=original;await prisma.platformConnection.deleteMany({where:{platform:'facebook_page:test-page'}})}
});
after(()=>prisma.$disconnect());
