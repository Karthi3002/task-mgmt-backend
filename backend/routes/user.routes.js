import express from 'express';
import {
  searchUsers,
  quickCreateUser,
} from '../controllers/user.controller.js';

const router = express.Router();

// 🔍 search users
router.get('/search', searchUsers);

// ➕ quick create
router.post('/quick-create', quickCreateUser);

export default router;