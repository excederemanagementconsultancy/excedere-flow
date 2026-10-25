import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudRepository} from '../src/cloud-storage.js';
import {LocalRepository} from '../src/storage.js';
import {seed,validate,occurrences,updateOccurrence} from '../src/model.js';
import {upgradeGuides} from '../src/task-guides.js';
const backup=upgradeGuides(seed('2026-10-21'));
backup.tasks.push({...structuredClone(backup.tasks[0]),id:'test-date-task',recurring:false,date:'2026-10-21'});
function fixture(){
 const state=structuredClone(backup),task=state.tasks.find(t=>!t.recurring);
 task.date='2026-10-21';task.checklist=[{id:'done',label:'Done',done:true},{id:'open',label:'Open',done:false}];return state;
}
function server(payload){
 let cloud=structuredClone(payload),version=4,writes=0,race=false;
 const client={from:name=>{assert.equal(name,'flow_workspaces');return {select:()=>({eq:(key,id)=>{assert.equal(key,'user_id');assert.equal(id,'test-owner');return {maybeSingle:async()=>({data:{payload:structuredClone(cloud),version}})};}})};},rpc:async(name,args)=>{
  assert.equal(name,'save_flow_workspace');writes++;
  if(race||args.expected_version!==version)return {error:{message:'Workspace conflict'}};
  validate(args.new_payload);cloud=structuredClone(args.new_payload);return {data:++version};
 }};
 return {client,get payload(){return cloud;},get writes(){return writes;},change(fn){fn(cloud);version++;},race(){race=true;}};
}
function edit(state){const task=state.tasks.find(t=>!t.recurring);updateOccurrence(state,{...task,key:task.id},{date:'2026-10-28'});return task.id;}
test('October 21 to 28 local save/reload changes only the date',()=>{
 const state=fixture(),expected=structuredClone(state),id=edit(state),map=new Map(),repo=new LocalRepository({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)});
 repo.save(state);expected.tasks.find(t=>t.id===id).date='2026-10-28';assert.deepEqual(repo.load(),expected);
});
test('ordinary cloud date save survives reload',async()=>{
 const srv=server(fixture()),repo=new CloudRepository(srv.client,'test-owner'),state=await repo.load(),id=edit(state);await repo.save(state);
 assert.equal((await repo.load()).tasks.find(t=>t.id===id).date,'2026-10-28');assert.equal(srv.writes,1);
});
test('stale date save preserves newer unrelated cloud work and all history',async()=>{
 const srv=server(fixture()),repo=new CloudRepository(srv.client,'test-owner'),state=await repo.load(),id=edit(state);
 srv.change(s=>{s.ideas[0].notes='New idea';s.tasks.find(t=>t.id!==id).notes='Concurrent note';});
 const expected=structuredClone(srv.payload);expected.tasks.find(t=>t.id===id).date='2026-10-28';await repo.save(state);
 assert.equal(srv.writes,2);assert.deepEqual(state,expected);assert.deepEqual(await repo.load(),expected);
});
for(const scenario of ['same task','second conflict','additional edit'])test(scenario+' preserves conflict protection and draft',async()=>{
 const srv=server(fixture()),repo=new CloudRepository(srv.client,'test-owner'),state=await repo.load(),id=edit(state);
 srv.change(s=>{if(scenario==='same task')s.tasks.find(t=>t.id===id).checklist[1].done=true;else s.ideas[0].notes='Concurrent work';});
 if(scenario==='second conflict')srv.race();if(scenario==='additional edit')state.tasks.find(t=>t.id===id).notes+=' edited';
 const cloud=structuredClone(srv.payload),draft=structuredClone(state);await assert.rejects(repo.save(state),/Another device/);
 assert.equal(srv.writes,scenario==='second conflict'?2:1);assert.deepEqual(srv.payload,cloud);assert.deepEqual(state,draft);assert.equal(repo.version,4);
});
test('recurring date save retains stable occurrence key and neighboring history',async()=>{
 const state=fixture(),task=state.tasks.find(t=>t.recurring),row=occurrences(state,'2026-10-21','2026-10-27').find(t=>t.id===task.id),before=structuredClone(state);
 updateOccurrence(state,row,{date:'2026-10-28'});const srv=server(state),repo=new CloudRepository(srv.client,'test-owner'),loaded=await repo.load();await repo.save(loaded);
 const expected={...before.overrides,[row.key]:{...before.overrides[row.key],date:'2026-10-28'}};
 assert.deepEqual((await repo.load()).overrides,expected);assert.deepEqual(loaded.tasks,before.tasks);
});
