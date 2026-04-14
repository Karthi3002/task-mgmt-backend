import { pool, getClient } from '../config/db.js';

export const checkTaskAccess = async (taskId, userId) => {
  const result = await pool.query(
    `SELECT id FROM tasks
     WHERE id = $1
       AND deleted_at IS NULL
       AND (
         assigned_to_user_id = $2
         OR assigned_from_user_id = $2
         OR created_by = $2
       )`,
    [taskId, userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Access denied or task not found');
  }
};

// ─── ALLOWED STATUS TRANSITIONS ───────────────────────────────────────────────
const STATUS_TRANSITIONS = {
  open: ['yet_to_start', 'in_progress', 'dropped'],
  yet_to_start: ['in_progress', 'dropped'],
  in_progress: ['waiting_on_others', 'blocked', 'follow_up_needed', 'ready_for_review', 'completed', 'dropped'],
  waiting_on_others: ['in_progress', 'follow_up_needed', 'blocked', 'completed'],
  blocked: ['in_progress', 'follow_up_needed'],
  follow_up_needed: ['in_progress', 'completed'],
  ready_for_review: ['completed', 'in_progress'],
  completed: [],   // terminal
  closed: [],   // terminal
  dropped: [],   // terminal
};

// ─── BASE SELECT (reused across queries) ─────────────────────────────────────
const TASK_SELECT = `
  t.id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.category,
  t.task_type,
  t.is_general_task,
  t.project_id,
  t.due_date,
  t.follow_up_date,
  t.tags,
  t.task_code,
  t.start_date,
  t.completed_at,
  t.closed_at,
  t.created_by,
  t.created_at,
  t.updated_at,
  p.name              AS project_name,
  uf.id               AS assigned_from_user_id,
  uf.name             AS assigned_from_name,
  uf.email            AS assigned_from_email,
  ut.id               AS assigned_to_user_id,
  ut.name             AS assigned_to_name,
  ut.email            AS assigned_to_email
`;

// ─── LIST TASKS (with dynamic filters) ───────────────────────────────────────
export const getTasks = async (filters = {}, requestingUserId) => {
  const conditions = ['t.deleted_at IS NULL'];
  const params = [];
  let idx = 1;

  // 🔒 USER ACCESS CONTROL: Only return tasks where user is involved
  conditions.push(`(t.assigned_to_user_id = $${idx} OR t.assigned_from_user_id = $${idx} OR t.created_by = $${idx})`);
  params.push(requestingUserId);
  idx++;

  // status filter (can be array)
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    conditions.push(`t.status = ANY($${idx})`);
    params.push(statuses);
    idx++;
  }

  // priority
  if (filters.priority) {
    conditions.push(`t.priority = $${idx}`);
    params.push(filters.priority);
    idx++;
  }

  // project or general
  if (filters.project_id === 'general') {
    conditions.push(`t.is_general_task = true`);
  } else if (filters.project_id) {
    conditions.push(`t.project_id = $${idx}`);
    params.push(filters.project_id);
    idx++;
  }

  // assigned_to
  if (filters.assigned_to) {
    conditions.push(`t.assigned_to_user_id = $${idx}`);
    params.push(filters.assigned_to);
    idx++;
  }

  // assigned_from
  if (filters.assigned_from) {
    conditions.push(`t.assigned_from_user_id = $${idx}`);
    params.push(filters.assigned_from);
    idx++;
  }

  // task_type
  if (filters.task_type) {
    conditions.push(`t.task_type = $${idx}`);
    params.push(filters.task_type);
    idx++;
  }

  // due date range
  if (filters.due_date_from) {
    conditions.push(`t.due_date >= $${idx}`);
    params.push(filters.due_date_from);
    idx++;
  }
  if (filters.due_date_to) {
    conditions.push(`t.due_date <= $${idx}`);
    params.push(filters.due_date_to);
    idx++;
  }

  // follow_up_date today
  if (filters.follow_up_today) {
    conditions.push(`DATE(t.follow_up_date) = CURRENT_DATE`);
  }

  // overdue
  if (filters.overdue) {
    conditions.push(`t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('completed', 'closed', 'dropped')`);
  }

  // search (title + description)
  if (filters.search) {
    conditions.push(
      `t.search_vector @@ plainto_tsquery($${idx})`
    );
    params.push(filters.search);
    idx++;
  }

  // pagination
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const offset = (page - 1) * limit;

  // sort
  const sortAllowed = ['created_at', 'due_date', 'updated_at', 'priority'];
  const sortBy = sortAllowed.includes(filters.sort_by) ? filters.sort_by : 'created_at';
  const sortDir = filters.sort_dir === 'asc' ? 'ASC' : 'DESC';

  const whereClause = conditions.join(' AND ');

  const sql = `
    SELECT ${TASK_SELECT}
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    JOIN users uf ON uf.id = t.assigned_from_user_id
    JOIN users ut ON ut.id = t.assigned_to_user_id
    WHERE ${whereClause}
    ORDER BY t.${sortBy} ${sortDir}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);

  // count query
  const countSql = `
    SELECT COUNT(*) FROM tasks t
    WHERE ${whereClause}
  `;
  // count params don't include limit/offset
  const countParams = params.slice(0, -2);

  const [taskResult, countResult] = await Promise.all([
    pool.query(sql, params),
    pool.query(countSql, countParams),
  ]);

  const total = parseInt(countResult.rows[0].count);
  const totalPages = Math.ceil(total / limit);

  return {
    tasks: taskResult.rows,
    total,
    page,
    limit,
    totalPages,
    offset,
  };
};

// ─── SINGLE TASK (with notes + timeline) ─────────────────────────────────────
export const getTaskById = async (taskId, userId) => {
  const taskResult = await pool.query(
    `SELECT ${TASK_SELECT}
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     JOIN users uf ON uf.id = t.assigned_from_user_id
     JOIN users ut ON ut.id = t.assigned_to_user_id
     WHERE t.id = $1
       AND t.deleted_at IS NULL
       AND (t.assigned_to_user_id = $2 OR t.assigned_from_user_id = $2 OR t.created_by = $2)`,
    [taskId, userId]
  );

  const task = taskResult.rows[0];
  if (!task) return null;

  // notes
  const notesResult = await pool.query(
    `SELECT
        n.id, n.content, n.created_at,
        u.id AS author_id, u.name AS author_name, u.email AS author_email
     FROM task_notes n
     JOIN users u ON u.id = n.author_id
     WHERE n.task_id = $1 AND n.deleted_at IS NULL
     ORDER BY n.created_at ASC`,
    [taskId]
  );

  // timeline
  const timelineResult = await pool.query(
    `SELECT
        tl.id, tl.action, tl.details, tl.old_values, tl.new_values, tl.created_at,
        u.id AS author_id, u.name AS author_name
     FROM task_timeline tl
     JOIN users u ON u.id = tl.author_id
     WHERE tl.task_id = $1
     ORDER BY tl.created_at ASC`,
    [taskId]
  );

  return {
    ...task,
    notes: notesResult.rows,
    timeline: timelineResult.rows,
  };
};

// ─── CREATE TASK ──────────────────────────────────────────────────────────────
const TASK_TYPE_MAP = {
  'assigned to me': 'assigned_to_me',
  'assigned by me': 'assigned_by_me',
  'self task': 'self',
  'follow-up': 'follow_up',
  'follow up': 'follow_up',
  'review task': 'review',
  'review': 'review',
  'reminder': 'reminder',
  'general': 'general',
  'development': 'development',
};

const ALLOWED_TASK_TYPES = [
  'assigned_to_me',
  'assigned_by_me',
  'self',
  'follow_up',
  'reminder',
  'review',
  'general',
  'development',
];

export const createTask = async (data, creatorUserId) => {
  const {
    title,
    description,
    task_type,
    priority = 'medium',
    category = 'other',
    project_id,
    is_general_task = false,
    assigned_from_user_id,
    assigned_to_user_id,
    due_date,
    follow_up_date,
    tags = [],
    task_code,
    start_date,
  } = data;

  let normalizedTaskType = task_type?.toLowerCase().trim() || 'general';
  normalizedTaskType = TASK_TYPE_MAP[normalizedTaskType] || normalizedTaskType;

  if (!ALLOWED_TASK_TYPES.includes(normalizedTaskType)) {
    throw new Error(`Invalid task_type: ${task_type}`);
  }

  // validation
  if (!title?.trim()) throw new Error('Title is required');
  if (!is_general_task && !project_id) throw new Error('Project is required when not a general task');
  if (is_general_task && project_id) throw new Error('General tasks cannot have a project');

  // verify users exist
  const userCheck = await pool.query(
    `SELECT id FROM users WHERE id = ANY($1) AND is_active = true`,
    [[assigned_from_user_id, assigned_to_user_id]]
  );
  if (userCheck.rows.length < 2 && assigned_from_user_id !== assigned_to_user_id) {
    throw new Error('One or more assigned users not found');
  }

  // verify project exists (if provided)
  if (project_id) {
    const projCheck = await pool.query(
      `SELECT id FROM projects WHERE id = $1`,
      [project_id]
    );
    if (projCheck.rows.length === 0) throw new Error('Project not found');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const taskResult = await client.query(
      `INSERT INTO tasks (
         title, description, task_type, priority, category,
         project_id, is_general_task,
         assigned_from_user_id, assigned_to_user_id,
         due_date, follow_up_date, tags, status, task_code, start_date, created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'open',$13,$14,$15)
       RETURNING *`,
      [
        title.trim(),
        description || null,
        normalizedTaskType,
        priority,
        category,
        project_id || null,
        is_general_task,
        assigned_from_user_id,
        assigned_to_user_id,
        due_date || null,
        follow_up_date || null,
        tags,
        task_code || null,
        start_date || null,
        creatorUserId,
      ]
    );

    const task = taskResult.rows[0];

    // initial timeline entry
    await client.query(
      `INSERT INTO task_timeline (task_id, action, details, author_id, new_values)
       VALUES ($1, 'Task Created', $2, $3, $4)`,
      [
        task.id,
        `Task created by user`,
        creatorUserId,
        JSON.stringify({ title: task.title, status: 'open', priority }),
      ]
    );

    await client.query('COMMIT');
    return task;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── UPDATE TASK ──────────────────────────────────────────────────────────────
export const updateTask = async (taskId, userId, updates) => {
  // ownership check
  const existing = await pool.query(
    `SELECT * FROM tasks
     WHERE id = $1 AND deleted_at IS NULL
       AND (assigned_from_user_id = $2 OR assigned_to_user_id = $2 OR created_by = $2)`,
    [taskId, userId]
  );
  if (existing.rows.length === 0) throw new Error('Access denied or task not found');

  const task = existing.rows[0];
  const {
    title, description, priority, category,
    project_id, is_general_task, due_date, follow_up_date, tags,
  } = updates;

  const result = await pool.query(
    `UPDATE tasks SET
       title          = COALESCE($1, title),
       description    = COALESCE($2, description),
       priority       = COALESCE($3, priority),
       category       = COALESCE($4, category),
       project_id     = CASE WHEN $5::boolean THEN NULL ELSE COALESCE($6::uuid, project_id) END,
       is_general_task= COALESCE($5, is_general_task),
       due_date       = COALESCE($7, due_date),
       follow_up_date = COALESCE($8, follow_up_date),
       tags           = COALESCE($9, tags),
       updated_at     = NOW()
     WHERE id = $10
     RETURNING *`,
    [
      title?.trim() || null,
      description ?? null,
      priority || null,
      category || null,
      is_general_task ?? null,
      project_id || null,
      due_date || null,
      follow_up_date || null,
      tags || null,
      taskId,
    ]
  );

  // timeline entry for significant changes
  const changed = [];
  if (title && title !== task.title) changed.push('title');
  if (priority && priority !== task.priority) changed.push('priority');
  if (due_date && due_date !== task.due_date) changed.push('due_date');

  if (changed.length > 0) {
    await pool.query(
      `INSERT INTO task_timeline (task_id, action, details, author_id)
       VALUES ($1, 'Task Updated', $2, $3)`,
      [taskId, `Fields updated: ${changed.join(', ')}`, userId]
    );
  }

  return result.rows[0];
};

// ─── UPDATE TASK STATUS ───────────────────────────────────────────────────────
export const updateTaskStatus = async (taskId, userId, newStatus, reason) => {
  const existing = await pool.query(
    `SELECT * FROM tasks
     WHERE id = $1 AND deleted_at IS NULL
       AND (assigned_from_user_id = $2 OR assigned_to_user_id = $2 OR created_by = $2)`,
    [taskId, userId]
  );
  if (existing.rows.length === 0) throw new Error('Access denied or task not found');

  const task = existing.rows[0];
  
  // Normalize incoming status
  const normalizedStatus = newStatus.toLowerCase().trim();
  const currentStatus = task.status.toLowerCase();
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];

  // validate status exists in master table
  const statusCheck = await pool.query(
    `SELECT id FROM task_statuses 
     WHERE LOWER(status_code) = LOWER($1) 
     AND is_active = true`,
    [normalizedStatus]
  );

  // Validate status exists
  if (statusCheck.rows.length === 0) {
    throw new Error(`Invalid status: ${normalizedStatus}`);
  }

  // Optional: Validate status exists in transitions
  if (!STATUS_TRANSITIONS.hasOwnProperty(normalizedStatus)) {
    throw new Error(`Unsupported status: ${normalizedStatus}`);
  }

  // Validate transition is allowed
  if (!allowed.includes(normalizedStatus)) {
    throw new Error(
      `Cannot move task from '${currentStatus}' to '${normalizedStatus}'. Allowed: ${allowed.join(', ') || 'none'}`
    );
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE tasks SET 
       status = $1::text,
       updated_at = NOW(),
       completed_at = CASE WHEN $1::text = 'completed' THEN NOW() ELSE completed_at END,
       closed_at = CASE WHEN $1::text = 'closed' THEN NOW() ELSE closed_at END
       WHERE id = $2 RETURNING *`,
      [normalizedStatus, taskId]
    );

    await client.query(
      `INSERT INTO task_timeline (task_id, action, details, author_id, old_values, new_values)
       VALUES ($1, 'Status Changed', $2, $3, $4, $5)`,
      [
        taskId,
        reason || `Status changed from ${currentStatus} to ${normalizedStatus}`,
        userId,
        JSON.stringify({ status: currentStatus }),
        JSON.stringify({ status: normalizedStatus }),
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── SOFT DELETE TASK ─────────────────────────────────────────────────────────
export const deleteTask = async (taskId, userId) => {
  const existing = await pool.query(
    `SELECT id FROM tasks
     WHERE id = $1 AND deleted_at IS NULL
       AND created_by = $2`,  // only creator can delete
    [taskId, userId]
  );
  if (existing.rows.length === 0) throw new Error('Access denied or task not found');

  await pool.query(
    `UPDATE tasks SET deleted_at = NOW() WHERE id = $1`,
    [taskId]
  );

  return { success: true };
};

// ─── GET MY TASKS ─────────────────────────────────────────────────────────────
export const getMyTasks = async (userId, filters = {}) => {
  return getTasks(
    { ...filters, assigned_to: userId },
    userId
  );
};

// ─── GET DELEGATED BY ME ──────────────────────────────────────────────────────
export const getDelegatedTasks = async (userId, filters = {}) => {
  const conditions = ['t.deleted_at IS NULL', 't.assigned_from_user_id = $1', 't.assigned_to_user_id != $1'];
  const params = [userId];
  let idx = 2;

  // status filter (can be array)
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    conditions.push(`t.status = ANY($${idx})`);
    params.push(statuses);
    idx++;
  }

  // priority
  if (filters.priority) {
    conditions.push(`t.priority = $${idx}`);
    params.push(filters.priority);
    idx++;
  }

  // project or general
  if (filters.project_id === 'general') {
    conditions.push(`t.is_general_task = true`);
  } else if (filters.project_id) {
    conditions.push(`t.project_id = $${idx}`);
    params.push(filters.project_id);
    idx++;
  }

  // task_type
  if (filters.task_type) {
    conditions.push(`t.task_type = $${idx}`);
    params.push(filters.task_type);
    idx++;
  }

  // due date range
  if (filters.due_date_from) {
    conditions.push(`t.due_date >= $${idx}`);
    params.push(filters.due_date_from);
    idx++;
  }
  if (filters.due_date_to) {
    conditions.push(`t.due_date <= $${idx}`);
    params.push(filters.due_date_to);
    idx++;
  }

  // follow_up_date today
  if (filters.follow_up_today) {
    conditions.push(`DATE(t.follow_up_date) = CURRENT_DATE`);
  }

  // overdue
  if (filters.overdue) {
    conditions.push(`t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('completed', 'closed', 'dropped')`);
  }

  // search (title + description)
  if (filters.search) {
    conditions.push(
      `t.search_vector @@ plainto_tsquery($${idx})`
    );
    params.push(filters.search);
    idx++;
  }

  // pagination
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const offset = (page - 1) * limit;

  // sort
  const sortAllowed = ['created_at', 'due_date', 'updated_at', 'priority'];
  const sortBy = sortAllowed.includes(filters.sort_by) ? filters.sort_by : 'created_at';
  const sortDir = filters.sort_dir === 'asc' ? 'ASC' : 'DESC';

  const whereClause = conditions.join(' AND ');

  const sql = `
    SELECT ${TASK_SELECT}
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    JOIN users uf ON uf.id = t.assigned_from_user_id
    JOIN users ut ON ut.id = t.assigned_to_user_id
    WHERE ${whereClause}
    ORDER BY t.${sortBy} ${sortDir}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  params.push(limit, offset);

  // count query
  const countSql = `
    SELECT COUNT(*) FROM tasks t
    WHERE ${whereClause}
  `;
  // count params don't include limit/offset
  const countParams = params.slice(0, -2);

  const [taskResult, countResult] = await Promise.all([
    pool.query(sql, params),
    pool.query(countSql, countParams),
  ]);

  const total = parseInt(countResult.rows[0].count);
  const totalPages = Math.ceil(total / limit);

  return {
    tasks: taskResult.rows,
    total,
    page,
    limit,
    totalPages,
    offset,
  };
};

// ─── GET FOLLOW-UP QUEUE ─────────────────────────────────────────────────────
export const getFollowUpQueue = async (userId) => {
  const result = await pool.query(
    `SELECT ${TASK_SELECT}
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     JOIN users uf ON uf.id = t.assigned_from_user_id
     JOIN users ut ON ut.id = t.assigned_to_user_id
     WHERE t.deleted_at IS NULL
       AND (t.assigned_to_user_id = $1 OR t.assigned_from_user_id = $1)
       AND t.follow_up_date IS NOT NULL
       AND DATE(t.follow_up_date) <= CURRENT_DATE
       AND t.status NOT IN ('completed','closed','dropped')
     ORDER BY t.follow_up_date ASC`,
    [userId]
  );

  return result.rows;
};

// ─── GET REVIEW QUEUE ─────────────────────────────────────────────────────────
export const getReviewQueue = async (userId) => {
  const result = await pool.query(
    `SELECT ${TASK_SELECT}
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     JOIN users uf ON uf.id = t.assigned_from_user_id
     JOIN users ut ON ut.id = t.assigned_to_user_id
     WHERE t.deleted_at IS NULL
       AND t.assigned_from_user_id = $1
       AND t.status = 'ready_for_review'
     ORDER BY t.updated_at DESC`,
    [userId]
  );

  return result.rows;
};

// ─── GET OVERDUE TASKS ────────────────────────────────────────────────────────
export const getOverdueTasks = async (userId) => {
  const result = await pool.query(
    `SELECT ${TASK_SELECT}
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     JOIN users uf ON uf.id = t.assigned_from_user_id
     JOIN users ut ON ut.id = t.assigned_to_user_id
     WHERE t.deleted_at IS NULL
       AND (t.assigned_to_user_id = $1 OR t.assigned_from_user_id = $1)
       AND t.due_date IS NOT NULL
       AND t.due_date < NOW()
       AND t.status NOT IN ('completed', 'closed', 'dropped')
     ORDER BY t.due_date ASC`,
    [userId]
  );

  return result.rows;
};