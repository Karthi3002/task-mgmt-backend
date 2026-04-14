import express from 'express';
import { addMember, removeMember, getMembers } from '../controllers/projectMembers.controller.js';

const router = express.Router({ mergeParams: true });

// Assuming projectId is in params from parent route
router.post('/members', addMember);
router.get('/members', getMembers);
router.delete('/members/:userId', removeMember);

export default router;