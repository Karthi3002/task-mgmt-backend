import express from 'express';
import { createReminder, updateReminder, deleteReminder, getRemindersByTask } from '../controllers/taskReminders.controller.js';

const router = express.Router({ mergeParams: true });

// Task reminders
router.post('/:taskId/reminders', createReminder);
router.get('/:taskId/reminders', getRemindersByTask);
router.patch('/:taskId/reminders/:reminderId', updateReminder);
router.delete('/:taskId/reminders/:reminderId', deleteReminder);

export default router;