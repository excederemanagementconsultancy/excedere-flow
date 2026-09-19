import {validate} from './model.js';
import {upgradeGuides} from './task-guides.js';
export class CloudRepository {
 constructor(client,userId){this.client=client;this.userId=userId;this.version=0;this.snapshot=null;}
 async load(){
  const {data,error}=await this.client.from('flow_workspaces').select('payload,version').eq('user_id',this.userId).maybeSingle();
  if(error)throw error;
  if(!data)return null;
  this.snapshot=upgradeGuides(validate(data.payload));this.version=data.version;return structuredClone(this.snapshot);
 }
 async save(state){
  validate(state);
  const {data,error}=await this.client.rpc('save_flow_workspace',{expected_version:this.version,new_payload:state});
  if(error)throw Error(error.message.includes('conflict')?'Another device saved newer work. Export your current data, then reload before trying again.':error.message);
  if(!Number.isInteger(data))throw Error('The server did not confirm the save. Please reload.');
  this.version=data;this.snapshot=structuredClone(state);
 }
 raw(){return JSON.stringify(this.snapshot);}
}
