/* Read-only Excedere Projects feed for Excedere Flow.
   Excedere Projects remains the source of truth. */

const PRIORITY_MAP = {
  Urgent: 'High',
  High: 'High',
  Normal: 'Medium',
  Low: 'Low'
};

const EMPTY_FEED = () => ({
  tasks: [],
  version: 0,
  updatedAt: null
});

function validDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

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

  const id =
    String(record.id || '').trim();

  if (!id) {
    return null;
  }

  const project =
    typeof record.project === 'string' &&
    record.project.trim()
      ? record.project.trim()
      : 'Excedere Projects';

  const completed =
    record.status === 'completed';

  return {
    /*
     * Separate key namespace prevents a
     * Projects task colliding with one of
     * Flow's own task IDs.
     */
    key: `projects:${id}`,

    id,
    sourceId: id,
    sourceSystem: 'projects',

    title: record.title.trim(),

    /*
     * Flow calls this field "area".
     * For imported Projects work we use
     * the owning project name.
     */
    area: project,
    project,

    priority:
      PRIORITY_MAP[
        record.priority
      ] || 'Medium',

    status:
      completed
        ? 'Completed'
        : 'Not Started',

    date:
      validDate(record.dueDate)
        ? record.dueDate
        : '',

    dueDate:
      validDate(record.dueDate)
        ? record.dueDate
        : '',

    time: '',
    recurring: false,

    notes:
      typeof record.notes === 'string'
        ? record.notes
        : '',

    completedAt:
      typeof record.completedAt === 'string'
        ? record.completedAt
        : '',

    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : '',

    createdAt:
      typeof record.createdAt === 'string'
        ? record.createdAt
        : ''
  };
}

function uniqueTasks(records) {
  const result =
    new Map();

  for (const record of records) {
    const task =
      normaliseTask(record);

    if (!task) {
      continue;
    }

    result.set(
      task.id,
      task
    );
  }

  return [
    ...result.values()
  ];
}

async function getClientAndUser() {
  const client =
    window.ExcedereFlowSupabase;

  if (!client) {
    return null;
  }

  const {
    data,
    error
  } =
    await client.auth.getSession();

  if (error) {
    throw error;
  }

  const userId =
    data.session?.user?.id;

  if (!userId) {
    return null;
  }

  return {
    client,
    userId
  };
}

export async function loadProjectsFeed() {
  const account =
    await getClientAndUser();

  if (!account) {
    return EMPTY_FEED();
  }

  const {
    client,
    userId
  } = account;

  const {
    data,
    error
  } =
    await client
      .from(
        'projects_workspaces'
      )
      .select(
        'payload, version, updated_at'
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return EMPTY_FEED();
  }

  const payload =
    data.payload;

  if (
    !payload ||
    Number(
      payload.schemaVersion
    ) !== 1 ||
    !payload.records
  ) {
    throw new Error(
      'The Excedere Projects workspace is not supported.'
    );
  }

  /*
   * Excedere Projects currently stores
   * some tasks in the normal Tasks list
   * and others inside Quick Capture.
   *
   * Both collections therefore need to
   * be checked.
   */
  const records = [
    ...(
      Array.isArray(
        payload.records.tasks
      )
        ? payload.records.tasks
        : []
    ),

    ...(
      Array.isArray(
        payload.records.captures
      )
        ? payload.records.captures
        : []
    )
  ];

  return {
    tasks:
      uniqueTasks(records),

    version:
      Number(
        data.version
      ) || 0,

    updatedAt:
      data.updated_at ||
      null
  };
}
