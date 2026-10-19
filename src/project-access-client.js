/* Scoped project access. No shared payload is copied into the private workspace. */
(()=>{
 'use strict';
 const PREFIX='excedereProjectAccessV1:';
 class ProjectAccessClient{
  constructor(client){this.client=client;this.actor=null;this.epoch=0;this.unsubscribe=client.auth.onAuthStateChange((event,session)=>{const next=session?.user?.id||null;if(next!==this.actor){this.epoch++;this.actor=next;}}).data?.subscription;}
  async identity(){const {data,error}=await this.client.auth.getSession();if(error)throw error;const id=data.session?.user?.id;if(!id)throw Error('Sign in required.');if(this.actor===null)this.actor=id;return id;}
  async rpc(name,args={}){
   const actor=await this.identity(),epoch=this.epoch,controller=new AbortController();let timer;
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('Connection timed out. Your draft is retained.'),{code:'TIMEOUT'}));},20000);});
   try{let request=this.client.rpc(name,args);if(request.abortSignal)request=request.abortSignal(controller.signal);const {data,error}=await Promise.race([request,timeout]);if(error)throw error;if(epoch!==this.epoch||actor!==await this.identity())throw Object.assign(Error('Account changed. Reload this view.'),{code:'28000'});return data;}finally{clearTimeout(timer);}
  }
  list(){return this.rpc('list_authorized_projects');}
  read(owner,project){return this.rpc('read_authorized_project',{p_owner:owner,p_project:project});}
  collaborators(owner,project){return this.rpc('project_collaborators',{p_owner:owner,p_project:project});}
  share(owner,project,email,enabled){return this.rpc('set_project_member',{p_owner:owner,p_project:project,p_email:email,p_enabled:enabled});}
  async pending(){const actor=await this.identity(),rows=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(PREFIX+actor+':')){const op=JSON.parse(localStorage.getItem(k));if(op.actor===actor&&!op.resolved)rows.push(op);}}return rows.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}
  key(op){return PREFIX+op.actor+':'+op.id;}
  async send(op){
   if(op.actor!==await this.identity())throw Error('Draft belongs to another account.');
   try{const result=await this.rpc('commit_authorized_project',{p_owner:op.owner,p_project:op.project,p_version:op.version,p_operation:op.id,p_changes:op.changes,p_actor:op.actor});localStorage.removeItem(this.key(op));return result;}
   catch(error){if(['40001','42501','22023'].includes(error.code)){op.blocked=true;op.reason=error.message;localStorage.setItem(this.key(op),JSON.stringify(op));}throw error;}
  }
  async commit(projection,changes){
   const actor=await this.identity();if(projection.actorId&&projection.actorId!==actor)throw Object.assign(Error('Account changed. Reload this view.'),{code:'28000'});
   const op={id:crypto.randomUUID(),actor,owner:projection.ownerId,project:projection.projectId,version:projection.version,changes,createdAt:new Date().toISOString()};
   localStorage.setItem(this.key(op),JSON.stringify(op));return this.send(op);
  }
  async retry(){for(const op of await this.pending())if(!op.blocked)await this.send(op);}
  close(){this.epoch++;this.unsubscribe?.unsubscribe();}
 }
 window.ProjectAccessClient=ProjectAccessClient;
})();
