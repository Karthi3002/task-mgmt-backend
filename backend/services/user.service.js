import { pool } from '../config/db.js';

// 🔍 Search users
export const searchUsers = async (query) => {
  const result = await pool.query(
    `SELECT id, name
     FROM users
     WHERE name ILIKE $1
     ORDER BY name ASC
     LIMIT 10`,
    [`%${query}%`]
  );

  return result.rows;
};

// ➕ Create user (Quick Add)
export const createUser = async (name) => {
  // check if already exists
  const existing = await pool.query(
    `SELECT id, name FROM users WHERE LOWER(name) = LOWER($1)`,
    [name]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0]; // return existing user
  }

  const result = await pool.query(
    `INSERT INTO users (id, name, is_external)
     VALUES (gen_random_uuid(), $1, true)
     RETURNING id, name`,
    [name]
  );

  return result.rows[0];
};