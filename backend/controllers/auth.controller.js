import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getCurrentUser,
} from '../services/auth.service.js';

// 🔹 REGISTER
export const register = async (req, res) => {
  try {
    const user = await registerUser(req.body);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// 🔹 LOGIN
// Now returns both access_token + refresh_token
export const login = async (req, res) => {
  try {
    const data = await loginUser(req.body);

    res.json({
      success: true,
      message: 'Login successful',
      data,
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      message: err.message,
    });
  }
};

// 🔹 REFRESH
// Accepts { refresh_token } in body → returns new access_token
export const refresh = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const data = await refreshToken(refresh_token);

    res.json({
      success: true,
      message: 'Token refreshed',
      data,
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      message: err.message,
    });
  }
};

// 🔹 LOGOUT
// Blacklists the current access token.
// Frontend must also delete both tokens from storage.
export const logout = async (req, res) => {
  try {
    // Raw token extracted by authMiddleware and attached to req
    const token = req.headers.authorization?.split(' ')[1];
    await logoutUser(token, req.user.userId);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// 🔹 GET CURRENT USER
export const getMe = async (req, res) => {
  try {
    const user = await getCurrentUser(req.user.userId);

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};