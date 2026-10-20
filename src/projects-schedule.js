import {projectsTasksForRange} from './projects-recurrence.js?v=recurrence-v1';
import {addDays, occurrences, PRIORITIES} from './model.js';

// Read Projects records directly. Never copy them into the FLOW workspace.
export function scheduleTasks(state, feed, start, end, today) {
  const projects = [...new Map(projectsTasksForRange(feed,'',end > today ? end : today).map(task => [task.id, task])).values()];
  const sort = list => list.sort((a, b) =>
    (a.date || '9999').localeCompare(b.date || '9999') ||
    (a.time || '99').localeCompare(b.time || '99') ||
    PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
  );
  return {
    week: sort([
      ...occurrences(state, start, end),
      ...projects.filter(task => task.date && task.date >= start && task.date <= end)
    ]),
    overdue: sort([
      ...occurrences(state, '', addDays(today, -1)),
      ...projects.filter(task => task.date && task.date < today)
    ].filter(task => task.status !== 'Completed')),
    unscheduled: sort([
      ...state.tasks.filter(task => !task.date).map(task => ({...task, key: task.id, originalDate: ''})),
      ...projects.filter(task => !task.date)
    ])
  };
}

export function projectsTaskLink(id) {
  const value=String(id);
  if(value.startsWith('shared:')){const [,owner,project]=value.split(':');return `https://excederemanagementconsultancy.github.io/excedere-projects/#shared=${encodeURIComponent(owner+':'+decodeURIComponent(project))}`;}
  return `https://excederemanagementconsultancy.github.io/excedere-projects/#task=${encodeURIComponent(id)}`;
}
