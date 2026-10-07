/** Cloud acceptance: default is CPU-only; --generate runs one fal and one Modal fixture. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { ModalClient } from "modal";
import { connectedTikTokAccounts, pollRender, readSavedResult, readVideo, spawnRender, workerHealth } from "../lib/shop-video/cloud";
import { RECIPE_VERSION, WORKER_APP } from "../lib/shop-video/core";
async function main(){
  if(process.argv.includes("--check")){
    const call=process.argv[process.argv.indexOf("--check")+1];
    console.log(JSON.stringify({savedCallResult:await pollRender(call)}));return;
  }
  const health=await workerHealth();assert.equal(health.ready,true);assert.equal(health.fal,true);assert.equal(health.version,RECIPE_VERSION);
  const accounts=await connectedTikTokAccounts();assert.ok(accounts.length);console.log(JSON.stringify({health,connectedTikTokAccounts:accounts.map(a=>a.username)}));
  if(process.argv.includes("--dispatch-only")){
    const id=`dispatch-smoke-${randomUUID()}`;
    const call=await spawnRender({job_id:id,provider:"modal",recipe_version:"invalid-test-recipe"});
    let result;const deadline=Date.now()+60000;
    while(Date.now()<deadline){result=await pollRender(call);if(result)break;await new Promise(r=>setTimeout(r,1000));}
    assert.equal(result?.status,"failed");assert.equal(result?.providerEstimateCents,0);assert.deepEqual(result?.receipts,[]);
    assert.deepEqual(await readSavedResult(id),result);
    console.log(JSON.stringify({serialModalDispatch:"passed",paidProviderCalls:0,durableResult:"passed"}));return;
  }
  const c=new ModalClient({tokenId:process.env.MODAL_TOKEN_ID!,tokenSecret:process.env.MODAL_TOKEN_SECRET!});
  const fn=await c.functions.fromName(WORKER_APP,"assembly_smoke");
  const assembled=await fn.remote([],{}) as {job_id:string;size:number;duration:number;width:number;height:number};
  assert.equal(assembled.duration,8);assert.equal(assembled.width,1080);assert.equal(assembled.height,1920);
  const head=await readVideo(assembled.job_id,0,31);assert.equal(head.length,32);assert.equal(head.subarray(4,8).toString(),"ftyp");
  assert.equal(await readSavedResult("never-submitted-test-job"),null);
  console.log(JSON.stringify({cpuAssembly:assembled,byteRange:"32 bytes; valid MP4"}));
  if(!process.argv.includes("--generate"))return;
  const fixture=process.argv[process.argv.indexOf("--generate")+1];if(!fixture)throw new Error("--generate requires an owned test image path");
  const blob=await put(`shop-video-inputs/acceptance-${randomUUID()}.png`,await readFile(fixture),{access:"public",contentType:"image/png"});
  const selected=process.argv.includes("--fal-only")?["fal"]:process.argv.includes("--modal-only")?["modal"]:["fal","modal"];
  const reports=await Promise.allSettled(selected.map(async provider=>{
    const id=`acceptance-${provider}-${randomUUID()}`;
    const edit=provider==="fal"&&!process.argv.includes("--original");
    const call=await spawnRender({job_id:id,recipe_version:RECIPE_VERSION,provider,format:"boomerang",scene:edit?"studio":"original",overlay:"Cloud render test · not a product advertisement",allowance_cents:provider==="fal"?(edit?8:5):150,product:{imageUrl:blob.url,rightsConfirmed:true,authenticityConfirmed:true}});
    console.log(JSON.stringify({provider,jobId:id,callId:call,status:"submitted"}));
    const deadline=Date.now()+25*60000;let result;
    while(Date.now()<deadline){result=await pollRender(call);if(result)break;await new Promise(r=>setTimeout(r,10000));}
    assert.equal(result?.status,"ready",`${provider}: ${result?.error||"timeout"}`);
    assert.equal(result?.duration,8);assert.equal(result?.width,1080);assert.equal(result?.height,1920);
    assert.deepEqual(await readSavedResult(id),result);
    const bytes=await readVideo(id,0,31);assert.equal(bytes.subarray(4,8).toString(),"ftyp");
    return {provider,jobId:id,...result};
  }));
  console.log(JSON.stringify({generationAcceptance:reports.map(r=>r.status==="fulfilled"?r:{status:r.status,error:r.reason instanceof Error?r.reason.message:String(r.reason)})}));
  if(reports.some(r=>r.status==="rejected"))throw new Error("A cloud generation acceptance check failed; inspect the reported result");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
