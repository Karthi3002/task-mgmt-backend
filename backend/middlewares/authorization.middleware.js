import { pool } from '../config/db.js';

// ✅ Check if user is part of task
export const canAccessTask = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const taskId = req.params.id || req.params.taskId;

    const result = await pool.query(
      `SELECT assigned_to_user_id, assigned_from_user_id, created_by
       FROM tasks
       WHERE id = $1 AND deleted_at IS NULL`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    const task = result.rows[0];

    if (
      task.assigned_to_user_id !== userId &&
      task.assigned_from_user_id !== userId &&
      task.created_by !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    next();
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ✅ Only creator can delete
export const canDeleteTask = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const taskId = req.params.id;

    const result = await pool.query(
      `SELECT created_by
       FROM tasks
       WHERE id = $1 AND deleted_at IS NULL`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    if (result.rows[0].created_by !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only creator can delete task',
      });
    }

    next();
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};