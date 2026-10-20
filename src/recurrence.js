/* Calendar date recurrence shared by Projects and FLOW. No storage or network effects. */
(function(root) {
  'use strict';
  const PREFIX = 'occurrence:';
  const MARKER = '::recurrence:';
  const DAY = 86400000;
  const clone = value => structuredClone(value);
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T12:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0,10) === value;
  }
  function addDays(value, days) {
    if (!validDate(value)) throw Error('A valid date is required.');
    return new Date(Date.parse(value + 'T12:00:00Z') + days * DAY).toISOString().slice(0,10);
  }
  function today(timeZone = 'America/New_York', now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const part = name => parts.find(p => p.type === name).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function validate(rule) {
    if (!rule || rule.version !== 1 || !validDate(rule.startDate) || !['none','daily','weekdays','weekly','interval','monthly'].includes(rule.frequency)) throw Error('Invalid repeat schedule.');
    if (rule.endDate && (!validDate(rule.endDate) || rule.endDate < rule.startDate)) throw Error('The end date must be on or after the start date.');
    if (rule.frequency === 'interval' && (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 999 || !['days','weeks','months'].includes(rule.unit))) throw Error('Choose an interval from 1 to 999 days, weeks or months.');
    if (rule.frequency === 'weekly' && (!Array.isArray(rule.weekdays) || !rule.weekdays.length || rule.weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(rule.weekdays).size !== rule.weekdays.length)) throw Error('Select at least one weekday.');
    if (rule.reminderTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.reminderTime)) throw Error('Choose a valid reminder time.');
    try { new Intl.DateTimeFormat('en', {timeZone:rule.timeZone}).format(); } catch { throw Error('Choose a valid time zone.'); }
    if (!rule.timeZone) throw Error('A time zone is required.');
    return rule;
  }
  function matches(rule, value, checked = false) {
    if (!checked) validate(rule);
    if (!validDate(value) || value < rule.startDate || (rule.endDate && value > rule.endDate) || rule.frequency === 'none') return false;
    const d = new Date(value + 'T12:00:00Z'), start = new Date(rule.startDate + 'T12:00:00Z');
    const days = Math.round((d - start) / DAY), weekday = d.getUTCDay();
    if (rule.frequency === 'daily') return true;
    if (rule.frequency === 'weekdays') return weekday > 0 && weekday < 6;
    if (rule.frequency === 'weekly') return rule.weekdays.includes(weekday);
    if (rule.frequency === 'interval' && rule.unit !== 'months') return days % (rule.interval * (rule.unit === 'weeks' ? 7 : 1)) === 0;
    const months = (d.getUTCFullYear() - start.getUTCFullYear()) * 12 + d.getUTCMonth() - start.getUTCMonth();
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate();
    return months % (rule.frequency === 'monthly' ? 1 : rule.interval) === 0 && d.getUTCDate() === Math.min(start.getUTCDate(), lastDay);
  }
  function identity(id, date) { return `${id}${MARKER}${date}`; }
  function split(id) {
    const index = String(id).lastIndexOf(MARKER);
    if (index < 0) return null;
    const date = id.slice(index + MARKER.length);
    return validDate(date) ? {id:id.slice(0,index), date} : null;
  }
  function snapshot(record, date) {
    const values = {};
    for (const field of ['title','type','project','projectId','assignedTo','priority','notes','createdAt']) if (record[field] !== undefined) values[field] = clone(record[field]);
    const first = date === record.recurrence.startDate;
    return {...values,dueDate:date,status:first ? record.status || 'active' : 'active',completedAt:first ? record.completedAt || null : null,deletedAt:null,reminderTime:record.recurrence.reminderTime || '',scheduleTimeZone:record.recurrence.timeZone};
  }
  function occurrence(record, date) {
    if (!record.recurrence) throw Error('This task has no repeat schedule.');
    validate(record.recurrence);
    const saved = record[PREFIX + date];
    if (!saved && !matches(record.recurrence,date)) throw Error('This occurrence is not part of the schedule. Reload the task.');
    return {...(saved || snapshot(record,date)), id:identity(record.id,date),seriesId:record.id,occurrenceDate:date,recurrence:clone(record.recurrence),project:record.project,projectId:record.projectId,seriesDeletedAt:record.deletedAt || null,deletedAt:record.deletedAt || saved?.deletedAt || null};
  }
  function expand(record, from, to) {
    if (!record.recurrence || record.type !== 'Task') return [clone(record)];
    const rule = validate(record.recurrence), dates = new Set();
    const start = from && from > rule.startDate ? from : rule.startDate;
    const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
    if (!validDate(to) || (from && !validDate(from))) throw Error('A valid schedule range is required.');
    if (rule.frequency !== 'none') {
      if ((Date.parse(end) - Date.parse(start)) / DAY > 50000) throw Error('Choose a schedule range shorter than 137 years.');
      for (let date = start; date <= end; date = addDays(date,1)) if (matches(rule,date,true)) dates.add(date);
    }
    for (const field of Object.keys(record)) if (field.startsWith(PREFIX) && validDate(field.slice(PREFIX.length))) {
      const date = field.slice(PREFIX.length), saved = record[field];
      if (!saved || typeof saved !== 'object' || !validDate(saved.dueDate)) throw Error('Invalid saved occurrence. Existing data has been kept.');
      if ((!from || saved.dueDate >= from) && saved.dueDate <= to) dates.add(date);
    }
    return [...dates].map(date => occurrence(record,date)).filter(r => (!from || r.dueDate >= from) && r.dueDate <= to).sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  }
  function view(record, to) {
    const rows = expand(record,'',to);
    if (!record.recurrence) return rows;
    const known = new Set(rows.map(row => row.id));
    for (const field of Object.keys(record)) if (field.startsWith(PREFIX) && validDate(field.slice(PREFIX.length))) {
      const row = occurrence(record,field.slice(PREFIX.length));
      if (!known.has(row.id)) { rows.push(row); known.add(row.id); }
    }
    const rule = validate(record.recurrence);
    if (!rows.some(row => row.dueDate >= today(rule.timeZone) && !row.deletedAt && row.status !== 'completed') && rule.frequency !== 'none') {
      let date = rule.startDate > to ? rule.startDate : addDays(to,1);
      for (let count = 0; count < 31001 && (!rule.endDate || date <= rule.endDate); count++,date = addDays(date,1)) {
        if (matches(rule,date,true)) {
          const row = occurrence(record,date);
          if (!row.deletedAt && row.status !== 'completed') { if (!known.has(row.id)) rows.push(row); break; }
        }
      }
    }
    return rows.sort((a,b) => (a.dueDate || '').localeCompare(b.dueDate || '') || a.id.localeCompare(b.id));
  }
  function updateOccurrence(record, date, patch, source = 'Projects', actor = null, now = new Date().toISOString()) {
    const before = occurrence(record,date), after = {...before};
    if (record.deletedAt) throw Error('Restore the repeating task before changing its occurrences.');
    const allowed = ['title','priority','notes','dueDate','status','completedAt','deletedAt','reminderTime'];
    for (const field of Object.keys(patch)) if (allowed.includes(field)) after[field] = clone(patch[field]);
    if (!after.title?.trim() || !validDate(after.dueDate) || !['active','completed'].includes(after.status)) throw Error('Invalid occurrence details.');
    if (after.reminderTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(after.reminderTime)) throw Error('Invalid reminder time.');
    const event = patch.status && patch.status !== before.status ? patch.status === 'completed' ? 'completed' : 'reopened' : patch.deletedAt ? 'deleted' : patch.deletedAt === null && before.deletedAt ? 'restored' : 'edited';
    after.completedAt = after.status === 'completed' ? before.status === 'completed' ? before.completedAt : now : null;
    after.updatedAt = now;
    after.audit = [...(before.audit || []), {event,at:now,source,actor,before:Object.fromEntries(allowed.map(k => [k,before[k] ?? null])),after:Object.fromEntries(allowed.map(k => [k,after[k] ?? null]))}];
    for (const field of ['id','seriesId','occurrenceDate','recurrence','seriesDeletedAt']) delete after[field];
    return {...clone(record), [PREFIX + date]:after, updatedAt:now};
  }
  function configure(record, rule, cutoff = today(rule.timeZone), now = new Date().toISOString(), preserveOriginal = true) {
    validate(rule);
    if (record.type !== 'Task') throw Error('Only tasks can repeat.');
    const next = clone(record);
    if (record.recurrence) {
      if (record.recurrence.startDate !== rule.startDate) throw Error('The original start date is preserved. Move individual occurrences using Edit.');
      for (const row of expand(record,'',cutoff)) {
        if (!next[PREFIX + row.occurrenceDate]) next[PREFIX + row.occurrenceDate] = snapshot(record,row.occurrenceDate);
      }
    } else if (rule.frequency === 'none') return next;
    // Keep the original task's existing due date and completion exactly once.
    if (!record.recurrence && preserveOriginal && validDate(record.dueDate)) next[PREFIX + record.dueDate] = {...snapshot({...record,recurrence:rule},record.dueDate),status:record.status || 'active',completedAt:record.completedAt || null,deletedAt:record.deletedAt || null};
    if (rule.frequency === 'none' && !Object.keys(next).some(field => field.startsWith(PREFIX))) next[PREFIX + record.recurrence.startDate] = snapshot(record,record.recurrence.startDate);
    next.recurrence = clone(rule);
    next.recurrenceHistory = [...(record.recurrenceHistory || []), {at:now,previous:record.recurrence || null,rule:clone(rule)}];
    return next;
  }
  function resolveConflict(latest, before, desired, actor = null) {
    if (!latest || !before || !(desired.recurrence || latest.recurrence)) return clone(desired);
    const next = clone(latest), equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
    for (const field of new Set([...Object.keys(before),...Object.keys(desired)])) {
      if (['id','createdAt','updatedAt','syncStatusRevision'].includes(field) || equal(before[field],desired[field])) continue;
      if (!Object.hasOwn(desired,field)) { delete next[field]; continue; }
      next[field] = clone(desired[field]);
      if (field.startsWith(PREFIX) && latest[field]) {
        const events = new Map([...(latest[field].audit || []),...(desired[field].audit || [])].map(event => [JSON.stringify(event),event]));
        next[field].audit = [...events.values(), {event:'conflict resolved',at:new Date().toISOString(),source:'Projects',actor}];
      }
      if (field === 'recurrenceHistory') next[field] = [...new Map([...(latest[field] || []),...(desired[field] || [])].map(event => [JSON.stringify(event),event])).values()];
    }
    return next;
  }
  function configureReport(workspace) {
    const next = clone(workspace), found = [];
    for (const key of ['tasks','captures']) for (const r of next.records[key] || []) if (r.type === 'Task' && !r.deletedAt && r.title === 'Daily Excedere End of Day Report' && r.project === 'Excedere Operations & Reporting') found.push({key,r});
    if (found.length !== 1) throw Error('Expected exactly one existing daily report task. No task was created.');
    const {key,r} = found[0];
    if (r.dueDate !== '2026-10-20') throw Error('The report due date has changed. Review before configuring recurrence.');
    const rule = {version:1,frequency:'daily',startDate:'2026-10-20',endDate:'',timeZone:'America/New_York',reminderTime:''};
    if (r.recurrence) {
      validate(r.recurrence);
      if (r.recurrence.frequency === 'daily' && r.recurrence.startDate === rule.startDate && !r.recurrence.endDate) return next;
      throw Error('The report already has a different repeat schedule. Review it before changing production data.');
    }
    const index = next.records[key].indexOf(r);
    next.records[key][index] = configure(r,rule,'2026-10-20');
    return next;
  }
  root.ExcedereRecurrence = {validDate,addDays,today,validate,matches,identity,split,occurrence,expand,view,updateOccurrence,configure,resolveConflict,configureReport};
})(globalThis);
