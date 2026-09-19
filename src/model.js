import { sourceTables } from './seed-data.js';
import {safeLink} from './task-guides.js';
export const SCHEMA_VERSION = 1;
export const TASK_STATUSES = ['Not Started', 'In Progress', 'Completed'];
export const IDEA_STATUSES = ['Idea', 'Draft', 'Scheduled', 'Used'];
export const PROJECT_STATUSES = ['Not Started', 'In Progress', 'Live', 'Future', 'Completed'];
export const PRIORITIES = ['High', 'Medium', 'Low'];
export const uid = () => crypto.randomUUID();
export function today(zone = 'Europe/London', now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(k => p.find(x => x.type === k).value).join('-');
}
export const addDays = (date, days) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); };
export const weekday = date => new Date(date + 'T12:00:00Z').getUTCDay();
export const weekStart = date => addDays(date, -((weekday(date) + 6) % 7));
export function seed(date = today()) {
  const workspaceId = 'excedere';
  const common = { workspaceId };
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const areas = [...new Set(['Marketing','Sales','Finance','Operations','Clients','Recruitment','Admin', ...sourceTables[0].slice(1).map(r => r[3]), ...sourceTables[1].slice(1).map(r => r[1])])];
  return { schemaVersion: SCHEMA_VERSION, workspace: { id: workspaceId, name: 'Excedere', timeZone: 'Europe/London' }, areas,
    tasks: sourceTables[0].slice(1).map((r,i) => ({ ...common, id: `weekly-${i}`, title: r[4], area:r[3], status:r[5], notes:r[6], priority:'Medium', date:addDays(weekStart(date),(dayNames.indexOf(r[0])+6)%7), time:convertTime(r[1]), recurring:true, projectId:'', source:{day:r[0],timeUK:r[1],timeET:r[2]} })),
    ideas:sourceTables[1].slice(1).map((r,i) => ({ ...common,id:`idea-${i}`,title:r[0],area:r[1],priority:r[2],status:r[3]==='Yes'?'Used':'Idea',notes:r[4],sourceUsed:r[3] })),
    projects:sourceTables[2].slice(1).map((r,i) => ({ ...common,id:`project-${i}`,title:r[0],priority:r[1],status:r[2],notes:r[3],area:'Marketing',progress:r[2]==='Live'?100:0 })), overrides:{}, createdAt:new Date().toISOString() };
}
function convertTime(t) { const [_,hour,minute,period] = t.match(/(\d+):(\d+) (AM|PM)/); return `${String(Number(hour)%12+(period==='PM'?12:0)).padStart(2,'0')}:${minute}`; }
export function occurrences(state, from, to) {
  const result = [];
  for (const task of state.tasks) {
    if (!task.recurring) { if ((!task.date && from==='') || (task.date >= from && task.date <= to)) result.push({...task,key:task.id,originalDate:task.date}); continue; }
    const candidates = new Set();
    // Jump straight to the visible range, retaining earlier moved occurrences.
    const diff = Math.floor((new Date((from||task.date)+'T12:00:00Z')-new Date(task.date+'T12:00:00Z'))/86400000);
    let d = addDays(task.date, Math.max(0,Math.ceil(diff/7))*7);
    while(d<=to) { candidates.add(d); d=addDays(d,7); }
    for (const key of Object.keys(state.overrides)) if(key.startsWith(task.id+'@')) candidates.add(key.slice(task.id.length+1));
    for (const originalDate of candidates) {
      const key = task.id+'@'+originalDate;
      const patch = state.overrides[key] || {};
      if(patch.deleted) continue;
      const row = {...task,date:originalDate,...patch,key,originalDate};
      if(row.date>=from && row.date<=to) result.push(row);
    }
  }
  return result.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999') || (a.time||'99').localeCompare(b.time||'99') || PRIORITIES.indexOf(a.priority)-PRIORITIES.indexOf(b.priority));
}
export function updateOccurrence(state, row, patch) {
  if(row.recurring) state.overrides[row.key] = {...state.overrides[row.key],...patch};
  else Object.assign(state.tasks.find(t=>t.id===row.id),patch);
}
export function removeTask(state, row, series=false) {
  if(row.recurring && !series) state.overrides[row.key] = {deleted:true};
  else {state.tasks = state.tasks.filter(t=>t.id!==row.id); for(const k of Object.keys(state.overrides)) if(k.startsWith(row.id+'@')) delete state.overrides[k];}
}
export const progress = rows => ({done:rows.filter(t=>t.status==='Completed').length,total:rows.length,percent:rows.length?Math.round(rows.filter(t=>t.status==='Completed').length/rows.length*100):0});
export function projectProgress(state, project, date) {
  const rows = occurrences(state,weekStart(date),addDays(weekStart(date),6)).filter(t=>t.projectId===project.id);
  const allSingles = state.tasks.filter(t=>!t.recurring&&t.projectId===project.id&&!rows.some(r=>r.id===t.id));
  const linked = [...rows,...allSingles];
  return linked.length ? {...progress(linked), linked:true} : {percent:project.progress,linked:false};
}
function validateExtras(r) {
  if(r.checklist!==undefined && (!Array.isArray(r.checklist)||r.checklist.length>100||new Set(r.checklist.map(s=>s?.id)).size!==r.checklist.length||r.checklist.some(s=>!s||!str(s.id,100)||!str(s.label,500)||!s.label.trim()||typeof s.done!=='boolean'))) throw Error('Invalid checklist.');
  if(r.linkIds!==undefined && (!Array.isArray(r.linkIds)||r.linkIds.length>100||r.linkIds.some(id=>!str(id,100)))) throw Error('Invalid task links.');
}
const validDate = s => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const str = (s,max=10000) => typeof s==='string' && s.length<=max;
export function validate(data) {
  if(!data || data.schemaVersion!==1 || !data.workspace || !str(data.workspace.id,100) || !str(data.workspace.name,100) || !str(data.workspace.timeZone,100)) throw Error('This is not a supported Flow backup.');
  try { today(data.workspace.timeZone); } catch {throw Error('The workspace timezone is invalid.');}
  if(!Array.isArray(data.areas)||data.areas.some(a=>!str(a,100)||!a.trim())||!data.overrides||typeof data.overrides!=='object'||Array.isArray(data.overrides)) throw Error('Invalid areas or recurring tasks.');
  for(const kind of ['tasks','ideas','projects']) {
    if(!Array.isArray(data[kind]) || data[kind].length>50000) throw Error('Invalid records.');
    const ids = new Set();
    for(const r of data[kind]) {
      if(!r||!str(r.id,100)||!/^[a-zA-Z0-9-]+$/.test(r.id)||ids.has(r.id)||r.workspaceId!==data.workspace.id||!str(r.title,300)||!r.title.trim()||!str(r.area,100)||!str(r.notes)||!PRIORITIES.includes(r.priority)) throw Error('A record contains invalid fields.');
      ids.add(r.id); validateExtras(r);
      const statuses = kind==='tasks'?TASK_STATUSES:kind==='ideas'?IDEA_STATUSES:PROJECT_STATUSES;
      if(!statuses.includes(r.status)) throw Error('A record has an invalid status.');
      if(kind==='tasks' && ((!validDate(r.date)&&r.date!=='') || (r.recurring&&!validDate(r.date)) || typeof r.recurring!=='boolean' || !/^$|^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)||!str(r.projectId,100))) throw Error('A task has an invalid schedule.');
      if(kind==='projects'&&(!Number.isFinite(r.progress)||r.progress<0||r.progress>100)) throw Error('Invalid project progress.');
    }
  }
  for(const [key,patch] of Object.entries(data.overrides)) {
    const [id,date] = key.split('@');
    const base = data.tasks.find(t=>t.id===id && t.recurring);
    if(!base||!validDate(date)||date<base.date||(Date.parse(date)-Date.parse(base.date))/86400000%7!==0||!patch||typeof patch!=='object'||Array.isArray(patch)) throw Error('Invalid recurring occurrence.');
    validateExtras(patch);
    const allowed=['title','area','priority','status','date','time','notes','projectId','deleted','checklist','linkIds'];
    if(Object.keys(patch).some(k=>!allowed.includes(k))) throw Error('Unsupported recurring fields.');
    if(patch.deleted!==undefined&&typeof patch.deleted!=='boolean') throw Error('Invalid recurrence deletion.');
    if(patch.title!==undefined&&(!str(patch.title,300)||!patch.title.trim())||patch.notes!==undefined&&!str(patch.notes)||patch.area!==undefined&&!str(patch.area,100)||patch.projectId!==undefined&&!str(patch.projectId,100)||patch.status!==undefined&&!TASK_STATUSES.includes(patch.status)||patch.priority!==undefined&&!PRIORITIES.includes(patch.priority)||patch.date!==undefined&&!validDate(patch.date)||patch.time!==undefined&&!/^$|^([01]\d|2[0-3]):[0-5]\d$/.test(patch.time)) throw Error('Invalid recurring fields.');
  }
  if(data.links!==undefined && (!Array.isArray(data.links)||data.links.length>100||new Set(data.links.map(l=>l?.id)).size!==data.links.length||data.links.some(l=>!l||!str(l.id,100)||!str(l.label,100)||!l.label.trim()||!safeLink(l.url)))) throw Error('Use a valid HTTPS address for each useful link.');
  return data;
}
