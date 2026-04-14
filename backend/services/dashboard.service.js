import { pool } from '../config/db.js';

// ─── USER TASK CONDITION ──────────────────────────────────────────────────────
const USER_TASK_CONDITION = `(assigned_to_user_id = $1 OR assigned_from_user_id = $1 OR created_by = $1) AND deleted_at IS NULL`;

// ─── DASHBOARD SUMMARY ────────────────────────────────────────────────────────
export const getDashboardSummary = async (userId) => {
  // Run all summary queries in parallel for speed
  const [
    myTasksResult,
    delegatedResult,
    followUpResult,
    overallStatsResult,
    recentActivityResult,
    projectStatsResult,
    completedTodayResult,
    totalTasksResult,
    statusBreakdownResult,
  ] = await Promise.all([

    // MY TASKS breakdown
    pool.query(
      `SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('completed','closed','dropped'))   AS total,
          COUNT(*) FILTER (WHERE due_date < NOW()
                             AND status NOT IN ('completed','closed','dropped'))   AS overdue,
          COUNT(*) FILTER (WHERE DATE(due_date) = CURRENT_DATE
                             AND status NOT IN ('completed','closed','dropped'))   AS due_today,
          COUNT(*) FILTER (WHERE status = 'waiting_on_others')                    AS waiting_on_others,
          COUNT(*) FILTER (WHERE status = 'in_progress')                          AS in_progress,
          COUNT(*) FILTER (WHERE status = 'blocked')                              AS blocked
       FROM tasks
       WHERE assigned_to_user_id = $1 AND deleted_at IS NULL`,
      [userId]
    ),

    // DELEGATED BY ME breakdown
    pool.query(
      `SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('completed','closed','dropped'))   AS total,
          COUNT(*) FILTER (WHERE status = 'ready_for_review')                     AS ready_for_review,
          COUNT(*) FILTER (WHERE due_date < NOW()
                             AND status NOT IN ('completed','closed','dropped'))   AS overdue
       FROM tasks
       WHERE assigned_from_user_id = $1
         AND assigned_to_user_id != $1
         AND deleted_at IS NULL`,
      [userId]
    ),

    // FOLLOW-UPS
    pool.query(
      `SELECT
          COUNT(*) FILTER (WHERE follow_up_date IS NOT NULL
                             AND status NOT IN ('completed','closed','dropped'))           AS total,
          COUNT(*) FILTER (WHERE DATE(follow_up_date) = CURRENT_DATE
                             AND status NOT IN ('completed','closed','dropped'))           AS today,
          COUNT(*) FILTER (WHERE follow_up_date < NOW()
                             AND status NOT IN ('completed','closed','dropped'))           AS overdue
       FROM tasks
       WHERE ${USER_TASK_CONDITION}`,
      [userId]
    ),

    // OVERALL STATS by status + priority
    pool.query(
      `SELECT
          status,
          priority,
          COUNT(*) AS count
       FROM tasks
       WHERE ${USER_TASK_CONDITION}
       GROUP BY status, priority`,
      [userId]
    ),

    // RECENT ACTIVITY (last 10 timeline entries across all user tasks)
    pool.query(
      `SELECT
          tl.id, tl.action, tl.details, tl.created_at,
          t.id    AS task_id,
          t.title AS task_title,
          u.name  AS author_name
       FROM task_timeline tl
       JOIN tasks t ON t.id = tl.task_id
       JOIN users u ON u.id = tl.author_id
       WHERE ${USER_TASK_CONDITION.replace('$1', '$1')}
         AND t.deleted_at IS NULL
       ORDER BY tl.created_at DESC
       LIMIT 10`,
      [userId]
    ),

    // TOP 5 TASKS BY PROJECT
    pool.query(
      `SELECT
          p.id AS project_id, p.name AS project_name,
          COUNT(t.id) FILTER (WHERE t.status NOT IN ('completed','closed','dropped')) AS active_tasks,
          COUNT(t.id) AS total_tasks
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
       WHERE p.owner_id = $1
         AND p.is_archived = false
       GROUP BY p.id, p.name
       ORDER BY active_tasks DESC
       LIMIT 5`,
      [userId]
    ),

    // COMPLETED TODAY
    pool.query(
      `SELECT COUNT(*) AS count
       FROM tasks
       WHERE ${USER_TASK_CONDITION}
         AND status = 'completed'
         AND DATE(updated_at) = CURRENT_DATE`,
      [userId]
    ),

    // TOTAL TASKS
    pool.query(
      `SELECT COUNT(*) AS total_tasks
       FROM tasks
       WHERE ${USER_TASK_CONDITION}`,
      [userId]
    ),

    // STATUS BREAKDOWN
    pool.query(
      `SELECT status, COUNT(*) AS count
       FROM tasks
       WHERE ${USER_TASK_CONDITION}
       GROUP BY status`,
      [userId]
    ),

  ]);

  // aggregate overall stats
  const byStatus = {};
  const byPriority = {};
  for (const row of overallStatsResult.rows) {
    byStatus[row.status] = (byStatus[row.status] || 0) + parseInt(row.count);
    byPriority[row.priority] = (byPriority[row.priority] || 0) + parseInt(row.count);
  }

  const my = myTasksResult.rows[0];
  const del = delegatedResult.rows[0];
  const fu = followUpResult.rows[0];

  return {
    my_tasks: {
      total:            parseInt(my.total),
      overdue:          parseInt(my.overdue),
      due_today:        parseInt(my.due_today),
      waiting_on_others:parseInt(my.waiting_on_others),
      in_progress:      parseInt(my.in_progress),
      blocked:          parseInt(my.blocked),
    },
    delegated: {
      total:           parseInt(del.total),
      ready_for_review:parseInt(del.ready_for_review),
      overdue:         parseInt(del.overdue),
    },
    follow_ups: {
      total:   parseInt(fu.total),
      today:   parseInt(fu.today),
      overdue: parseInt(fu.overdue),
    },
    completed_today: parseInt(completedTodayResult.rows[0].count),
    total_tasks: parseInt(totalTasksResult.rows[0].total_tasks),
    status_breakdown: statusBreakdownResult.rows,
    stats: {
      by_status:   byStatus,
      by_priority: byPriority,
    },
    project_summary:  projectStatsResult.rows,
    recent_activity:  recentActivityResult.rows,
  };
};

// ─── TOP TASKS FOR DASHBOARD SECTIONS ────────────────────────────────────────
// Returns top N tasks per section for dashboard cards
export const getDashboardTasks = async (userId) => {
  const TOP = 5;

  const [myTasks, delegated, followUps, overdue, completedToday] = await Promise.all([

    // My open tasks
    pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.follow_up_date,
              p.name AS project_name, t.is_general_task,
              uf.name AS assigned_from_name, ut.name AS assigned_to_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       JOIN users uf ON uf.id = t.assigned_from_user_id
       JOIN users ut ON ut.id = t.assigned_to_user_id
       WHERE t.assigned_to_user_id = $1
         AND t.deleted_at IS NULL
         AND t.status NOT IN ('completed','closed','dropped')
       ORDER BY
         CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                         WHEN 'medium' THEN 3 ELSE 4 END,
         t.due_date ASC NULLS LAST
       LIMIT $2`,
      [userId, TOP]
    ),

    // Delegated by me
    pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date,
              p.name AS project_name, t.is_general_task,
              ut.name AS assigned_to_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       JOIN users ut ON ut.id = t.assigned_to_user_id
       WHERE t.assigned_from_user_id = $1
         AND t.assigned_to_user_id != $1
         AND t.deleted_at IS NULL
         AND t.status NOT IN ('completed','closed','dropped')
       ORDER BY t.due_date ASC NULLS LAST
       LIMIT $2`,
      [userId, TOP]
    ),

    // Follow-ups pending/today
    pool.query(
      `SELECT t.id, t.title, t.status, t.follow_up_date,
              p.name AS project_name, t.is_general_task,
              ut.name AS assigned_to_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       JOIN users ut ON ut.id = t.assigned_to_user_id
       WHERE (t.assigned_to_user_id = $1 OR t.assigned_from_user_id = $1)
         AND t.follow_up_date IS NOT NULL
         AND DATE(t.follow_up_date) <= CURRENT_DATE
         AND t.status NOT IN ('completed','closed','dropped')
         AND t.deleted_at IS NULL
       ORDER BY t.follow_up_date ASC
       LIMIT $2`,
      [userId, TOP]
    ),

    // Overdue
    pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date,
              p.name AS project_name, t.is_general_task
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.assigned_to_user_id = $1
         AND t.due_date < NOW()
         AND t.status NOT IN ('completed','closed','dropped')
         AND t.deleted_at IS NULL
       ORDER BY t.due_date ASC
       LIMIT $2`,
      [userId, TOP]
    ),

    // Completed today
    pool.query(
      `SELECT t.id, t.title, t.updated_at,
              p.name AS project_name, t.is_general_task
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE (t.assigned_to_user_id = $1 OR t.assigned_from_user_id = $1)
         AND t.status = 'completed'
         AND DATE(t.updated_at) = CURRENT_DATE
         AND t.deleted_at IS NULL
       ORDER BY t.updated_at DESC
       LIMIT $2`,
      [userId, TOP]
    ),
  ]);

  return {
    my_tasks:      myTasks.rows,
    delegated:     delegated.rows,
    follow_ups:    followUps.rows,
    overdue:       overdue.rows,
    completed_today: completedToday.rows,
  };
};