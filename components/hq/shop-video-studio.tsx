"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { allowanceCents, tiktokProductId } from "@/lib/shop-video/core";

type Product={id:string;title:string;productId:string;productUrl:string;imageUrl:string;realVideoUrl:string|null;seller:string;variant:string;realFootageConfirmed:boolean};
type Account={id:string;externalAccountId:string;username:string;displayName:string;dailyQuota:number;weeklyQuota:number;verified:boolean};
type Job={id:string;status:string;productSnapshot:Product;videoUrl:string|null;error:string|null;allowanceCents:number;providerEstimateCents:number|null;actualCostCents:number|null;publishedUrl:string|null};
type Batch={id:string;username:string;provider:string;format:string;scene:string;reservedCents:number;createdAt:string;jobs:Job[]};
type Dashboard={products:Product[];accounts:Account[];catalog:{id:string;title:string;productId:string;productUrl:string;imageUrl:string;priceCents:number|null}[];connections:{accounts:{externalAccountId:string;username:string;displayName:string}[];error:string|null};batches:Batch[];commissions:{externalId:string;amountCents:number;status:string}[];worker:{configured:boolean;ready:boolean;fal:boolean};totals:{pendingCents:number;settledCents:number;reversedCents:number;allowanceCents:number;providerEstimateCents:number;confirmedCostCents:number;unconfirmedCharges:number}};
const dollars=(cents:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(cents/100);
const initialProduct={title:"",productId:"",productUrl:"",imageUrl:"",realVideoUrl:"",seller:"",variant:"",price:"",commission:"",rightsConfirmed:false,authenticityConfirmed:false,realFootageConfirmed:false};

async function request(kind:string,data?:unknown,id?:string) {
  const r=await fetch("/api/hq/shop-videos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,data,id})});
  const body=await r.json(); if(!r.ok) throw new Error(body.error||"Request failed"); return body;
}
function Check({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void}) {
  return <label className="sv-check"><input type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)} />{label}</label>;
}

export function ShopVideoStudio() {
  const [data,setData]=useState<Dashboard|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const [product,setProduct]=useState(initialProduct),[picked,setPicked]=useState<string[]>([]),[accountId,setAccountId]=useState("");
  const [connection,setConnection]=useState(""),[daily,setDaily]=useState(3),[weekly,setWeekly]=useState(21),[accessConfirmed,setAccessConfirmed]=useState(false),[quotaConfirmed,setQuotaConfirmed]=useState(false);
  const [provider,setProvider]=useState("fal"),[format,setFormat]=useState("hybrid"),[scene,setScene]=useState("original"),[overlay,setOverlay]=useState("A closer look at this find"),[budget,setBudget]=useState("5.00");
  const [commission,setCommission]=useState({jobId:"",externalId:"",amount:"",status:"pending",evidence:""});
  const [cost,setCost]=useState({jobId:"",amount:"",evidence:""});
  const requestKey=useRef<string|null>(null),polling=useRef(false);
  const load=useCallback(async()=>{
    const r=await fetch("/api/hq/shop-videos",{cache:"no-store"}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"Could not load batches"); setData(d);
  },[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  const running=data?.batches.some(b=>b.jobs.some(j=>["queued","dispatching","rendering"].includes(j.status)))||false;
  useEffect(()=>{
    if(!running)return;
    const timer=setInterval(async()=>{
      if(polling.current)return; polling.current=true;
      try{await request("refresh");await load();}catch(e){setError(e instanceof Error?e.message:"Refresh failed");}finally{polling.current=false;}
    },15000);
    return()=>clearInterval(timer);
  },[running,load]);
  async function act(work:()=>Promise<unknown>,message:string) {
    setBusy(true);setError("");setNotice("");
    try{await work();await load();setNotice(message);}catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}
  }
  async function uploadMedia(file:File,field:"imageUrl"|"realVideoUrl") {
    await act(async()=>{
      const ext=field==="imageUrl"?(/\.(jpg|jpeg|png|webp)$/i.exec(file.name)?.[1]||"jpg"):(/\.(mp4|mov|webm)$/i.exec(file.name)?.[1]||"mp4");
      const blob=await upload(`shop-video-inputs/${crypto.randomUUID()}.${ext.toLowerCase()}`,file,{access:"public",handleUploadUrl:"/api/hq/shop-videos/upload-token"});
      setProduct(p=>({...p,[field]:blob.url}));
    },"Media uploaded");
  }
  const jobs=data?.batches.flatMap(b=>b.jobs)||[],published=jobs.filter(j=>j.status==="published"),selectedAccount=data?.accounts.find(a=>a.id===accountId);
  const perVideo=allowanceCents(provider,scene),batchAllowance=perVideo*picked.length;
  const hybridMissing=format==="hybrid" && picked.some(id=>{const p=data?.products.find(p=>p.id===id);return !p?.realVideoUrl||!p.realFootageConfirmed;});
  return <main className="sv">
    <header className="sv-header"><div><a className="sv-back" href="/hq?tab=tiktok">← Growth HQ · TikTok Shop</a><p className="sv-eyebrow">PRODUCTS → VIDEOS → COMMISSIONS</p><h1>Shop Video Batch</h1><p>Create product videos, review each one, and finish your Shop post in TikTok.</p></div><button className="sv-secondary" disabled={busy} onClick={()=>act(()=>request("refresh"),"Batch status refreshed")}>Refresh batches</button></header>
    {error&&<div className="sv-error" role="alert">{error}</div>}{notice&&<div className="sv-notice" role="status">{notice}</div>}
    {!data?<p className="sv-muted">Loading your product library and cloud worker…</p>:<>
      <div className="sv-stats">
        <Stat title="Ready to review" value={String(jobs.filter(j=>j.status==="ready").length)} />
        <Stat title="Pending commissions" value={dollars(data.totals.pendingCents)} />
        <Stat title="Settled commissions" value={dollars(data.totals.settledCents)} />
        <Stat title="Confirmed generation charges" value={dollars(data.totals.confirmedCostCents)} detail={data.totals.unconfirmedCharges?`${data.totals.unconfirmedCharges} jobs await cost receipts`:"Recorded from provider receipts"} />
      </div>
      <section className="sv-panel"><div className="sv-section-head"><div><span className="sv-step">01</span><h2>Choose your Shop account</h2></div><span className="sv-pill">{data.worker.ready?"Cloud worker ready":"Cloud worker needs setup"}</span></div>
        <p className="sv-muted">Confirm affiliate access and your current posting allowance in TikTok Shop Creator Center. Reconfirm weekly and include posts made outside this tool.</p>
        {data.connections.error&&<p className="sv-error">{data.connections.error}</p>}
        <div className="sv-fields"><label>Connected TikTok account<select value={connection} onChange={e=>{setConnection(e.target.value);setAccessConfirmed(false);setQuotaConfirmed(false);}}><option value="">Choose an account</option>{data.connections.accounts.map(a=><option key={a.externalAccountId} value={a.externalAccountId}>@{a.username} · {a.displayName}</option>)}</select></label>
          <label>Available posts per 24 hours<input type="number" min={1} max={30} value={daily} onChange={e=>setDaily(Number(e.target.value))}/></label><label>Available posts per 7 days<input type="number" min={1} max={210} value={weekly} onChange={e=>setWeekly(Number(e.target.value))}/></label></div>
        <div className="sv-checks"><Check label="I confirmed this account can promote affiliate products" value={accessConfirmed} onChange={setAccessConfirmed}/><Check label="I checked its current daily and weekly Shop limits" value={quotaConfirmed} onChange={setQuotaConfirmed}/></div>
        <button disabled={busy||!connection||!accessConfirmed||!quotaConfirmed} onClick={()=>act(async()=>{const r=await request("account",{externalAccountId:connection,dailyQuota:daily,weeklyQuota:weekly,affiliateAccessConfirmed:true,quotaConfirmed:true});setAccountId(r.result.id);},"Account verified for seven days")}>Save account verification</button>
      </section>
      <div className="sv-workspace">
        <section className="sv-panel"><div className="sv-section-head"><div><span className="sv-step">02</span><h2>Add a product</h2></div></div><p className="sv-muted">Paste a TikTok product link and its listing details. Use images you have permission to promote.</p>
          {!!data.catalog.length&&<label>Start with an existing TikTok Shop listing<select value="" onChange={e=>{const p=data.catalog.find(p=>p.id===e.target.value);if(p)setProduct({...initialProduct,title:p.title,productId:p.productId,productUrl:p.productUrl,imageUrl:p.imageUrl,price:p.priceCents==null?"":String(p.priceCents/100)});}}><option value="">Choose an existing listing to review</option>{data.catalog.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>}
          <form onSubmit={e=>{e.preventDefault();act(async()=>{await request("product",{...product,priceCents:Math.round(Number(product.price)*100),commissionBps:Math.round(Number(product.commission)*100)});setProduct(initialProduct);},"Product saved to your library");}}>
            <label>Product link<input required type="url" value={product.productUrl} onChange={e=>setProduct({...product,productUrl:e.target.value})} onBlur={()=>{try{const id=tiktokProductId(product.productUrl);if(id)setProduct(p=>({...p,productId:id}));}catch{}}} placeholder="https://www.tiktok.com/view/product/…"/></label>
            <div className="sv-fields"><label>TikTok product ID<input required value={product.productId} onChange={e=>setProduct({...product,productId:e.target.value})}/></label><label>Product name<input required maxLength={180} value={product.title} onChange={e=>setProduct({...product,title:e.target.value})}/></label><label>Seller<input required value={product.seller} onChange={e=>setProduct({...product,seller:e.target.value})}/></label><label>Exact variant<input required value={product.variant} onChange={e=>setProduct({...product,variant:e.target.value})} placeholder="Color, size, pack quantity"/></label><label>Current price ($)<input required type="number" min={0} step="0.01" value={product.price} onChange={e=>setProduct({...product,price:e.target.value})}/></label><label>Commission (%)<input required type="number" min={0} max={100} step="0.01" value={product.commission} onChange={e=>setProduct({...product,commission:e.target.value})}/></label></div>
            <label>Authorized product image URL<input required type="url" value={product.imageUrl} onChange={e=>setProduct({...product,imageUrl:e.target.value})}/></label><label className="sv-file">Or upload a product photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)uploadMedia(f,"imageUrl");e.target.value="";}}/></label>
            <label>Real demonstration video URL (for hybrid)<input type="url" value={product.realVideoUrl} onChange={e=>setProduct({...product,realVideoUrl:e.target.value})}/></label><label className="sv-file">Or upload a real demonstration · at least 4 seconds<input type="file" accept="video/mp4,video/quicktime,video/webm" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)uploadMedia(f,"realVideoUrl");e.target.value="";}}/></label>
            <div className="sv-checks"><Check label="I have permission to use this product's media" value={product.rightsConfirmed} onChange={v=>setProduct({...product,rightsConfirmed:v})}/><Check label="I checked the seller and product authenticity" value={product.authenticityConfirmed} onChange={v=>setProduct({...product,authenticityConfirmed:v})}/><Check label="The real footage shows a person and this exact physical product" value={product.realFootageConfirmed} onChange={v=>setProduct({...product,realFootageConfirmed:v})}/></div>
            <button disabled={busy||!product.rightsConfirmed||!product.authenticityConfirmed}>Save product</button>
          </form>
        </section>
        <section className="sv-panel"><div className="sv-section-head"><div><span className="sv-step">03</span><h2>Create a batch</h2></div></div>
          <div className="sv-library">{data.products.length?data.products.map(p=><label key={p.id} className={`sv-product ${picked.includes(p.id)?"sv-selected":""}`}><input type="checkbox" checked={picked.includes(p.id)} onChange={e=>{requestKey.current=null;setPicked(e.target.checked?[...picked,p.id]:picked.filter(id=>id!==p.id));}}/><span><strong>{p.title}</strong><small>{p.variant} · {p.realFootageConfirmed?"Real demo confirmed":"Display photo only"}</small></span><a href={p.productUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}>Listing ↗</a></label>):<p className="sv-muted">Add your first product to begin.</p>}</div>
          <label>Posting account<select value={accountId} onChange={e=>{requestKey.current=null;setAccountId(e.target.value);}}><option value="">Choose a verified account</option>{data.accounts.map(a=><option key={a.id} value={a.id}>@{a.username} · {a.verified?"verified":"reconfirm access"}</option>)}</select></label>
          <div className="sv-fields"><label>Generation provider<select value={provider} onChange={e=>{requestKey.current=null;setProvider(e.target.value);}}><option value="fal">fal.ai · 480p Wan Turbo</option><option value="modal">Modal · cloud Wan</option></select></label><label>Video format<select value={format} onChange={e=>{requestKey.current=null;setFormat(e.target.value);}}><option value="hybrid">Hybrid · real demo + AI display</option><option value="boomerang">Display loop · 4s forward + 4s reverse</option></select></label><label>Display scene<select value={scene} onChange={e=>{requestKey.current=null;setScene(e.target.value);}}><option value="original">Keep product photo background</option><option value="countertop">Retail countertop</option><option value="shelf">Retail shelf</option><option value="studio">Product studio</option></select></label><label>Batch generation allowance ($)<input type="number" min="0.05" max="20" step="0.01" value={budget} onChange={e=>{requestKey.current=null;setBudget(e.target.value);}}/></label></div>
          <label>Text overlay<input value={overlay} maxLength={120} onChange={e=>{requestKey.current=null;setOverlay(e.target.value);}}/></label>
          <div className="sv-estimate"><strong>{picked.length} videos · {dollars(batchAllowance)} reserved allowance</strong><span>8 seconds · 1080 × 1920 export · silent for TikTok audio</span><small>Provider charges are estimates until recorded from receipts. Modal includes a conservative $1.50 motion allowance per video. Cloud processing and storage are billed separately. No automatic paid retries.</small></div>
          {hybridMissing&&<p className="sv-muted">Add confirmed real demonstration footage for every selected product, or choose a display loop for review.</p>}
          {format==="boomerang"&&<p className="sv-muted">Pure loops need a passed TikTok video pre-check before Shop handoff. Hybrid is the recommended starting format.</p>}
          <button disabled={busy||!picked.length||picked.length>20||!selectedAccount?.verified||!data.worker.ready||((provider==="fal"||scene!=="original")&&!data.worker.fal)||hybridMissing||batchAllowance>Math.round(Number(budget)*100)} onClick={()=>act(async()=>{requestKey.current??=crypto.randomUUID();await request("batch",{requestKey:requestKey.current,accountId,productIds:picked,provider,format,scene,overlay,maxSpendCents:Math.round(Number(budget)*100)});requestKey.current=null;setPicked([]);},"Batch submitted to the cloud worker")}>Generate {picked.length||"selected"} videos</button>
        </section>
      </div>
      <section className="sv-panel"><div className="sv-section-head"><div><span className="sv-step">04</span><h2>Review and finish in TikTok</h2></div></div>
        {!data.batches.length&&<p className="sv-muted">Your generated videos will appear here. Nothing posts automatically.</p>}
        {data.batches.map(b=><div key={b.id} className="sv-batch"><div className="sv-batch-head"><strong>@{b.username} · {b.format==="hybrid"?"Hybrid":"Store Display loop"}</strong><span>{b.provider==="fal"?"fal.ai":"Modal"} · {new Date(b.createdAt).toLocaleString()}</span></div><div className="sv-jobs">{b.jobs.map(j=><JobCard key={j.id} job={j} batch={b} busy={busy} act={act}/>)}</div></div>)}
      </section>
      <section className="sv-panel"><div className="sv-section-head"><div><span className="sv-step">05</span><h2>Track commissions and charges</h2></div></div><p className="sv-muted">Use TikTok’s order-line ID to update the same commission from pending to settled or reversed. Estimated commissions and unsettled balances are not earned cash.</p>
        <div className="sv-workspace">
          <form onSubmit={e=>{e.preventDefault();act(()=>request("commission",{...commission,amountCents:Math.round(Number(commission.amount)*100)}),"Commission recorded without duplicating the order line");}}><h3>Commission</h3><label>Published video<select required value={commission.jobId} onChange={e=>setCommission({...commission,jobId:e.target.value})}><option value="">Choose a published video</option>{published.map(j=><option key={j.id} value={j.id}>{j.productSnapshot.title} · {j.id.slice(-6)}</option>)}</select></label><label>TikTok order + line ID<input required value={commission.externalId} onChange={e=>setCommission({...commission,externalId:e.target.value})}/></label><div className="sv-fields"><label>Commission amount ($)<input required type="number" min={0} step="0.01" value={commission.amount} onChange={e=>setCommission({...commission,amount:e.target.value})}/></label><label>Settlement status<select value={commission.status} onChange={e=>setCommission({...commission,status:e.target.value})}><option value="pending">Pending</option><option value="settled">Settled</option><option value="reversed">Reversed / refunded</option></select></label></div><label>Statement or export reference<input required value={commission.evidence} onChange={e=>setCommission({...commission,evidence:e.target.value})}/></label><button disabled={busy||!published.length}>Save commission</button></form>
          <form onSubmit={e=>{e.preventDefault();act(()=>request("job",{action:"cost",amountCents:Math.round(Number(cost.amount)*100),evidence:cost.evidence},cost.jobId),"Confirmed provider charge recorded");}}><h3>Confirmed generation charge</h3><label>Generated video<select required value={cost.jobId} onChange={e=>setCost({...cost,jobId:e.target.value})}><option value="">Choose a video</option>{jobs.filter(j=>j.status!=="queued").map(j=><option key={j.id} value={j.id}>{j.productSnapshot.title} · {j.id.slice(-6)}</option>)}</select></label><label>Provider charge ($)<input required type="number" min={0} step="0.01" value={cost.amount} onChange={e=>setCost({...cost,amount:e.target.value})}/></label><label>Invoice or usage receipt reference<input required value={cost.evidence} onChange={e=>setCost({...cost,evidence:e.target.value})}/></label><button disabled={busy||!cost.jobId}>Record confirmed charge</button><p className="sv-muted">Reversed commissions: {dollars(data.totals.reversedCents)}. {data.totals.unconfirmedCharges?"Net earnings await outstanding generation receipts.":`Settled commissions less recorded generation charges: ${dollars(data.totals.settledCents-data.totals.confirmedCostCents)}.`}</p></form>
        </div>
        {!!data.commissions.length&&<div className="sv-ledger">{data.commissions.map(c=><div key={c.externalId}><span>{c.externalId}</span><span>{c.status}</span><strong>{dollars(c.amountCents)}</strong></div>)}</div>}
      </section>
    </>}
  </main>;
}
function Stat({title,value,detail}:{title:string;value:string;detail?:string}) {return <div className="sv-stat"><span>{title}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>;}
function JobCard({job:j,batch,busy,act}:{job:Job;batch:Batch;busy:boolean;act:(w:()=>Promise<unknown>,m:string)=>Promise<void>}) {
  const [matches,setMatches]=useState(false),[accurate,setAccurate]=useState(false),[rights,setRights]=useState(false),[precheck,setPrecheck]=useState(false);
  const [ai,setAi]=useState(false),[audio,setAudio]=useState(false),[linked,setLinked]=useState(false),[url,setUrl]=useState("");
  return <article className="sv-job"><div className="sv-job-heading"><h3>{j.productSnapshot.title}</h3><span className={`sv-status sv-status-${j.status}`}>{j.status}</span></div><p className="sv-muted">{j.productSnapshot.variant}</p>
    {j.videoUrl?<video controls playsInline preload="none" src={j.videoUrl} aria-label={`${j.productSnapshot.title} video preview`}/>:<div className="sv-video-placeholder">{["queued","dispatching","rendering"].includes(j.status)?"Generating in the cloud…":"No finished video"}</div>}
    <p className="sv-job-cost">Allowance {dollars(j.allowanceCents)}{j.providerEstimateCents!==null&&` · provider estimate ${dollars(j.providerEstimateCents)}`}{j.actualCostCents!==null&&` · confirmed ${dollars(j.actualCostCents)}`}</p>
    {j.error&&<p className="sv-error">{j.error}</p>}
    {j.status==="held"&&<button className="sv-secondary" disabled={busy} onClick={()=>act(()=>request("job",{action:"recover"},j.id),"Saved cloud result checked")}>Recover saved result</button>}
    {j.videoUrl&&<a className="sv-download" href={`${j.videoUrl}?download=1`}>Download MP4 for review / TikTok</a>}
    {j.status==="ready"&&<div className="sv-review"><Check label="The exact linked product and variant match" value={matches} onChange={setMatches}/><Check label="The overlay and visuals make accurate claims" value={accurate} onChange={setAccurate}/><Check label="The media and branding are authorized" value={rights} onChange={setRights}/>{batch.format==="boomerang"&&<Check label="This video passed TikTok’s video pre-check" value={precheck} onChange={setPrecheck}/>}<button disabled={busy||!matches||!accurate||!rights||(batch.format==="boomerang"&&!precheck)} onClick={()=>act(()=>request("job",{action:"approve",productMatches:matches,claimsAccurate:accurate,rightsConfirmed:rights,precheckPassed:precheck},j.id),"Video approved")}>Approve for Shop handoff</button><button className="sv-secondary" disabled={busy} onClick={()=>act(()=>request("job",{action:"reject",reason:"Rejected during visual review"},j.id),"Video held out of publishing")}>Reject video</button></div>}
    {j.status==="approved"&&<div className="sv-review"><p>Upload the MP4 to <strong>@{batch.username}</strong> in TikTok. Complete these settings before publishing.</p><a href={j.productSnapshot.productUrl} target="_blank" rel="noopener noreferrer">Open the exact product ↗</a><Check label="AI disclosure is enabled in TikTok" value={ai} onChange={setAi}/><Check label="Permitted commercial audio is selected" value={audio} onChange={setAudio}/><Check label="The correct Shop product is attached" value={linked} onChange={setLinked}/><button disabled={busy||!ai||!audio||!linked} onClick={()=>act(()=>request("job",{action:"handoff",disclosureConfirmed:ai,commercialAudioConfirmed:audio,productLinkConfirmed:linked},j.id),"Posting slot reserved; finish publishing in TikTok")}>Reserve posting slot</button></div>}
    {j.status==="handoff"&&<form onSubmit={e=>{e.preventDefault();act(()=>request("job",{action:"published",url},j.id),"Published video recorded");}}><p>Finish publishing in TikTok, then record its URL.</p><label>Published TikTok URL<input type="url" required value={url} onChange={e=>setUrl(e.target.value)} placeholder={`https://www.tiktok.com/@${batch.username}/video/…`}/></label><button disabled={busy}>Record published video</button></form>}
    {j.publishedUrl&&<a href={j.publishedUrl} target="_blank" rel="noopener noreferrer">View published TikTok ↗</a>}
  </article>;
}
