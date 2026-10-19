import './project-access-client.js';
let api=null,client=null,actor=null,observed=new Map();
async function account(){
 const next=window.ExcedereFlowSupabase;if(!next)return null;
 const {data,error}=await next.auth.getSession();if(error)throw error;const id=data.session?.user?.id;
 if(client!==next||actor!==id){api?.close();observed.clear();client=next;actor=id;api=id?new window.ProjectAccessClient(next):null;}
 return api;
}
export async function loadSharedProjects(){
 const access=await account();observed.clear();if(!access)return {tasks:[],projects:[],milestones:[],syncError:''};
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
    const id=prefix+encodeURIComponent(r.id);observed.set(id,{projection:p,record:r,collection:p.records.tasks.includes(r)?'tasks':'captures'});
    const date=/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate||'')?r.dueDate:'';
    tasks.push({key:'projects:'+id,id,sourceId:r.id,sourceSystem:'projects',ownerId:p.ownerId,accessScope:scope,title:r.title,area:r.project,project:r.project,priority:['Urgent','High'].includes(r.priority)?'High':r.priority==='Low'?'Low':'Medium',sourcePriority:r.priority||'Normal',status:r.status==='completed'?'Completed':'Not Started',date,dueDate:date,time:'',recurring:false,notes:r.notes||'',completedAt:r.completedAt||'',createdAt:r.createdAt||'',updatedAt:r.updatedAt||''});
   }
   for(const r of p.records.milestones)if(!r.deletedAt)milestones.push({...r,id:prefix+r.id,sourceId:r.id,ownerId:p.ownerId,accessScope:scope});
  }
  if(token!==await access.identity())throw Error('Account changed.');
  return {tasks,projects,milestones,syncError:''};
 }catch(e){observed.clear();return {tasks:[],projects:[],milestones:[],syncError:'Shared projects unavailable. '+e.message};}
}
export async function setSharedTaskCompleted(id,completed){
 const access=await account(),entry=observed.get(id);if(!access||!entry)throw Error('Reload your authorized Projects tasks.');
 const {projection,record,collection}=entry;
 await access.commit(projection,[{collection,id:record.id,before:record,after:{...record,projectId:projection.projectId,status:completed?'completed':'active'}}]);
}
