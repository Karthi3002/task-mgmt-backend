import { pool } from '../config/db.js';
import { checkTaskAccess } from './task.service.js';

// ─── CREATE TAG ───────────────────────────────────────────────────────────────
export const createTag = async (name, color) => {
  if (!name || !name.trim()) {
    throw new Error('Tag name is required');
  }

  const trimmedName = name.trim().toLowerCase();

  // check if exists
  const existing = await pool.query(
    `SELECT id, name, color FROM task_tags WHERE LOWER(name) = LOWER($1)`,
    [trimmedName]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0]; // return existing instead of throwing
  }

  const result = await pool.query(
    `INSERT INTO task_tags (name, color)
     VALUES ($1, $2)
     RETURNING id, name, color`,
    [trimmedName, color || '#000000']
  );

  return result.rows[0];
};

// ─── ASSIGN TAG TO TASK ───────────────────────────────────────────────────────
export const assignTag = async (taskId, name, color, userId) => {
  if (!name || !name.trim()) {
    throw new Error('Tag name is required');
  }

  // check access
  await checkTaskAccess(taskId, userId);

  // 1. get or create tag
  const tag = await createTag(name, color);
  const tagId = tag.id;

  // 2. check duplicate mapping
  const existing = await pool.query(
    `SELECT 1 FROM task_tag_map WHERE task_id = $1 AND tag_id = $2`,
    [taskId, tagId]
  );

  if (existing.rows.length > 0) {
    throw new Error('Tag already assigned to this task');
  }

  // 3. insert mapping
  await pool.query(
    `INSERT INTO task_tag_map (task_id, tag_id)
     VALUES ($1, $2)`,
    [taskId, tagId]
  );

  return {
    message: 'Tag assigned successfully',
    tag
  };
};

// ─── REMOVE TAG FROM TASK ─────────────────────────────────────────────────────
export const removeTag = async (taskId, tagId, userId) => {
  await checkTaskAccess(taskId, userId);

  const result = await pool.query(
    `DELETE FROM task_tag_map 
     WHERE task_id = $1 AND tag_id = $2`,
    [taskId, tagId]
  );

  if (result.rowCount === 0) {
    throw new Error('Tag not assigned to this task');
  }

  return { message: 'Tag removed successfully' };
};

// ─── GET TAGS FOR TASK ────────────────────────────────────────────────────────
export const getTaskTags = async (taskId, userId) => {
  await checkTaskAccess(taskId, userId);

  const result = await pool.query(
    `SELECT
        tt.id,
        tt.name,
        tt.color
     FROM task_tag_map ttm
     JOIN task_tags tt ON tt.id = ttm.tag_id
     WHERE ttm.task_id = $1
     ORDER BY tt.name ASC`,
    [taskId]
  );

  return result.rows;
};

// ─── GET ALL TAGS ─────────────────────────────────────────────────────────────
export const getAllTags = async () => {
  const result = await pool.query(
    `SELECT id, name, color FROM task_tags ORDER BY name ASC`
  );

  return result.rows;
};