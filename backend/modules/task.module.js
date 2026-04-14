import * as taskService from '../services/task.service.js';

// Wrapper layer (future business logic can be added here)

export const listTasksModule = (query, userId) => {
  return taskService.getTasks(query, userId);
};

export const getTaskModule = (taskId, userId) => {
  return taskService.getTaskById(taskId, userId);
};

export const createTaskModule = (data, userId) => {
  return taskService.createTask(data, userId);
};

export const updateTaskModule = (taskId, userId, updates) => {
  return taskService.updateTask(taskId, userId, updates);
};

export const updateStatusModule = (taskId, userId, status, reason) => {
  return taskService.updateTaskStatus(taskId, userId, status, reason);
};

export const deleteTaskModule = (taskId, userId) => {
  return taskService.deleteTask(taskId, userId);
};

// special views
export const myTasksModule = (userId, filters) => {
  return taskService.getMyTasks(userId, filters);
};

export const delegatedTasksModule = (userId, filters) => {
  return taskService.getDelegatedTasks(userId, filters);
};

export const followUpModule = (userId) => {
  return taskService.getFollowUpQueue(userId);
};

export const reviewModule = (userId) => {
  return taskService.getReviewQueue(userId);
};

export const overdueModule = (userId) => {
  return taskService.getOverdueTasks(userId);
};