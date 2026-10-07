import React from 'react';
import {createRoot} from 'react-dom/client';
import {RolefitBoard} from '@/components/rolefit/RolefitBoard';
import {DEFAULT_FILTERS} from '@/lib/rolefit/filter';
import '@/app/globals.css';
const older=new URLSearchParams(location.search).get('older')==='1';
const lifecycle=(availability:'open'|'unknown'|'closed',anchor:string,expires:string,payload:'available'|'retired')=>({feedEnabled:true,sourceEnabled:true,sourceAvailability:availability,discoveryAnchorAt:anchor,discoveryExpiresAt:expires,payloadAvailability:payload});
const base={location:'Remote',location_canonicals:['Remote'],remote:true,closed_at:null,company_name:'Offline Fixture',ats:'lever',human_override:false,verdict:null,role_category:null,seniority:null,work_arrangement:null,pay_min:null,pay_max:null,pay_currency:null,pay_period:null,headcount:null,skills_score:null,experience_score:null,comp_score:null,fit_score:null,skill_gaps:[]};
const jobs=[{...base,id:'lever:fixture:fresh',title:'Recent Engineer',first_seen_at:'2026-10-06T00:00:00Z',lifecycle:lifecycle('open','2026-10-06T00:00:00Z','2026-11-05T00:00:00Z','available')},
  ...(older?[{...base,id:'lever:fixture:older',title:'Older Live Engineer',first_seen_at:'2026-09-01T00:00:00Z',lifecycle:lifecycle('open','2026-09-01T00:00:00Z','2026-10-01T00:00:00Z','retired')}]:[])];
createRoot(document.getElementById('root')!).render(<RolefitBoard jobs={jobs} nowIso='2026-10-07T12:00:00Z' isAuthed={false}
  initialFilters={{...DEFAULT_FILTERS,includeOlderLive:older}} discoveryTotal={jobs.length} saveResume={async()=>{}} rejectJob={async()=>{}} unrejectJob={async()=>{}} markApplied={async()=>{}} unmarkApplied={async()=>{}}
  hasProfile={false} viewerEmail={null} resumeText='' currentProfileVersion={null} initialPackages={[]} initialRejected={[]}/>);
