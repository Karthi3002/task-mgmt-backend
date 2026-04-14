import { pool } from '../config/db.js';

// ─── LIST PROJECTS ───────────────────────────────────────────────────────────
export const getProjects = async ({ userId, includeArchived = false }) => {
  const archiveClause = includeArchived ? '' : 'AND p.is_archived = false';

  const result = await pool.query(
    `SELECT
        p.id,
        p.name,
        p.description,
        p.created_by,
        p.is_archived,
        p.created_at,
        p.updated_at,
        p.project_code,
        p.status,
        p.start_date,
        p.end_date,
        u.name   AS owner_name,
        u.email  AS owner_email,

        COUNT(t.id)                                              AS task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'completed')       AS completed_count,
        COUNT(t.id) FILTER (WHERE t.status NOT IN ('completed','closed','dropped')
                              AND t.deleted_at IS NULL)          AS pending_count,
        COUNT(t.id) FILTER (WHERE t.due_date < NOW()
                              AND t.status NOT IN ('completed','closed','dropped')
                              AND t.deleted_at IS NULL)          AS overdue_count
     FROM projects p
     JOIN users u ON u.id = p.created_by
     LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
     WHERE p.created_by = $1
       ${archiveClause}
     GROUP BY p.id, u.name, u.email
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return result.rows;
};

// ─── SINGLE PROJECT ───────────────────────────────────────────────────────────
export const getProjectById = async (projectId, userId) => {
  const result = await pool.query(
    `SELECT
        p.*,
        u.name  AS owner_name,
        u.email AS owner_email,
        COUNT(t.id)                                              AS task_count,
        COUNT(t.id) FILTER (WHERE t.status = 'completed')       AS completed_count,
        COUNT(t.id) FILTER (WHERE t.status NOT IN ('completed','closed','dropped')
                              AND t.deleted_at IS NULL)          AS pending_count,
        COUNT(t.id) FILTER (WHERE t.status = 'in_progress'
                              AND t.deleted_at IS NULL)          AS in_progress_count,
        COUNT(t.id) FILTER (WHERE t.status = 'blocked'
                              AND t.deleted_at IS NULL)          AS blocked_count,
        COUNT(t.id) FILTER (WHERE t.due_date < NOW()
                              AND t.status NOT IN ('completed','closed','dropped')
                              AND t.deleted_at IS NULL)          AS overdue_count
     FROM projects p
     JOIN users u ON u.id = p.created_by
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.id = $1
       AND (p.created_by = $2 OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2))
     GROUP BY p.id, u.name, u.email`,
    [projectId, userId]
  );

  return result.rows[0] || null;
};

// ─── CREATE PROJECT ───────────────────────────────────────────────────────────
export const createProject = async ({ name, description, project_code, status, start_date, end_date, userId }) => {
  const exists = await pool.query(
    `SELECT id FROM projects WHERE name = $1 AND created_by = $2`,
    [name.trim(), userId]
  );

  if (exists.rows.length > 0) {
    throw new Error('A project with this name already exists');
  }

  // Generate project_code
  const countResult = await pool.query(`SELECT COUNT(*) AS count FROM projects`);
  const count = parseInt(countResult.rows[0].count);
  const generatedProjectCode = `PROJ-${String(count + 1).padStart(3, '0')}`;

  const result = await pool.query(
    `INSERT INTO projects (name, description, owner_id, created_by, is_archived, project_code, status, start_date, end_date)
     VALUES ($1, $2, $3, $3, false, $4, $5, $6, $7)
     RETURNING *`,
    [name.trim(), description || null, userId, generatedProjectCode, status || 'active', start_date || null, end_date || null]
  );

  const project = result.rows[0];

  // Insert owner into project_members
  await pool.query(
    `INSERT INTO project_members (project_id, user_id, role, created_at)
     VALUES ($1, $2, 'owner', NOW())`,
    [project.id, userId]
  );

  return project;
};

// ─── UPDATE PROJECT ───────────────────────────────────────────────────────────
export const updateProject = async (projectId, userId, updates) => {
  // Map archive to is_archived
  if (updates.archive !== undefined) {
    updates.is_archived = updates.archive;
  }

  const project = await pool.query(
    `SELECT id FROM projects WHERE id = $1 AND created_by = $2`,
    [projectId, userId]
  );

  if (project.rows.length === 0) {
    throw new Error('Project not found or access denied');
  }

  const result = await pool.query(
    `UPDATE projects
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         project_code = COALESCE($3, project_code),
         status = COALESCE($4, status),
         start_date = COALESCE($5, start_date),
         end_date = COALESCE($6, end_date),
         is_archived = COALESCE($7, is_archived),
         updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [updates.name?.trim() || null, updates.description ?? null, updates.project_code || null, updates.status || null, updates.start_date || null, updates.end_date || null, updates.is_archived, projectId]
  );

  return result.rows[0];
};

// ─── ARCHIVE PROJECT ─────────────────────────────────────────────────────────
export const archiveProject = async (projectId, userId) => {
  const project = await pool.query(
    `SELECT id, is_archived FROM projects WHERE id = $1 AND created_by = $2`,
    [projectId, userId]
  );

  if (project.rows.length === 0) {
    throw new Error('Project not found or access denied');
  }

  const currentArchived = project.rows[0].is_archived;
  const newArchived = !currentArchived;

  const result = await pool.query(
    `UPDATE projects
     SET is_archived = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [newArchived, projectId]
  );

  return result.rows[0];
};

// ─── DELETE PROJECT ───────────────────────────────────────────────────────────
export const deleteProject = async (projectId, userId) => {
  const project = await pool.query(
    `SELECT id FROM projects WHERE id = $1 AND created_by = $2`,
    [projectId, userId]
  );

  if (project.rows.length === 0) {
    throw new Error('Project not found or access denied');
  }

  await pool.query(
    `UPDATE tasks SET deleted_at = NOW() WHERE project_id = $1`,
    [projectId]
  );

  await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);

  return { success: true };
};