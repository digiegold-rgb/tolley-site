'use client';
import * as React from 'react';
import ListingProgress from '@/components/animate/screens/listing/ListingProgress';
import LookStep from '@/components/animate/screens/listing/steps/LookStep';
import type { ListingJobDto } from '@/lib/vater/listing/contract';
const base: ListingJobDto = { id:'delivery-fixture',sku:'before_after',status:'awaiting_approval',step:5,sourceKind:'upload',sourceImageUrls:['/test-original.png'],features:[],address:'Test room',city:null,state:null,zip:null,lat:null,lng:null,beds:null,baths:null,sqft:null,dictationRaw:null,roomType:null,style:null,look:'photoreal',engine:'seedance',lane:'social',reel:false,stagedStillUrl:null,stagedStillLabeledUrl:null,mlsSafeStillUrl:null,videoUrl:null,finalUrl:null,videoVerticalUrl:null,endCardUrl:null,proofToken:null,priceCents:1900,restageCount:0,errorCode:null,errorMessage:null,createdAt:'2026-09-14',updatedAt:'2026-09-14',completedAt:null };
const noop=()=>{};
export default function Fixture(){
 const [mode,setMode]=React.useState('missing');
 const job = React.useMemo(()=>({...base,...(mode==='valid'||mode==='broken'?{stagedStillUrl:'/test-staged.png',stagedStillLabeledUrl:mode==='broken'?'/test-broken.png':'/test-labeled.png'}:{}),...(mode.startsWith('beauty')?{sku:'beauty_shot' as const,status:mode==='beauty-filming'?'rendering' as const:'awaiting_approval' as const}:{}),...(mode==='ready'?{sku:'beauty_shot' as const,status:'ready' as const,videoUrl:'/test-video.mp4',finalUrl:'/test-video.mp4'}:{})}),[mode]);
 return <><nav>{['missing','valid','broken','beauty-legacy','beauty-filming','beauty-price','ready'].map(x=><button key={x} onClick={()=>setMode(x)}>{x}</button>)}</nav>{mode==='beauty-price'?<LookStep job={job} onSave={async()=>{}} onBack={noop} onStaged={noop} onGoToStep={noop} licenseVerified={false}/>:<ListingProgress key={mode} job={job} onJob={noop} onMakeAnother={noop} licenseVerified={false}/>}</>;
}
