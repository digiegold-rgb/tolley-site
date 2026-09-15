'use client';
import * as React from 'react';
import PhotoStep from '@/components/animate/screens/listing/steps/PhotoStep';
import type {ListingJobDto} from '@/lib/vater/listing/contract';
export default function Fixture(){
 const [job,setJob]=React.useState({id:'photo-fixture',sku:'beauty_shot',status:'draft',step:1,sourceKind:'upload',sourceImageUrls:[],features:[]} as unknown as ListingJobDto);
 return <><PhotoStep job={job} onSave={async patch=>{setJob({...job,...patch} as ListingJobDto);}} onNext={()=>{}}/><output data-testid="saved-photo">{job.sourceImageUrls[0]}</output></>;
}
