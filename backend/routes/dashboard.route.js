import express from 'express';
import { summary, taskCards } from '../controllers/dashboard.controller.js';
import { validateDashboardRequest } from '../middlewares/dashboard.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/summary', validateDashboardRequest, summary);
router.get('/tasks', validateDashboardRequest, taskCards);

export default router;