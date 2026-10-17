/* Atomic, account scoped Projects operations with durable server receipts. */
(()=>{
  'use strict';
  function bounded(request){
    const controller=typeof AbortController==='function'?new AbortController():null;
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller?.abort();reject(Object.assign(Error('Connection timed out. Pending changes are retained and will retry.'),{code:'TIMEOUT'}));},20000);});
    const pending=controller&&typeof request.abortSignal==='function'?request.abortSignal(controller.signal):request;
    return Promise.race([pending,timeout]).finally(()=>clearTimeout(timer));
  }
  class ProjectsCloudRepository{
    constructor(client,userId){this.client=client;this.userId=userId;this.version=0;this.payload=null;}
    validate(payload){if(!payload||Number(payload.schemaVersion)!==1||!payload.records)throw Error('Invalid Projects workspace.');return payload;}
    async load(){const {data,error}=await bounded(this.client.from('projects_workspaces').select('payload, version, updated_at').eq('user_id',this.userId).maybeSingle());if(error)throw error;this.version=Number(data?.version)||0;this.updatedAt=data?.updated_at||null;this.payload=data?this.validate(structuredClone(data.payload)):null;return this.payload;}
    async receipt(id){const {data,error}=await bounded(this.client.from('projects_sync_operations').select('result').eq('user_id',this.userId).eq('operation_id',id).maybeSingle());if(error)throw error;return data?.result||null;}
    async commit(operation){const {data,error}=await bounded(this.client.rpc('commit_projects_changes',{operation_id:operation.id,changes:operation.changes,owner_id:this.userId}));if(error)throw error;if(!data||!Number.isInteger(data.version)||!Array.isArray(data.conflicts))throw Error('Server acknowledgement is invalid. Pending work is retained.');this.version=Math.max(this.version,data.version);return data;}
    async save(payload){if(!this.payload){this.validate(payload);const {data,error}=await bounded(this.client.rpc('initialise_projects_workspace',{owner_id:this.userId,operation_id:crypto.randomUUID(),new_payload:payload}));if(error)throw error;if(!data?.version)throw Error('Workspace creation was not confirmed. Browser work is retained.');await this.load();return this.version;}const op={id:crypto.randomUUID(),changes:globalThis.ProjectsSyncProtocol.diff(this.payload,payload)};const result=await this.commit(op);if(result.conflicts.length)throw Error('Conflicting fields need review.');await this.load();return this.version;}
  }
  window.ProjectsCloudRepository=ProjectsCloudRepository;
})();
