/* Read-only Excedere Projects feed for Excedere Flow.
   Projects remains the source of truth. */

const PRIORITY_MAP = {
  Urgent: 'High',
  High: 'High',
  Normal: 'Medium',
  Low: 'Low'
};

const validDate = value =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value);

function normaliseTask(record) {
  if (
    !record ||
    typeof record !== 'object' ||
    record.type !== 'Task' ||
    typeof record.title !== 'string' ||
    !record.title.trim() ||
    record.deletedAt
  ) {
    return null;
  }

  return {
    id: String(record.id || ''),
    title: record.title.trim(),
    project:
      typeof record.project === 'string' &&
      record.project.trim()
        ? record.project.trim()
        : 'General',

    priority:
      PRIORITY_MAP[record.priority] ||
      'Medium',

    status:
      record.status === 'completed'
        ? 'Completed'
        : 'Not Started',

    dueDate:
      validDate(record.dueDate)
        ? record.dueDate
        : '',

    notes:
      typeof record.notes === 'string'
        ? record.notes
        : '',

    sourceSystem: 'projects'
  };
}

function uniqueTasks(records) {
  const result = new Map();

  for (const record of records) {
    const task = normaliseTask(record);

    if (!task || !task.id) {
      continue;
    }

    result.set(task.id, task);
  }

  return [...result.values()];
}

export async function loadProjectsFeed(
  client,
  userId
) {
  if (!client || !userId) {
    return {
      tasks: [],
      version: 0,
      updatedAt: null
    };
  }

  const { data, error } =
    await client
      .from('projects_workspaces')
      .select(
        'payload, version, updated_at'
      )
      .eq('user_id', userId)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      tasks: [],
      version: 0,
      updatedAt: null
    };
  }

  const payload = data.payload;

  if (
    !payload ||
    Number(payload.schemaVersion) !== 1 ||
    !payload.records
  ) {
    throw new Error(
      'The Excedere Projects workspace is not supported.'
    );
  }

  /*
   * Projects stores normal Tasks separately
   * from Quick Capture records. Both can
   * contain real Tasks.
   */
  const records = [
    ...(Array.isArray(
      payload.records.tasks
    )
      ? payload.records.tasks
      : []),

    ...(Array.isArray(
      payload.records.captures
    )
      ? payload.records.captures
      : [])
  ];

  return {
    tasks: uniqueTasks(records),
    version: Number(data.version) || 0,
    updatedAt:
      data.updated_at || null
  };
}
