import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { checkTaskAccess } from './task.service.js';

// ─── UPLOAD ATTACHMENT ────────────────────────────────────────────────────────
export const uploadAttachment = async (taskId, file, userId) => {
  await checkTaskAccess(taskId, userId);

  if (!file) throw new Error('File is required');

  const fileUrl = `/uploads/${file.filename}`;
  const fileName = file.originalname;

  const result = await pool.query(
    `INSERT INTO task_attachments (task_id, file_url, file_name, uploaded_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [taskId, fileUrl, fileName, userId]
  );

  return result.rows[0];
};

// ─── GET ATTACHMENTS ─────────────────────────────────────────────────────────
export const getTaskAttachments = async (taskId, userId) => {
  await checkTaskAccess(taskId, userId);

  const result = await pool.query(
    `SELECT ta.*, u.name AS uploaded_by_name
     FROM task_attachments ta
     JOIN users u ON u.id = ta.uploaded_by
     WHERE ta.task_id = $1
     ORDER BY ta.created_at DESC`,
    [taskId]
  );

  return result.rows;
};

// ─── DELETE ATTACHMENT ───────────────────────────────────────────────────────
export const deleteAttachment = async (attachmentId, userId) => {
  const existing = await pool.query(
    `SELECT file_url, task_id, uploaded_by 
     FROM task_attachments 
     WHERE id = $1`,
    [attachmentId]
  );

  if (existing.rows.length === 0) {
    throw new Error('Access denied or task not found');
  }

  const { file_url, task_id: taskId, uploaded_by: uploadedBy } = existing.rows[0];

  await checkTaskAccess(taskId, userId);

  if (uploadedBy !== userId) {
    throw new Error('Access denied or task not found');
  }

  // delete file from disk
  const filePath = path.join('.', file_url);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await pool.query(
    `DELETE FROM task_attachments WHERE id = $1`,
    [attachmentId]
  );

  return { success: true };
};