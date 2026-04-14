import express from 'express';
import { createTag, assignTag, removeTag, getTaskTags, getAllTags } from '../controllers/taskTags.controller.js';

const router = express.Router({ mergeParams: true });

// Tags management
router.post('/tags', createTag);  // Create new tag
router.get('/tags', getAllTags);  // Get all tags

// Task tags
router.post('/', assignTag);  // Assign tag to task
router.get('/', getTaskTags);  // Get tags for task
router.delete('/:tagId', removeTag);  // Remove tag from task

export default router;