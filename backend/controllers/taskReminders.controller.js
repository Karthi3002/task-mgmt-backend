import * as taskRemindersService from '../services/taskReminders.service.js';

// ─── CREATE REMINDER ──────────────────────────────────────────────────────────
export const createReminder = async (req, res) => {
  try {
    const { remind_at, message } = req.body;

    const reminder = await taskRemindersService.createReminder(
      req.params.taskId,
      remind_at,
      message,
      req.user.userId
    );

    res.status(201).json({
      success: true,
      message: 'Reminder created',
      data: reminder
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// ─── UPDATE REMINDER ──────────────────────────────────────────────────────────
export const updateReminder = async (req, res) => {
  try {
    const reminder = await taskRemindersService.updateReminder(
      req.params.reminderId,
      req.body,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'Reminder updated',
      data: reminder
    });
  } catch (err) {
    res.status(403).json({
      success: false,
      message: err.message
    });
  }
};

// ─── DELETE REMINDER ──────────────────────────────────────────────────────────
export const deleteReminder = async (req, res) => {
  try {
    await taskRemindersService.deleteReminder(
      req.params.reminderId,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'Reminder deleted'
    });
  } catch (err) {
    res.status(403).json({
      success: false,
      message: err.message
    });
  }
};

// ─── GET REMINDERS BY TASK ────────────────────────────────────────────────────
export const getRemindersByTask = async (req, res) => {
  try {
    const reminders = await taskRemindersService.getRemindersByTask(
      req.params.taskId,
      req.user.userId
    );

    res.json({
      success: true,
      data: reminders
    });
  } catch (err) {
    res.status(403).json({
      success: false,
      message: err.message
    });
  }
};