import { Router } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { authMiddleware } from '../middleware/auth.js';
import { getDb, get } from '../db/connection.js';

const router = Router();

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const { budget_encrypted, ...user } = req.user;
  res.json({ success: true, data: user });
});

// Dev login (only available in bypass mode)
router.get('/dev-login', async (req, res) => {
  if (!config.authBypass) {
    return res.status(404).json({ success: false, error: { message: 'Not available' } });
  }
  const db = await getDb();
  const user = get(db, 'SELECT * FROM users WHERE email = ?', ['a.alex.slocum@gmail.com']);
  const token = jwt.sign({ sub: user.user_id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '24h' });
  res.json({ success: true, data: { token, user } });
});

// Google OAuth routes will be added in Phase 6

export default router;
