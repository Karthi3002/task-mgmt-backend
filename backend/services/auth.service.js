import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const JWT_SECRET         = process.env.JWT_SECRET         || 'supersecret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'supersecret_refresh';

// ─── TOKEN HELPERS ────────────────────────────────────────────────────────────
const generateAccessToken = (user) =>
  jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }   // short-lived — refresh handles renewal
  );

const generateRefreshToken = (user) =>
  jwt.sign(
    { userId: user.id, email: user.email },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }    // long-lived — stored securely on client
  );

// ─── REGISTER USER ────────────────────────────────────────────────────────────
export const registerUser = async ({ name, email, password }) => {
  const existingUser = await pool.query(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  if (existingUser.rows.length > 0) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name, email, hashedPassword]
  );

  return result.rows[0];
};

// ─── LOGIN USER ───────────────────────────────────────────────────────────────
export const loginUser = async ({ email, password }) => {
  const result = await pool.query(
    `SELECT * FROM users WHERE email = $1 AND is_active = true`,
    [email]
  );

  const user = result.rows[0];
  if (!user) throw new Error('User not found or inactive');

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) throw new Error('Invalid credentials');

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    access_token:  accessToken,
    refresh_token: refreshToken,
    token_type:    'Bearer',
    expires_in:    900,   // 15 minutes in seconds
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  };
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
export const refreshToken = async (token) => {
  if (!token) throw new Error('Refresh token is required');

  // 1. Verify the refresh token signature + expiry
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired refresh token');
  }

  // 2. Make sure the user still exists and is active
  const result = await pool.query(
    `SELECT id, name, email, role FROM users
     WHERE id = $1 AND is_active = true`,
    [decoded.userId]
  );
  const user = result.rows[0];
  if (!user) throw new Error('User not found or inactive');

  // 3. Issue a fresh access token (refresh token stays the same — rolling refresh
  //    would require DB storage; this simpler pattern is fine for most apps)
  const newAccessToken = generateAccessToken(user);

  return {
    access_token: newAccessToken,
    token_type:   'Bearer',
    expires_in:   900,
  };
};

// ─── LOGOUT USER ─────────────────────────────────────────────────────────────
// Blacklists the access token so it cannot be reused even before it expires.
export const logoutUser = async (token, userId) => {
  if (!token) throw new Error('Token is required');

  // Decode to get the exp claim (we don't re-verify — middleware already did)
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000); // exp is Unix seconds

  // Upsert — safe to call multiple times (idempotent)
  await pool.query(
    `INSERT INTO token_blacklist (token, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO NOTHING`,
    [token, userId, expiresAt]
  );

  // Opportunistically clean up tokens that have already expired
  // (fire-and-forget — don't await or let it block the response)
  pool.query(`DELETE FROM token_blacklist WHERE expires_at < NOW()`).catch(() => {});

  return { success: true };
};

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────
export const getCurrentUser = async (userId) => {
  const result = await pool.query(
    `SELECT id, name, email, avatar_url, role
     FROM users
     WHERE id = $1 AND is_active = true`,
    [userId]
  );
  return result.rows[0];
};