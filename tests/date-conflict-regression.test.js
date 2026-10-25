import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudRepository} from '../src/cloud-storage.js';
import {seed,validate,occurrences,updateOccurrence} from '../src/model.js';
import {upgradeGuides} from '../src/task-guides.js';
import {scheduleTasks} from '../src/projects-schedule.js';
function base(){
 const state=upgradeGuides(seed('2026-10-21'));
 for(const id of ['test-date-task','test-other-task'])state.tasks.push({...structuredClone(state.tasks[0]),id,recurring:false,date:'2026-10-21'});
 return state;
}
async function setup(change,reply){
 const initial=base(),target=initial.tasks.find(t=>!t.recurring);target.date='2026-10-21';
 let cloud=structuredClone(initial),version=20,calls=0,readError=null;
 const client={from:table=>{assert.equal(table,'flow_workspaces');return {select:()=>({eq:(key,id)=>{assert.equal(key,'user_id');assert.equal(id,'owner');return {maybeSingle:async()=>readError?{error:readError}:{data:cloud?{payload:structuredClone(cloud),version}:null}};}})};},rpc:async(name,args)=>{
  assert.equal(name,'save_flow_workspace');calls++;
  if(calls===1)return {error:{message:'Workspace conflict'}};
  assert.equal(args.expected_version,version);
  if(reply)return reply;
  validate(args.new_payload);cloud=structuredClone(args.new_payload);return {data:++version};
 }};
 const repo=new CloudRepository(client,'owner'),draft=await repo.load();
 draft.tasks.find(t=>t.id===target.id).date='2026-10-28';
 if(change)change(cloud,target.id);version++;
 return {repo,draft,id:target.id,get cloud(){return cloud;},get calls(){return calls;},missing(){cloud=null;},readFail(){readError=Error('read unavailable');}};
}
for(const [name,change] of Object.entries({
 'target deleted':(s,id)=>{s.tasks=s.tasks.filter(t=>t.id!==id);},
 'target date changed':(s,id)=>{s.tasks.find(t=>t.id===id).date='2026-10-29';},
 'target notes changed':(s,id)=>{s.tasks.find(t=>t.id===id).notes+=' remote';},
 'target made recurring':(s,id)=>{s.tasks.find(t=>t.id===id).recurring=true;}
}))test(name+' blocks retry and preserves draft',async()=>{
 const x=await setup(change),before=structuredClone(x.draft),cloud=structuredClone(x.cloud);
 await assert.rejects(x.repo.save(x.draft),/Another device/);assert.equal(x.calls,1);assert.deepEqual(x.draft,before);assert.deepEqual(x.cloud,cloud);assert.equal(x.repo.version,20);
});
test('new cloud task and recurring checklist/history preserved byte for byte',async()=>{
 const x=await setup((s,id)=>{
  const row=s.tasks.find(t=>t.recurring),occ=occurrences(s,'2026-10-21','2026-10-27').find(t=>t.id===row.id);
  updateOccurrence(s,occ,{checklist:[{id:'remote-tick',label:'Completed remotely',done:true}],notes:'Occurrence notes'});
  s.tasks.push({...structuredClone(s.tasks.find(t=>t.id===id)),id:'concurrent-new-task',title:'New cloud task'});
 });
 const expected=structuredClone(x.cloud);expected.tasks.find(t=>t.id===x.id).date='2026-10-28';await x.repo.save(x.draft);
 assert.deepEqual(x.cloud,expected);assert.deepEqual(x.draft,expected);assert.deepEqual(x.repo.snapshot,expected);assert.equal(x.calls,2);
});
for(const [name,reply] of Object.entries({
 'permission failure':{error:{message:'permission denied'}},
 'missing confirmation':{data:null},
 'non integer confirmation':{data:'22'}
}))test(name+' does not adopt merged payload or advance version',async()=>{
 const x=await setup(s=>{s.ideas[0].notes='Cloud note';},reply),draft=structuredClone(x.draft),snapshot=structuredClone(x.repo.snapshot);
 await assert.rejects(x.repo.save(x.draft));assert.deepEqual(x.draft,draft);assert.deepEqual(x.repo.snapshot,snapshot);assert.equal(x.repo.version,20);
});
test('missing workspace cannot be recreated by conflict retry',async()=>{
 const x=await setup();x.missing();await assert.rejects(x.repo.save(x.draft),/Another device/);assert.equal(x.calls,1);assert.equal(x.cloud,null);
});
test('read failure leaves submitted draft and snapshot intact',async()=>{
 const x=await setup(),draft=structuredClone(x.draft),snapshot=structuredClone(x.repo.snapshot);x.readFail();await assert.rejects(x.repo.save(x.draft),/read unavailable/);assert.equal(x.calls,1);assert.deepEqual(x.draft,draft);assert.deepEqual(x.repo.snapshot,snapshot);
});
test('two task date edits cannot bypass conflict guard',async()=>{
 const x=await setup(),other=x.draft.tasks.find(t=>t.id!==x.id&&!t.recurring);other.date='2026-10-30';await assert.rejects(x.repo.save(x.draft),/Another device/);assert.equal(x.calls,1);
});
test('Projects feed remains separate and unchanged after FLOW retry',async()=>{
 const x=await setup(s=>{s.ideas[0].notes='Concurrent note';});
 const feed={tasks:[{id:'project-owned-task',key:'projects:project-owned-task',title:'Projects task',sourceSystem:'projects',date:'2026-10-28',priority:'High',status:'Not Started'}]};
 const before=structuredClone(feed);await x.repo.save(x.draft);
 const schedule=scheduleTasks(x.draft,feed,'2026-10-26','2026-11-01','2026-10-25');
 assert.equal(schedule.week.filter(t=>t.id==='project-owned-task').length,1);assert.deepEqual(feed,before);assert.equal(x.draft.tasks.some(t=>t.id==='project-owned-task'),false);
});
