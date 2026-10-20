import {expandSources,findSource} from './projects-recurrence.js?v=recurrence-v1';
import './project-access-client.js';
let api=null,client=null,actor=null,observed=new Map(),sources=[];
async function account(){
 const next=window.ExcedereFlowSupabase;if(!next)return null;
 const {data,error}=await next.auth.getSession();if(error)throw error;const id=data.session?.user?.id;
 if(client!==next||actor!==id){api?.close();observed.clear();client=next;actor=id;api=id?new window.ProjectAccessClient(next):null;}
 return api;
}
export async function loadSharedProjects(){
 const access=await account();observed.clear();sources=[];if(!access)return {tasks:[],projects:[],milestones:[],syncError:''};
 const token=actor,tasks=[],projects=[],milestones=[];
 try{
  await access.retry();
 }catch(e){/* Keep durable drafts; fresh authorized reads decide what may be displayed. */}
 try{
  const catalog=await access.list();
  for(const entry of catalog.filter(p=>!p.owned)){
   const p=await access.read(entry.ownerId,entry.projectId);
   if(actor!==token||access!==api)throw Error('Account changed.');
   const scope='shared:'+p.ownerId+':'+encodeURIComponent(p.projectId),prefix=scope+':';
   projects.push({...p.project,id:prefix+p.projectId,sourceId:p.projectId,ownerId:p.ownerId,accessScope:scope});
   for(const r of [...p.records.tasks,...p.records.captures]){
    if(r.type!=='Task'||r.deletedAt)continue;
    sources.push({record:r,collection:p.records.tasks.includes(r)?'tasks':'captures',projection:p,prefix,ownerId:p.ownerId,accessScope:scope});
   }
   for(const r of p.records.milestones)if(!r.deletedAt)milestones.push({...r,id:prefix+r.id,sourceId:r.id,ownerId:p.ownerId,accessScope:scope});
  }
  if(token!==await access.identity())throw Error('Account changed.');
  return {tasks:expandSources(sources),recurrenceSources:sources,projects,milestones,syncError:''};
 }catch(e){observed.clear();sources=[];return {tasks:[],projects:[],milestones:[],syncError:'Shared projects unavailable. '+e.message};}
}
export async function setSharedTaskCompleted(id,completed){
 const access=await account(),match=findSource(sources,id);if(!access||!match)throw Error('Reload your authorized Projects tasks.');
 const {projection,record,collection}=match.source;
 const after=match.date
  ? globalThis.ExcedereRecurrence.updateOccurrence(record,match.date,{status:completed?'completed':'active'},'FLOW',actor)
  : {...record,status:completed?'completed':'active'};
 await access.commit(projection,[{collection,id:record.id,before:record,after:{...after,projectId:projection.projectId}}]);
}
