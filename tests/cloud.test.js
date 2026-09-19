import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudRepository} from '../src/cloud-storage.js';
import {seed} from '../src/model.js';
test('cloud save advances only after server confirmation',async()=>{
 let fail=false;
 const client={rpc:async(name,args)=>{assert.equal(name,'save_flow_workspace');assert.equal(args.expected_version,0);return fail?{error:{message:'Workspace conflict'}}:{data:1};}};
 const repo=new CloudRepository(client,'user-a');fail=true;
 await assert.rejects(repo.save(seed()),/Another device/);assert.equal(repo.version,0);assert.equal(repo.snapshot,null);
 fail=false;await repo.save(seed());assert.equal(repo.version,1);assert.ok(repo.snapshot);
});
test('cloud load requests only signed-in owner and upgrades old data',async()=>{
 const client={from:name=>{assert.equal(name,'flow_workspaces');return {select:()=>({eq:(key,id)=>{assert.equal(key,'user_id');assert.equal(id,'user-a');return {maybeSingle:async()=>({data:{payload:seed(),version:8}})};}})};}};
 const repo=new CloudRepository(client,'user-a');const loaded=await repo.load();assert.equal(repo.version,8);assert.equal(loaded.tasks[0].checklist.length,4);
 loaded.tasks[0].title='Changed locally';assert.notEqual(repo.snapshot.tasks[0].title,'Changed locally');
});
