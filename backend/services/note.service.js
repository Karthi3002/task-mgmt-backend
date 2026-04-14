import { pool } from '../config/db.js';
import { checkTaskAccess } from './task.service.js';

// ─── ADD NOTE ─────────────────────────────────────────────────────────────────
export const addNote = async (taskId, userId, content) => {
  if (!content?.trim()) throw new Error('Note content is required');

  await checkTaskAccess(taskId, userId);

  // insert note
  const noteResult = await pool.query(
    `INSERT INTO task_notes (task_id, content, author_id)
     VALUES ($1, $2, $3)
     RETURNING id, task_id, content, created_at`,
    [taskId, content.trim(), userId]
  );

  const note = noteResult.rows[0];

  // update task updated_at
  await pool.query(
    `UPDATE tasks SET updated_at = NOW() WHERE id = $1`,
    [taskId]
  );

  // timeline entry
  await pool.query(
    `INSERT INTO task_timeline (task_id, action, details, author_id)
     VALUES ($1, 'Note Added', 'A note was added to this task', $2)`,
    [taskId, userId]
  );

  // get author name
  const authorResult = await pool.query(
    `SELECT id, name, email FROM users WHERE id = $1`,
    [userId]
  );

  return {
    ...note,
    author: authorResult.rows[0],
  };
};

// ─── GET NOTES FOR TASK ───────────────────────────────────────────────────────
export const getNotes = async (taskId, userId) => {
  await checkTaskAccess(taskId, userId);

  const result = await pool.query(
    `SELECT
        n.id, n.content, n.created_at,
        u.id    AS author_id,
        u.name  AS author_name,
        u.email AS author_email
     FROM task_notes n
     JOIN users u ON u.id = n.author_id
     WHERE n.task_id = $1 AND n.deleted_at IS NULL
     ORDER BY n.created_at ASC`,
    [taskId]
  );

  return result.rows;
};

// ─── DELETE NOTE ──────────────────────────────────────────────────────────────
export const deleteNote = async (noteId, userId) => {
  const noteResult = await pool.query(
    `SELECT task_id, author_id FROM task_notes WHERE id = $1 AND deleted_at IS NULL`,
    [noteId]
  );
  if (noteResult.rows.length === 0) throw new Error('Access denied or task not found');

  const { task_id: taskId, author_id: authorId } = noteResult.rows[0];
  await checkTaskAccess(taskId, userId);

  if (authorId !== userId) throw new Error('Access denied or task not found');

  await pool.query(
    `UPDATE task_notes SET deleted_at = NOW() WHERE id = $1`,
    [noteId]
  );

  return { success: true };
};