import express from 'express';
import {
  listTasks,
  myTasks,
  delegatedTasks,
  followUpQueue,
  reviewQueue,
  overdueTasks,
  getTask,
  getStatus,
  create,
  update,
  updateStatus,
  remove,
} from '../controllers/task.controller.js';
import { add, list, remove as removeNote } from '../controllers/note.controller.js';
import {
  validateCreateTask,
  validateStatusUpdate,
} from '../middlewares/task.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateNote } from '../middlewares/note.middleware.js';
import {
  canAccessTask,
  canDeleteTask,
} from '../middlewares/authorization.middleware.js';
import taskTagsRoutes from './taskTags.routes.js';
import taskRemindersRoutes from './taskReminders.routes.js';
import taskAttachmentsRoutes from './taskAttachments.routes.js';

const router = express.Router();

// 🔐 Apply auth to all routes
router.use(authMiddleware);

// ─── TASK ROUTES ─────────────────────
router.get('/my', myTasks);
router.get('/delegated', delegatedTasks);
router.get('/followups', followUpQueue);
router.get('/review', reviewQueue);
router.get('/overdue', overdueTasks);

router.get('/', listTasks);
router.post('/', validateCreateTask, create);
// 🔐 PROTECTED TASK ACCESS
router.get('/:id', canAccessTask, getTask);
router.get('/:id/status', canAccessTask, getStatus);
router.patch('/:id', canAccessTask, update);
router.put('/:id/status', validateStatusUpdate, canAccessTask, updateStatus);

// 🔐 DELETE → stricter
router.delete('/:id', canDeleteTask, remove);

// ─── NOTES ───────────────────────────
router.get('/:taskId/notes', canAccessTask, list);
router.post('/:taskId/notes', validateNote, canAccessTask, add);
router.delete('/:taskId/notes/:noteId', canAccessTask, removeNote);

// ─── TAGS ───────────────────────────
router.use('/:id/tags', taskTagsRoutes);

// ─── REMINDERS ──────────────────────
router.use('/', taskRemindersRoutes);

// ─── ATTACHMENTS ────────────────────
router.use('/', taskAttachmentsRoutes);

export default router;