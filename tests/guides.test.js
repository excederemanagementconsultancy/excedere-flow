import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,validate,occurrences,updateOccurrence,addDays} from '../src/model.js';
import {upgradeGuides,safeLink} from '../src/task-guides.js';
import {LocalRepository,STORAGE_KEY} from '../src/storage.js';

test('upgrade preserves existing work and is idempotent',()=>{
 const original=seed('2026-09-19');original.tasks[0].notes='My own notes';
 const upgraded=upgradeGuides(original);
 assert.equal(upgraded.tasks[0].notes,'My own notes');
 assert.equal(original.tasks[0].checklist,undefined);
 assert.equal(upgraded.tasks.every(t=>t.checklist.length===4),true);
 upgraded.tasks[0].checklist[0].done=true;
 assert.deepEqual(upgradeGuides(upgraded),upgraded);validate(upgraded);
});
test('weekly checklist ticks survive reload without leaking into next week',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 const repo=new LocalRepository(storage),state=upgradeGuides(seed('2026-09-19'));
 const row=occurrences(state,'2026-09-14','2026-09-20')[0];
 updateOccurrence(state,row,{checklist:row.checklist.map(s=>({...s,done:true})),notes:'Reviewed this week'});
 repo.save(state);const loaded=repo.load();
 assert.equal(occurrences(loaded,row.date,row.date)[0].checklist.every(s=>s.done),true);
 const next=occurrences(loaded,addDays(row.date,7),addDays(row.date,7)).find(t=>t.id===row.id);
 assert.equal(next.checklist.some(s=>s.done),false);
 assert.notEqual(next.notes,'Reviewed this week');
 assert.ok(store.has(STORAGE_KEY));
});
test('unsafe links and malformed checklists are rejected',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://name:password@example.com'])assert.equal(safeLink(url),false);
 const state=upgradeGuides(seed('2026-09-19'));state.tasks[0].checklist[0].done='yes';
 assert.throws(()=>validate(state));
});
