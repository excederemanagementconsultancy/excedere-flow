import './recurrence.js?v=recurrence-v1';
const engine = globalThis.ExcedereRecurrence;
const PRIORITY_MAP = {Urgent:'High',High:'High',Normal:'Medium',Low:'Low'};
export function taskId(source, recordId) { return source.prefix ? source.prefix + encodeURIComponent(recordId) : recordId; }
export function normaliseTask(row, source = {}) {
  if (!row || row.type !== 'Task' || !row.id || !row.title?.trim() || row.deletedAt) return null;
  const project = row.project?.trim() || 'Excedere Projects', id = taskId(source,row.id);
  return {key:'projects:' + id,id,sourceId:source.record?.id || row.id,sourceSystem:'projects',ownerId:source.ownerId,accessScope:source.accessScope,title:row.title.trim(),area:project,project,priority:PRIORITY_MAP[row.priority] || 'Medium',sourcePriority:row.priority || 'Normal',status:row.status === 'completed' ? 'Completed' : 'Not Started',date:engine.validDate(row.dueDate) ? row.dueDate : '',dueDate:engine.validDate(row.dueDate) ? row.dueDate : '',time:row.reminderTime || '',scheduleTimeZone:row.scheduleTimeZone || row.recurrence?.timeZone || '',recurring:false,repeatSchedule:row.recurrence?.frequency || '',occurrenceDate:row.occurrenceDate || '',notes:row.notes || '',completedAt:row.completedAt || '',updatedAt:row.updatedAt || '',createdAt:row.createdAt || ''};
}
export function expandSources(sources, from = '', to = engine.addDays(engine.today(),31)) {
  const rows = new Map();
  for (const source of sources) {
    if (source.record.deletedAt) continue;
    for (const row of engine.expand(source.record,from,to)) {
      const task = normaliseTask(row,source);
      if (task) rows.set(task.id,task);
    }
  }
  return [...rows.values()];
}
export function findSource(sources, id) {
  for (const source of sources) {
    if (source.record.deletedAt) continue;
    if (taskId(source,source.record.id) === id && !source.record.recurrence) return {source,row:source.record,date:null};
    let rawId = id;
    if (source.prefix) {
      if (!id.startsWith(source.prefix)) continue;
      try { rawId = decodeURIComponent(id.slice(source.prefix.length)); } catch { continue; }
    }
    const part = engine.split(rawId);
    if (part?.id === source.record.id && source.record.recurrence) {
      const row = engine.occurrence(source.record,part.date);
      if (!row.deletedAt) return {source,row,date:part.date};
    }
  }
  return null;
}
export function projectsTasksForRange(feed, from, to) {
  return feed.recurrenceSources ? expandSources(feed.recurrenceSources,from,to) : feed.tasks || [];
}
export function findProjectsTask(feed,id) {
  const task = (feed.tasks || []).find(row => row.id === id);
  if (task) return task;
  const match = findSource(feed.recurrenceSources || [],id);
  return match ? normaliseTask(match.row,match.source) : null;
}
