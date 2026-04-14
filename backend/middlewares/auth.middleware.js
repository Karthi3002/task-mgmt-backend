import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const authMiddleware = async (req, res, next) => {
  try {
    // ── 1. Extract token ──────────────────────────────────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token missing',
      });
    }

    const token = authHeader.split(' ')[1];

    // ── 2. Verify signature + expiry ─────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // ── 3. Check blacklist (logout invalidation) ──────────────────────────────
    const blacklisted = await pool.query(
      `SELECT id FROM token_blacklist WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (blacklisted.rows.length > 0) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please log in again.',
      });
    }

    // ── 4. Attach user to request ─────────────────────────────────────────────
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
      });
    }

    req.user = decoded;

    next();
  } catch (err) {
    // Catches unexpected errors (e.g., DB down during blacklist check)
    console.error('❌ Auth middleware error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Authentication check failed',
    });
  }
};