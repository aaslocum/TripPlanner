import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { getDb, get } from '../db/connection.js';

// Verify user belongs to the trip. By default reads tripId from req.body.tripId.
// Pass a function to extract tripId from a different source.
export function tripMemberMiddleware(getTripId) {
  return async (req, res, next) => {
    const tripId = typeof getTripId === 'function' ? getTripId(req) : req.body?.tripId;
    if (!tripId) return res.status(400).json({ success: false, error: { message: 'tripId required' } });
    // Admins bypass membership check
    if (req.user?.role === 'admin') return next();
    const db = await getDb();
    const membership = get(db,
      'SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?',
      [tripId, req.user.user_id]
    );
    if (!membership) {
      return res.status(403).json({ success: false, error: { message: 'Not a member of this trip' } });
    }
    next();
  };
}

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
