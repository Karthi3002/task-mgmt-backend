import express from 'express';
import { summaryReport } from '../controllers/report.controller.js';

const router = express.Router();

router.get('/summary', summaryReport);

export default router;