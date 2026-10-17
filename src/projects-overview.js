/* Read only views use source IDs; no Projects records are copied into FLOW. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function projectsOverview(feed){
 const projects=feed.projects||[],milestones=feed.milestones||[],tasks=feed.tasks||[];
 const names=new Set([...projects.map(p=>p.name),...milestones.map(m=>m.project),...tasks.map(t=>t.project)]);
 const warning=feed.pendingCount?`<p role="status">${esc(feed.syncError||`${feed.pendingCount} protected changes are pending. ${feed.conflictCount||0} need review in Projects.`)}</p>`:'';
 return `<section aria-label="Excedere Projects account overview"><h2>Managed in Excedere Projects</h2><p class="subtle">Live account records. Open Projects to edit project plans and milestones.</p>${warning}<div class="card-grid">${[...names].sort().map(name=>{
  const project=projects.find(p=>p.name===name),ms=milestones.filter(m=>m.project===name),ts=tasks.filter(t=>t.project===name);
  const target=ts.length?'#task='+encodeURIComponent(ts[0].id):'';
  return `<article class="record-card" data-projects-source="${esc(project?.id||name)}"><h3>${esc(name)}</h3><p>${ts.length} tasks, ${ts.filter(t=>t.status==='Completed').length} completed. ${ms.length} milestones.</p>${ms.length?'<ul>'+ms.map(m=>`<li data-projects-milestone="${esc(m.id)}">${esc(m.title)}: ${m.status==='completed'?'Completed':'Active'}${m.dueDate?' · '+esc(m.dueDate):''}</li>`).join('')+'</ul>':''}<a href="https://excederemanagementconsultancy.github.io/excedere-projects/${target}" target="_blank" rel="noopener noreferrer">Open in Excedere Projects</a></article>`;
 }).join('')}</div></section>`;
}
