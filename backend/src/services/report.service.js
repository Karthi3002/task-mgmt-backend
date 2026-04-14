import { pool } from '../../config/db.js';

const REPORT_STATUSES = [
  'open',
  'yet_to_start',
  'in_progress',
  'waiting_on_others',
  'follow_up_needed',
  'blocked',
  'ready_for_review',
  'completed',
  'dropped',
];

const REPORT_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const REPORT_CATEGORIES = ['bug', 'meeting', 'admin', 'testing', 'documentation', 'other'];
const TERMINAL_STATUSES = ['completed', 'closed', 'dropped'];

const formatDateString = (date) => date.toISOString().slice(0, 10);

const toDateOnlyString = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateString(parsed);
};

const buildCountMap = (rows, key, allowedValues) => {
  const counts = Object.fromEntries(allowedValues.map((value) => [value, 0]));
  rows.forEach((row) => {
    const name = row[key];
    if (name && Object.prototype.hasOwnProperty.call(counts, name)) {
      counts[name] = parseInt(row.count, 10);
    }
  });
  return counts;
};

export const getSummaryReport = async (query, requestUser) => {
  let { start_date, end_date, user_id } = query;

  if (!start_date && !end_date) {
    const today = new Date();
    const end = new Date(today);
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    start_date = formatDateString(start);
    end_date = formatDateString(end);
  }

  if (!start_date || !end_date) {
    const error = new Error('start_date and end_date are required');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const startDate = toDateOnlyString(start_date);
  const endDate = toDateOnlyString(end_date);

  if (!startDate || !endDate) {
    const error = new Error('Invalid date format for start_date or end_date');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (new Date(startDate) > new Date(endDate)) {
    const error = new Error('end_date must be greater than or equal to start_date');
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const effectiveUserId = user_id && requestUser.role === 'admin'
    ? user_id
    : requestUser.userId;

  const whereClauses = ['t.deleted_at IS NULL', 'DATE(t.created_at) BETWEEN $1 AND $2'];
  const params = [startDate, endDate];

  if (effectiveUserId) {
    whereClauses.push('(t.assigned_to_user_id = $3 OR t.assigned_from_user_id = $3)');
    params.push(effectiveUserId);
  }

  const baseWhere = whereClauses.join(' AND ');

  const [createdResult, completedResult, avgResult, statusResult, priorityResult, categoryResult, teamResult, overdueResult, dueTodayResult, dueThisWeekResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS count FROM tasks t WHERE ${baseWhere}`, params),
    pool.query(`SELECT COUNT(*) AS count FROM tasks t WHERE ${baseWhere} AND t.status = 'completed'`, params),
    pool.query(`SELECT AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 86400) AS avg_days FROM tasks t WHERE ${baseWhere} AND t.status = 'completed' AND t.completed_at IS NOT NULL`, params),
    pool.query(`SELECT t.status, COUNT(*) AS count FROM tasks t WHERE ${baseWhere} GROUP BY t.status`, params),
    pool.query(`SELECT t.priority, COUNT(*) AS count FROM tasks t WHERE ${baseWhere} GROUP BY t.priority`, params),
    pool.query(`SELECT t.category, COUNT(*) AS count FROM tasks t WHERE ${baseWhere} GROUP BY t.category`, params),
    pool.query(`
      SELECT
        u.id AS user_id,
        u.name,
        COUNT(t.id) AS assigned_count,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN t.due_date < NOW() AND t.status NOT IN ('completed','closed','dropped') THEN 1 ELSE 0 END) AS overdue_count
      FROM users u
      JOIN tasks t ON t.assigned_to_user_id = u.id
      WHERE ${baseWhere}
      GROUP BY u.id, u.name
      ORDER BY assigned_count DESC
    `, params),
    pool.query(`SELECT COUNT(*) AS count FROM tasks t WHERE ${baseWhere} AND t.due_date < NOW() AND t.status NOT IN ('completed','closed','dropped')`, params),
    pool.query(`SELECT COUNT(*) AS count FROM tasks t WHERE ${baseWhere} AND DATE(t.due_date) = CURRENT_DATE`, params),
    pool.query(`SELECT COUNT(*) AS count FROM tasks t WHERE ${baseWhere} AND t.due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'`, params),
  ]);

  const tasksCreated = parseInt(createdResult.rows[0].count, 10);
  const tasksCompleted = parseInt(completedResult.rows[0].count, 10);
  const averageDays = avgResult.rows[0].avg_days;

  return {
    period: {
      start: startDate,
      end: endDate,
    },
    tasks_created: tasksCreated,
    tasks_completed: tasksCompleted,
    avg_completion_time_days: averageDays === null ? 0 : parseFloat(Number(averageDays).toFixed(2)),
    tasks_by_status: buildCountMap(statusResult.rows, 'status', REPORT_STATUSES),
    tasks_by_priority: buildCountMap(priorityResult.rows, 'priority', REPORT_PRIORITIES),
    tasks_by_category: buildCountMap(categoryResult.rows, 'category', REPORT_CATEGORIES),
    team_workload: teamResult.rows.map((row) => ({
      user_id: row.user_id,
      name: row.name,
      assigned_count: parseInt(row.assigned_count, 10),
      completed_count: parseInt(row.completed_count, 10),
      overdue_count: parseInt(row.overdue_count, 10),
    })),
    productivity_metrics: {
      completion_rate_percent: tasksCreated === 0 ? 0 : parseFloat(((tasksCompleted / tasksCreated) * 100).toFixed(2)),
      overdue_count: parseInt(overdueResult.rows[0].count, 10),
      due_today: parseInt(dueTodayResult.rows[0].count, 10),
      due_this_week: parseInt(dueThisWeekResult.rows[0].count, 10),
    },
  };
};
