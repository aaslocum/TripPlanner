import { Router } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { authMiddleware } from '../middleware/auth.js';
import { getDb, get, saveDb } from '../db/connection.js';

const router = Router();

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const { budget_encrypted, ...user } = req.user;
  res.json({ success: true, data: user });
});

// Check if dev bypass is available (lightweight, no auth)
router.get('/dev-status', (req, res) => {
  res.json({ success: true, data: { devBypass: config.authBypass } });
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

// Google OAuth - redirect to Google
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

// Google OAuth - callback
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      const reason = info?.message || 'auth_failed';
      return res.redirect(`${config.clientUrl}/login?error=${reason}`);
    }
    const token = jwt.sign(
      { sub: user.user_id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    saveDb();
    res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
  })(req, res, next);
});

export default router;
