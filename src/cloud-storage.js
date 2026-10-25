import {validate} from './model.js';
import {upgradeGuides} from './task-guides.js';

const conflictMessage='Another device saved newer work. Export your current data, then reload before trying again.';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// Rebase only a single date edit when the cloud task itself is unchanged.
// All other conflicts retain the existing refusal to overwrite newer work.
function dateOnlyEdit(before,after){
 if(!before)return null;
 for(const task of before.tasks){
  const edited=after.tasks.find(row=>row.id===task.id);
  if(!edited||edited.date===task.date)continue;
  const expected=structuredClone(before);
  expected.tasks.find(row=>row.id===task.id).date=edited.date;
  if(equal(expected,after))return {task,date:edited.date};
 }
 return null;
}

export class CloudRepository {
 constructor(client,userId){this.client=client;this.userId=userId;this.version=0;this.snapshot=null;}
 async read(){
  const {data,error}=await this.client.from('flow_workspaces').select('payload,version').eq('user_id',this.userId).maybeSingle();
  if(error)throw error;
  return data;
 }
 async load(){
  const data=await this.read();
  if(!data)return null;
  this.snapshot=upgradeGuides(validate(data.payload));this.version=data.version;return structuredClone(this.snapshot);
 }
 async save(state){
  validate(state);
  let result=await this.client.rpc('save_flow_workspace',{expected_version:this.version,new_payload:state});
  if(result.error?.message.includes('conflict')){
   const edit=dateOnlyEdit(this.snapshot,state);
   if(edit){
    const latest=await this.read();
    if(latest){
     const merged=upgradeGuides(validate(latest.payload));
     const target=merged.tasks.find(row=>row.id===edit.task.id);
     if(equal(target,edit.task)){
      target.date=edit.date;
      validate(merged);
      result=await this.client.rpc('save_flow_workspace',{expected_version:latest.version,new_payload:merged});
      if(!result.error&&Number.isInteger(result.data)){
       // The caller adopts this object after save. Preserve all newer cloud records.
       for(const key of Object.keys(state))delete state[key];
       Object.assign(state,merged);
      }
     }
    }
   }
  }
  const {data,error}=result;
  if(error)throw Error(error.message.includes('conflict')?conflictMessage:error.message);
  if(!Number.isInteger(data))throw Error('The server did not confirm the save. Please reload.');
  this.version=data;this.snapshot=structuredClone(state);
 }
 raw(){return JSON.stringify(this.snapshot);}
}
