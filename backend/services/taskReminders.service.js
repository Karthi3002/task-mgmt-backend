import { pool } from '../config/db.js';
import { checkTaskAccess } from './task.service.js';

// ─── CREATE REMINDER ──────────────────────────────────────────────────────────
export const createReminder = async (taskId, remindAt, message, userId) => {
  await checkTaskAccess(taskId, userId);

  if (!remindAt) throw new Error('Reminder date is required');

  const result = await pool.query(
    `INSERT INTO task_reminders (task_id, remind_at, message)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [taskId, remindAt, message || null]
  );

  return result.rows[0];
};

// ─── UPDATE REMINDER ──────────────────────────────────────────────────────────
export const updateReminder = async (reminderId, updates, userId) => {
  const { remind_at, message } = updates;

  const existing = await pool.query(
    `SELECT task_id FROM task_reminders WHERE id = $1`,
    [reminderId]
  );

  if (existing.rows.length === 0) {
    throw new Error('Reminder not found');
  }

  const taskId = existing.rows[0].task_id;

  await checkTaskAccess(taskId, userId);

  const result = await pool.query(
    `UPDATE task_reminders
     SET remind_at = COALESCE($1, remind_at),
         message = COALESCE($2, message)
     WHERE id = $3
     RETURNING *`,
    [remind_at || null, message || null, reminderId]
  );

  return result.rows[0];
};

// ─── DELETE REMINDER ──────────────────────────────────────────────────────────
export const deleteReminder = async (reminderId, userId) => {
  const existing = await pool.query(
    `SELECT task_id FROM task_reminders WHERE id = $1`,
    [reminderId]
  );

  if (existing.rows.length === 0) {
    throw new Error('Reminder not found');
  }

  const taskId = existing.rows[0].task_id;

  await checkTaskAccess(taskId, userId);

  await pool.query(
    `DELETE FROM task_reminders WHERE id = $1`,
    [reminderId]
  );

  return { success: true };
};

// ─── GET REMINDERS BY TASK ────────────────────────────────────────────────────
export const getRemindersByTask = async (taskId, userId) => {
  await checkTaskAccess(taskId, userId);

  const result = await pool.query(
    `SELECT
        id,
        remind_at,
        message,
        created_at
     FROM task_reminders
     WHERE task_id = $1
     ORDER BY remind_at ASC`,
    [taskId]
  );

  return result.rows;
};