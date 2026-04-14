import express from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
router.post('/register', register);  // POST /auth/register
router.post('/login',    login);     // POST /auth/login
router.post('/refresh',  refresh);   // POST /auth/refresh  ← NEW

// ─── PROTECTED ────────────────────────────────────────────────────────────────
router.get('/me',        authMiddleware, getMe);     // GET  /auth/me
router.post('/logout',   authMiddleware, logout);    // POST /auth/logout  ← NEW

export default router;