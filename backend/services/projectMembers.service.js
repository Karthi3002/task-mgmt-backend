import { pool } from '../config/db.js';

// ─── ADD USER TO PROJECT ──────────────────────────────────────────────────────
export const addMember = async (projectId, userId, memberUserId, role = 'member') => {
  // check if project exists and user is owner
  const projectCheck = await pool.query(
    `SELECT id FROM projects WHERE id = $1 AND created_by = $2`,
    [projectId, userId]
  );
  if (projectCheck.rows.length === 0) throw new Error('Project not found or access denied');

  // check if user exists
  const userCheck = await pool.query(
    `SELECT id FROM users WHERE id = $1 AND is_active = true`,
    [memberUserId]
  );
  if (userCheck.rows.length === 0) throw new Error('User not found');

  // check if already member
  const existing = await pool.query(
    `SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, memberUserId]
  );
  if (existing.rows.length > 0) throw new Error('User is already a member of this project');

  const result = await pool.query(
    `INSERT INTO project_members (project_id, user_id, role, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [projectId, memberUserId, role]
  );

  return result.rows[0];
};

// ─── REMOVE USER FROM PROJECT ─────────────────────────────────────────────────
export const removeMember = async (projectId, userId, memberUserId) => {
  // Check if userId is owner
  const ownerCheck = await pool.query(
    `SELECT id FROM projects WHERE id = $1 AND created_by = $2`,
    [projectId, userId]
  );
  if (ownerCheck.rows.length === 0) throw new Error('Access denied');

  // Check if memberUserId is owner
  const memberOwnerCheck = await pool.query(
    `SELECT id FROM projects WHERE id = $1 AND created_by = $2`,
    [projectId, memberUserId]
  );
  if (memberOwnerCheck.rows.length > 0) throw new Error('Cannot remove project owner');

  // Check if member exists
  const memberCheck = await pool.query(
    `SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, memberUserId]
  );
  if (memberCheck.rows.length === 0) throw new Error('Member not found');

  await pool.query(
    `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, memberUserId]
  );

  return { success: true };
};

// ─── GET MEMBERS OF PROJECT ───────────────────────────────────────────────────
export const getMembers = async (projectId, userId) => {
  // check if user is member or owner
  const accessCheck = await pool.query(
    `SELECT 1 FROM project_members pm
     WHERE pm.project_id = $1 AND pm.user_id = $2
     UNION
     SELECT 1 FROM projects p WHERE p.id = $1 AND p.created_by = $2`,
    [projectId, userId]
  );
  if (accessCheck.rows.length === 0) throw new Error('Access denied');

  const result = await pool.query(
    `SELECT
        pm.user_id,
        u.name,
        pm.role,
        pm.created_at
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.created_at ASC`,
    [projectId]
  );

  return result.rows;
};