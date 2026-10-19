/* Read only views use source IDs; no Projects records are copied into FLOW. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function projectsOverview(feed){
 const projects=feed.projects||[],milestones=feed.milestones||[],tasks=feed.tasks||[],groups=new Map();
 const group=(key,name)=>{if(!groups.has(key))groups.set(key,{name,projects:[],milestones:[],tasks:[]});return groups.get(key);};
 for(const p of projects)group(p.accessScope||p.name,p.name).projects.push(p);
 for(const m of milestones)group(m.accessScope||m.project,m.project).milestones.push(m);
 for(const t of tasks)group(t.accessScope||t.project,t.project).tasks.push(t);
 const warning=(feed.pendingCount||feed.syncError)?`<p role="status">${esc(feed.syncError||`${feed.pendingCount} protected changes are pending. ${feed.conflictCount||0} need review in Projects.`)}</p>`:'';
 return `<section aria-label="Excedere Projects account overview"><h2>Managed in Excedere Projects</h2><p class="subtle">Live account records. Open Projects to edit project plans and milestones.</p>${warning}<div class="card-grid">${[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(g=>{
  const project=g.projects[0],ms=g.milestones,ts=g.tasks;
  const target=project?.ownerId?'#shared='+encodeURIComponent(project.ownerId+':'+project.sourceId):ts.length?'#task='+encodeURIComponent(ts[0].id):'';
  return `<article class="record-card" data-projects-source="${esc(project?.id||g.name)}"><h3>${esc(g.name)}</h3>${project?.ownerId?'<p>Shared project</p>':''}<p>${ts.length} tasks, ${ts.filter(t=>t.status==='Completed').length} completed. ${ms.length} milestones.</p>${ms.length?'<ul>'+ms.map(m=>`<li data-projects-milestone="${esc(m.id)}">${esc(m.title)}: ${m.status==='completed'?'Completed':'Active'}${m.dueDate?' · '+esc(m.dueDate):''}</li>`).join('')+'</ul>':''}<a href="https://excederemanagementconsultancy.github.io/excedere-projects/${target}" target="_blank" rel="noopener noreferrer">Open in Excedere Projects</a></article>`;
 }).join('')}</div></section>`;
}
