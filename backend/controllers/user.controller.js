import * as userService from '../services/user.service.js';

// 🔍 GET /api/users/search?q=akash
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.json([]);
    }

    const users = await userService.searchUsers(q);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ➕ POST /api/users/quick-create
export const quickCreateUser = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        message: 'Name is required',
      });
    }

    const user = await userService.createUser(name);

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};