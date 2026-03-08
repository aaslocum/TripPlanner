import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { getDb, get } from '../db/connection.js';

export async function authMiddleware(req, res, next) {
  // Dev bypass mode - auto-authenticate as Alex (admin)
  if (config.authBypass) {
    const db = await getDb();
    const user = get(db, 'SELECT * FROM users WHERE email = ?', ['a.alex.slocum@gmail.com']);
    if (user) {
      req.user = user;
      return next();
    }
    return res.status(500).json({ success: false, error: { message: 'Dev user not found. Run db:seed first.' } });
  }

  // Normal JWT authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: { message: 'No token provided' } });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const db = await getDb();
    const user = get(db, 'SELECT * FROM users WHERE user_id = ?', [payload.sub]);
    if (!user) {
      return res.status(401).json({ success: false, error: { message: 'User not found' } });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, error: { message: 'Invalid token' } });
  }
}

export function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: { message: 'Admin access required' } });
  }
  next();
}

export function selfOnlyMiddleware(req, res, next) {
  if (req.user?.user_id !== parseInt(req.params.id)) {
    return res.status(403).json({ success: false, error: { message: 'You can only access your own data' } });
  }
  next();
}
