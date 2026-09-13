import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { captureRemineProperty, farmProperty } from "./leads-mls-parser.mjs";
import { mlsCaptureSchema, scoreMlsCapture } from "../../lib/leads/mls-research.ts";

const stateDir=process.env.MLS_DESK_STATE_DIR||"/home/jelly/.local/state/leads-mls";
const publish=process.argv.includes("--publish");
const regions=[{south:38.98,north:39.16,west:-94.47,east:-94.26},{south:38.88,north:39.4,west:-94.85,east:-94.40}];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
class LoginRequired extends Error {}

async function authenticate(page) {
  await page.goto("https://hmls.remine.com/discover",{waitUntil:"domcontentloaded",timeout:30000}).catch(e=>{if(!String(e.message).includes("interrupted by another navigation"))throw e;});
  try{await page.locator("#remine-smarter-search").waitFor({timeout:12000});return;}catch{}
  await page.goto("https://heartland.clareity.net/launch?layoutid=38&appid=4218",{waitUntil:"domcontentloaded",timeout:30000}).catch(e=>{if(!String(e.message).includes("interrupted by another navigation"))throw e;});
  await delay(2000);
  if(await page.locator("#username").isVisible().catch(()=>false)) {
    if(!process.env.MLS_USERNAME||!process.env.MLS_PASSWORD)throw new LoginRequired();
    await page.locator("#username").fill(process.env.MLS_USERNAME);
    await page.locator("#password").fill(process.env.MLS_PASSWORD);
    await page.getByRole("button",{name:"Password Login",exact:true}).click();
  }
  try{await page.waitForURL(u=>u.hostname==="hmls.remine.com",{timeout:20000});await page.locator("#remine-smarter-search").waitFor({timeout:20000});}
  catch{throw new LoginRequired();}
}
async function report(payload) {
  await mkdir(stateDir,{recursive:true,mode:0o700});
  await writeFile(resolve(stateDir,"latest.json"),JSON.stringify(payload,null,2),{mode:0o600});
  if(!publish)return;
  if(!process.env.SYNC_SECRET)throw new Error("Missing ingest credential");
  const base=process.env.TOLLEY_API_URL||"https://www.tolley.io";
  if(!["https://www.tolley.io","http://127.0.0.1:3018"].includes(base))throw new Error("Unexpected ingest destination");
  for(let attempt=0;attempt<2;attempt++) {
    try{const r=await fetch(`${base}/api/leads/mls-ingest`,{method:"POST",redirect:"error",headers:{"content-type":"application/json","x-sync-secret":process.env.SYNC_SECRET},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`Ingest HTTP ${r.status}`);return;}
    catch(e){if(attempt)throw e;await delay(2000);}
  }
}
async function main() {
  await mkdir(stateDir,{recursive:true,mode:0o700});
  const lockPath=resolve(stateDir,"worker.lock");
  try{const file=await open(lockPath,"wx",0o600);await file.writeFile(String(process.pid));await file.close();}
  catch(e){if(e.code!=="EEXIST")throw e;const pid=Number(await readFile(lockPath,"utf8"));try{process.kill(pid,0);console.log("MLS sweep already running");return;}catch(err){if(err.code!=="ESRCH")throw err;}await unlink(lockPath);return main();}
  const payload={runId:randomUUID(),observedAt:new Date().toISOString(),status:"error",message:"MLS research did not complete.",captures:[]};
  let page;
  try {
    const health=await fetch("http://127.0.0.1:8900/health",{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
    if(health.activeJobs>0)throw new Error("Research worker busy");
    const browser=await chromium.connectOverCDP(process.env.MLS_CDP_URL||"http://127.0.0.1:9223",{timeout:10000});
    page=await browser.contexts()[0].newPage();page.setDefaultTimeout(12000);
    let captured=null;
    const observe=async response=>{
      try{const url=new URL(response.url());if(url.hostname!=="relax-production.remine.com"||url.pathname!=="/api/v3.1/properties"||response.request().method()!=="POST"||!response.ok())return;
        const body=response.request().postDataJSON();if(!body.withPropertyCard)return;
        const json=await response.json();if(!Array.isArray(json.properties))return;
        const headers=await response.request().allHeaders();captured={url:url.origin+url.pathname,body,headers:Object.fromEntries(Object.entries(headers).filter(([k])=>k==="authorization"||k==="content-type"||k.startsWith("x-")))};
      }catch{}
    };
    page.on("response",observe);
    await authenticate(page);
    // A normal browser search establishes the exact authenticated read request.
    await page.goto("https://hmls.remine.com/discover",{waitUntil:"domcontentloaded"});
    for(let n=0;n<30&&!captured;n++)await delay(500);
    if(!captured)throw new Error("Authenticated property search response unavailable");
    page.off("response",observe);
    const plan=(await page.locator("body").innerText()).match(/Remine (?:Insights|Pro) Plan/)?.[0]||"Available Remine account access";
    async function readSearch(body) {
      return page.evaluate(async ({url,headers,body})=>{const r=await fetch(url,{method:"POST",credentials:"include",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Search HTTP ${r.status}`);return r.json();},{...captured,body});
    }
    const from=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    const rows=new Map();
    for(const region of regions) {
      const body={status:["Expired","Withdrawn","Canceled"],contractDate:[`${from}T00:00:00Z,`],bounds:{rectangles:[{key:"screen",...region}]},clusterPrecision:5,clusterMin:10,clusterMax:50,zoomLevel:12,filterOperators:{},limit:100,page:1,withPropertyCard:true,sortDirection:"asc",selectedListings:[],mapRequestType:"listings"};
      const result=await readSearch(body);
      if(!Array.isArray(result.properties))throw new Error("Search schema changed");
      for(const row of result.properties)if(farmProperty(row)&&row.zone==="Residential"&&row.remineid)rows.set(row.remineid,row);
      await delay(750);
    }
    const ranked=[...rows.values()].sort((a,b)=>(Number(b.daysOnMarket)||0)-(Number(a.daysOnMarket)||0));
    let rejected=0;
    // Bound detail reads and retain at most 20 verified captures; the desk chooses five.
    for(const row of ranked.slice(0,35)) {
      if(payload.captures.length>=20)break;
      if(!/^L[a-zA-Z0-9_-]{1,99}$/.test(row.remineid)){rejected++;continue;}
      const detail=await page.evaluate(async ({id,headers})=>{const r=await fetch(`https://relax-production.remine.com/api/v2.2/location/${encodeURIComponent(id)}?includeDataShareListings=true`,{credentials:"include",headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Detail HTTP ${r.status}`);return r.json();},{id:row.remineid,headers:captured.headers});
      const candidate=captureRemineProperty(row,detail,new Date().toISOString(),plan);
      const parsed=mlsCaptureSchema.safeParse(candidate);
      if(parsed.success)payload.captures.push(parsed.data);else rejected++;
      await delay(500);
    }
    payload.observedAt=new Date().toISOString();payload.status=payload.captures.length?"ready":"empty";
    const qualified=payload.captures.filter(c=>scoreMlsCapture(c).score>=50).length;
    payload.message=`${payload.captures.length} current properties verified; ${qualified} score at least 50. ${rejected} stale, relisted, or unverifiable matches excluded. ${plan}.`;
  } catch(e) {
    if(/(?:Search|Detail) HTTP (?:401|403)/.test(String(e.message)))e=new LoginRequired();
    payload.captures=[];payload.observedAt=new Date().toISOString();payload.status=e instanceof LoginRequired?"reauth_required":"error";
    payload.message=e instanceof LoginRequired?"Sign into Heartland in the research browser on Spark; collection is paused.":"MLS search or property verification failed. Collection is paused; check Spark and retry.";
    console.error(`MLS sweep: ${e instanceof LoginRequired?"login required":e.name}`);
  } finally {
    try{if(page)await page.close();await report(payload);console.log(JSON.stringify({status:payload.status,count:payload.captures.length,message:payload.message,published:publish}));}
    finally{await unlink(lockPath);}
  }
  if(["error","reauth_required"].includes(payload.status))process.exitCode=1;
}
main().catch(e=>{console.error(`MLS worker failed: ${e.name}`);process.exitCode=1;}).finally(()=>process.exit(process.exitCode||0));
