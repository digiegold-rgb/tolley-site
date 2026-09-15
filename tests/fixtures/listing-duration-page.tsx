'use client';
import * as React from 'react';
import LookStep from '@/components/animate/screens/listing/steps/LookStep';
import {listingApi} from '@/components/animate/screens/listing/listing-api';
import type {ListingJobDto} from '@/lib/vater/listing/contract';
const noop=()=>{};
export default function Fixture(){
 const [job,setJob]=React.useState<ListingJobDto|null>(null);
 React.useEffect(()=>{void listingApi.get('duration-fixture').then(setJob);},[]);
 const save=async(patch: Parameters<typeof listingApi.patch>[1])=>{setJob(await listingApi.patch('duration-fixture',patch));};
 if(!job)return <p>Loading fixture</p>;
 return <><LookStep job={job} onSave={save} onBack={noop} onStaged={setJob} onGoToStep={noop} licenseVerified={false}/><output data-testid="saved-duration">{job.durationS}</output><output data-testid="saved-status">{job.status}</output></>;
}
