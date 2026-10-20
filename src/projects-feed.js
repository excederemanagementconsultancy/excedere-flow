import {loadSharedProjects,setSharedTaskCompleted} from './shared-projects-feed.js';
/* Projects remains the source of truth. FLOW changes task status only. */
import './projects-sync-protocol.js';
import './projects-cloud-repository.js';
const PRIORITY_MAP={Urgent:'High',High:'High',Normal:'Medium',Low:'Low'};
const PREFIX='excedereProjectsOperationV2:',HISTORY='excedereProjectsHistoryV2:';
let observed=null,observedOwner=null,draining=null;
function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;}
function normaliseTask(r){
 if(!r||r.type!=='Task'||!r.id||!r.title?.trim()||r.deletedAt)return null;
 const completed=r.status==='completed',project=r.project?.trim()||'Excedere Projects';
 return {key:'projects:'+r.id,id:String(r.id),sourceId:String(r.id),sourceSystem:'projects',title:r.title.trim(),area:project,project,priority:PRIORITY_MAP[r.priority]||'Medium',sourcePriority:Object.hasOwn(PRIORITY_MAP,r.priority)?r.priority:'Normal',status:completed?'Completed':'Not Started',date:validDate(r.dueDate)?r.dueDate:'',dueDate:validDate(r.dueDate)?r.dueDate:'',time:'',recurring:false,notes:r.notes||'',completedAt:r.completedAt||'',updatedAt:r.updatedAt||'',createdAt:r.createdAt||''};
}
async function account(){const client=window.ExcedereFlowSupabase;if(!client)return null;const {data,error}=await client.auth.getSession();if(error)throw error;const userId=data.session?.user?.id;return userId?{client,userId}:null;}
function queue(userId){const rows=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(PREFIX+userId+':'))rows.push(JSON.parse(localStorage.getItem(key)));}return rows.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
async function drain(client,userId){
 if(draining)return draining;
 draining=(async()=>{const repo=new window.ProjectsCloudRepository(client,userId);for(const op of queue(userId)){
  if(op.conflicts?.length)continue;
  const result=await repo.commit(op);
  if(result.conflicts.length){const pending={...op,id:op.id+':conflict',changes:result.conflicts.map(({collection,id,before,after})=>({collection,id,before,after})),conflicts:result.conflicts};localStorage.setItem(PREFIX+userId+':'+pending.id,JSON.stringify(pending));}
  localStorage.setItem(HISTORY+userId+':'+op.id,JSON.stringify({id:op.id,owner:op.owner,result,acknowledgedAt:new Date().toISOString()}));localStorage.removeItem(PREFIX+userId+':'+op.id);
 }})();
 try{return await draining;}finally{draining=null;}
}
async function loadOwnProjectsFeed(){
 const a=await account();if(!a){observed=null;observedOwner=null;return {tasks:[],projects:[],milestones:[],version:0,updatedAt:null};}
 let syncError='';try{await drain(a.client,a.userId);}catch(e){syncError='Pending changes are retained. '+e.message;}
 const repository=new window.ProjectsCloudRepository(a.client,a.userId);const payload=await repository.load();const data=payload?{payload,version:repository.version,updated_at:repository.updatedAt}:null;
 if(!data)return {tasks:[],projects:[],milestones:[],version:0,updatedAt:null};
 if(Number(data.payload?.schemaVersion)!==1||!data.payload.records)throw Error('Unsupported Projects workspace.');
 observed=structuredClone(data.payload);observedOwner=a.userId;
 const tasks=new Map();for(const r of [...(observed.records.tasks||[]),...(observed.records.captures||[])]){const t=normaliseTask(r);if(t)tasks.set(t.id,t);}
 const pending=queue(a.userId);
 return {tasks:[...tasks.values()],projects:(observed.projects||[]).filter(r=>!r.deletedAt),milestones:(observed.records.milestones||[]).filter(r=>!r.deletedAt),version:Number(data.version)||0,updatedAt:data.updated_at||null,pendingCount:pending.length,conflictCount:pending.filter(op=>op.conflicts?.length).length,syncError};
}
async function setOwnProjectsTaskCompleted(taskId,completed){
 const a=await account();if(!a)throw Error('You are not signed in.');
 if(!observed||observedOwner!==a.userId)await loadProjectsFeed();
 const changes=[];const now=new Date().toISOString();
 for(const collection of ['tasks','captures'])for(const before of observed.records[collection]||[]){
  if(String(before.id)!==String(taskId)||before.type!=='Task'||before.deletedAt)continue;
  changes.push({collection,id:String(taskId),before:structuredClone(before),after:{...structuredClone(before),status:completed?'completed':'active',completedAt:completed?now:null,updatedAt:now}});
 }
 if(!changes.length)throw Error('That Projects task could not be found.');
 const op=globalThis.ProjectsSyncProtocol.operation(a.userId,changes,queue(a.userId));localStorage.setItem(PREFIX+a.userId+':'+op.id,JSON.stringify(op));
 try{await drain(a.client,a.userId);}catch(e){throw Error('Your status change is protected and will retry when connected. '+e.message);}
 const feed=await loadProjectsFeed();const acknowledgement=JSON.parse(localStorage.getItem(HISTORY+a.userId+':'+op.id)||'null');if(acknowledgement?.result?.conflicts?.length)throw Error('A concurrent change needs review in Projects. Both versions are retained.');return feed;
}

let revision=0,lastFingerprint='';
export async function loadProjectsFeed(){
 const own=await loadOwnProjectsFeed(),shared=await loadSharedProjects();
 const next={...own,tasks:[...own.tasks,...shared.tasks],projects:[...own.projects,...shared.projects],milestones:[...own.milestones,...shared.milestones],syncError:[own.syncError,shared.syncError].filter(Boolean).join(' ')};
 const fingerprint=JSON.stringify({tasks:next.tasks,projects:next.projects,milestones:next.milestones,syncError:next.syncError});
 if(fingerprint!==lastFingerprint){revision++;lastFingerprint=fingerprint;}
 return {...next,version:revision};
}
export async function setProjectsTaskCompleted(taskId,completed){
 if(String(taskId).startsWith('shared:')){await setSharedTaskCompleted(taskId,completed);return loadProjectsFeed();}
 return setOwnProjectsTaskCompleted(taskId,completed);
}
