import React from 'react';
import {createRoot} from 'react-dom/client';
import {RolefitBoard} from '@/components/rolefit/RolefitBoard';
import {DEFAULT_FILTERS} from '@/lib/rolefit/filter';
import type {ApplicationPackage,JobRow} from '@/lib/types';
import '@/app/globals.css';
const base:JobRow={id:'',title:'',location:'Remote',location_canonicals:['Remote'],remote:true,closed_at:null,
  first_seen_at:'2026-09-01T00:00:00Z',company_name:'Offline Fixture',ats:'greenhouse',human_override:false,
  verdict:null,role_category:null,seniority:null,work_arrangement:null,pay_min:null,pay_max:null,pay_currency:null,
  pay_period:null,headcount:null,skills_score:null,experience_score:null,comp_score:null,fit_score:null,skill_gaps:[]};
const discovery=[{...base,id:'discovery-1',title:'Discovery page one',fit_score:90,verdict:'approve'},
  {...base,id:'discovery-2',title:'Discovery page one extra',fit_score:90,verdict:'approve'}];
const history=[{...base,id:'prepared',title:'Retained prepared role',closed_at:'2026-10-01T00:00:00Z'},
  {...base,id:'applied',title:'Retained applied role',closed_at:'2026-10-01T00:00:00Z'}];
const pkg=(jobId:string,status:'prepared'|'applied'):ApplicationPackage=>({jobId,status,
  resume:{name:'Ada',headline:'Saved résumé',contact:'ada@example.test',summary:'Retained résumé summary',skills:['TypeScript'],experience:[],education:[],certifications:[]},
  coverLetter:{greeting:'Dear team,',paragraphs:['Retained cover letter body'],closing:'Sincerely,',signature:'Ada'},
  prefilledAnswers:[{question:'Historical orphan question',answer:'Retained historical answer'}],
  descriptionSnapshot:'Immutable application JD',questionsSnapshot:null,applyUrl:null,profileVersion:null,
  resumeInstructions:null,coverLetterInstructions:null,resumeInstructionsDraft:null,coverLetterInstructionsDraft:null,
  coverLetterEditedText:null,preparedAt:'2026-09-01T00:00:00Z',appliedAt:status==='applied'?'2026-09-02T00:00:00Z':null});
const actions=async()=>{throw new Error('Fake browser write action must not run');};
createRoot(document.getElementById('root')!).render(<RolefitBoard jobs={discovery} initialHistory={history}
  historyPage={1} historyTotal={1000} discoveryTotal={500} nowIso='2026-10-07T12:00:00Z' isAuthed
  initialFilters={DEFAULT_FILTERS} saveResume={actions} rejectJob={actions} unrejectJob={actions}
  markApplied={actions} unmarkApplied={actions} hasProfile viewerEmail='fixture@example.test' resumeText=''
  currentProfileVersion={null} initialPackages={[pkg('prepared','prepared'),pkg('applied','applied'),pkg('discovery-1','applied')]} initialRejected={[]}/>);
