import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expandSources,findSource,findProjectsTask,projectsTasksForRange} from '../src/projects-recurrence.js';
import {scheduleTasks,projectsTaskLink} from '../src/projects-schedule.js';
import {seed} from '../src/model.js';
const R=globalThis.ExcedereRecurrence;
const record=R.configure({id:'stable:id',title:'Report',type:'Task',project:'Operations',dueDate:'2026-10-20',priority:'High',status:'active'}, {version:1,frequency:'daily',startDate:'2026-10-20',timeZone:'America/New_York',reminderTime:'18:30'},'2026-10-20');
test('FLOW schedule generates beyond feed horizon and keeps future completion independent',()=>{
 const sources=[{record,collection:'tasks'}],feed={recurrenceSources:sources,tasks:expandSources(sources,'2026-10-20','2026-10-21')},state=seed();state.tasks=[];
 const groups=scheduleTasks(state,feed,'2030-10-21','2030-10-27','2026-10-20');assert.equal(groups.week.length,7);assert.equal(new Set(groups.week.map(t=>t.id)).size,7);
 const task=groups.week[0];assert.equal(findProjectsTask(feed,task.id).date,'2030-10-21');assert.equal(task.time,'18:30');assert.equal(task.scheduleTimeZone,'America/New_York');assert.ok(projectsTaskLink(task.id).includes(encodeURIComponent(task.id)));
});
test('shared and owner task identities never collide; source resolves original record only',()=>{
 const shared={record,collection:'tasks',prefix:'shared:owner:project:',ownerId:'owner',accessScope:'shared:owner:project'},sources=[{record,collection:'tasks'},shared];
 const rows=expandSources(sources,'2026-10-20','2026-10-21');assert.equal(rows.length,4);assert.equal(new Set(rows.map(t=>t.id)).size,4);
 const row=rows.find(t=>t.ownerId==='owner');const match=findSource(sources,row.id);assert.equal(match.source,shared);assert.equal(match.date,'2026-10-20');assert.equal(match.source.record.id,'stable:id');assert.equal(findSource(sources,'unknown'),null);
});
test('reload reflects one completed date while tomorrow and nonrecurring records remain active',()=>{
 const done=R.updateOccurrence(record,'2026-10-20',{status:'completed'},'FLOW','owner');
 const sources=JSON.parse(JSON.stringify([{record:done},{record:{id:'single',type:'Task',title:'Other',project:'Other',dueDate:'2026-10-20',status:'active'}}]));
 const rows=projectsTasksForRange({recurrenceSources:sources},'2026-10-20','2026-10-21');assert.equal(rows.length,3);assert.equal(rows.find(t=>t.occurrenceDate==='2026-10-20').status,'Completed');assert.equal(rows.find(t=>t.date==='2026-10-21').status,'Not Started');assert.equal(rows.find(t=>t.id==='single').status,'Not Started');
});
test('saved moved exceptions appear once in destination week and vanished access has no sources',()=>{
 const moved=R.updateOccurrence(record,'2026-10-21',{dueDate:'2026-11-09'});const rows=expandSources([{record:moved}],'2026-11-09','2026-11-15');assert.equal(rows.length,8);assert.equal(rows.filter(t=>t.id===R.identity(record.id,'2026-10-21')).length,1);assert.equal(findProjectsTask({tasks:[],recurrenceSources:[]},rows[0].id),null);
});
