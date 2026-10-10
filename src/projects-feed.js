/* Excedere Projects feed for Excedere Flow.
   Projects remains the source of truth.

   Flow may:
   1. Read Projects tasks
   2. Mark a Projects task complete
   3. Reopen a Projects task

   Flow does not edit titles, dates, notes,
   priorities, projects or other Projects data.
*/

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
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(value+'T12:00:00Z');
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
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
    String(
      record.id || ''
    ).trim();


  if (!id) {
    return null;
  }


  const project =
    typeof record.project === 'string' &&
    record.project.trim()
      ? record.project.trim()
      : 'Excedere Projects';


  const completed =
    record.status ===
    'completed';


  return {
    key:
      `projects:${id}`,

    id,

    sourceId:
      id,

    sourceSystem:
      'projects',

    title:
      record.title.trim(),

    area:
      project,

    project,

    priority:
      PRIORITY_MAP[
        record.priority
      ] ||
      'Medium',

    sourcePriority:
      Object.hasOwn(PRIORITY_MAP,record.priority)
        ? record.priority
        : 'Normal',

    status:
      completed
        ? 'Completed'
        : 'Not Started',

    date:
      validDate(
        record.dueDate
      )
        ? record.dueDate
        : '',

    dueDate:
      validDate(
        record.dueDate
      )
        ? record.dueDate
        : '',

    time:
      '',

    recurring:
      false,

    notes:
      typeof record.notes ===
      'string'
        ? record.notes
        : '',

    completedAt:
      typeof record.completedAt ===
      'string'
        ? record.completedAt
        : '',

    updatedAt:
      typeof record.updatedAt ===
      'string'
        ? record.updatedAt
        : '',

    createdAt:
      typeof record.createdAt ===
      'string'
        ? record.createdAt
        : ''
  };
}


function uniqueTasks(records) {
  const result =
    new Map();


  for (
    const record
    of records
  ) {
    const task =
      normaliseTask(
        record
      );


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
    window
      .ExcedereFlowSupabase;


  if (!client) {
    return null;
  }


  const {
    data,
    error
  } =
    await client.auth
      .getSession();


  if (error) {
    throw error;
  }


  const userId =
    data.session
      ?.user
      ?.id;


  if (!userId) {
    return null;
  }


  return {
    client,
    userId
  };
}


async function loadWorkspace(
  client,
  userId
) {
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
    return null;
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


  return data;
}


function recordsFromPayload(
  payload
) {
  return [
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


  const data =
    await loadWorkspace(
      client,
      userId
    );


  if (!data) {
    return EMPTY_FEED();
  }


  return {
    tasks:
      uniqueTasks(
        recordsFromPayload(
          data.payload
        )
      ),

    version:
      Number(
        data.version
      ) || 0,

    updatedAt:
      data.updated_at ||
      null
  };
}


/*
 * Changes only the completion status of
 * one Projects task.
 *
 * The task may live in records.tasks,
 * records.captures, or both.
 *
 * Updating both prevents duplicate copies
 * from drifting out of sync.
 */
function applyTaskStatus(
  payload,
  taskId,
  completed
) {
  const next =
    structuredClone(
      payload
    );


  const now =
    new Date()
      .toISOString();


  let found =
    false;


  for (
    const collectionName
    of [
      'tasks',
      'captures'
    ]
  ) {
    const collection =
      next.records[
        collectionName
      ];


    if (
      !Array.isArray(
        collection
      )
    ) {
      continue;
    }


    for (
      const record
      of collection
    ) {
      if (
        String(
          record?.id || ''
        ) !==
        String(taskId)
      ) {
        continue;
      }


      if (
        record.type !==
        'Task' ||
        record.deletedAt
      ) {
        continue;
      }


      record.status =
        completed
          ? 'completed'
          : 'active';


      record.updatedAt =
        now;


      record.completedAt =
        completed
          ? now
          : null;


      found =
        true;
    }
  }


  if (!found) {
    throw new Error(
      'That Projects task could not be found.'
    );
  }


  return next;
}


async function saveTaskStatusOnce(
  client,
  userId,
  taskId,
  completed
) {
  const current =
    await loadWorkspace(
      client,
      userId
    );


  if (!current) {
    throw new Error(
      'The Excedere Projects workspace could not be found.'
    );
  }


  const nextPayload =
    applyTaskStatus(
      current.payload,
      taskId,
      completed
    );


  const {
    data,
    error
  } =
    await client.rpc(
      'save_projects_workspace',
      {
        expected_version:
          Number(
            current.version
          ) || 0,

        new_payload:
          nextPayload
      }
    );


  if (error) {
    throw error;
  }


  if (!Number.isInteger(Number(data)) || Number(data)<=Number(current.version)) {
    throw new Error('The server did not confirm the Projects save. Refresh before trying again.');
  }

  return {
    version:
      Number(data) || 0,

    payload:
      nextPayload
  };
}


/*
 * Public status update used by Flow.
 *
 * If Projects changes at exactly the same
 * time, the Supabase version guard rejects
 * the stale save. We reload and safely try
 * the requested status change one more time.
 */
export async function setProjectsTaskCompleted(
  taskId,
  completed
) {
  const account =
    await getClientAndUser();


  if (!account) {
    throw new Error(
      'You are not signed in.'
    );
  }


  const {
    client,
    userId
  } = account;


  try {
    await saveTaskStatusOnce(
      client,
      userId,
      taskId,
      completed
    );

  } catch (error) {
    const message =
      String(
        error?.message ||
        ''
      ).toLowerCase();


    const conflict =
      message.includes(
        'conflict'
      );


    if (!conflict) {
      throw error;
    }


    /*
     * One controlled retry against the
     * newest Projects version.
     */
    await saveTaskStatusOnce(
      client,
      userId,
      taskId,
      completed
    );
  }


  /*
   * Reload after saving so Flow receives
   * the exact version now stored in
   * Supabase.
   */
  return loadProjectsFeed();
}
