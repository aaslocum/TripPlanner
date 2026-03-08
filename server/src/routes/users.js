import { Router } from 'express';
import { authMiddleware, adminMiddleware, selfOnlyMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// List all users (admin only)
router.get('/', adminMiddleware, async (req, res) => {
  const db = await getDb();
  const users = all(db,
    'SELECT user_id, first_name, last_name, email, role, avatar_url, created_at FROM users');
  res.json({ success: true, data: users });
});

// Get user by ID (budget excluded unless self)
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const user = get(db, 'SELECT * FROM users WHERE user_id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });

  const { budget_encrypted, ...safe } = user;
  res.json({ success: true, data: safe });
});

// Create user (admin)
router.post('/', adminMiddleware, async (req, res) => {
  const { first_name, last_name, email, role } = req.body;
  const db = await getDb();
  const result = run(db,
    'INSERT INTO users (first_name, last_name, email, role) VALUES (?, ?, ?, ?)',
    [first_name, last_name, email, role || 'user']);
  const user = get(db, 'SELECT user_id, first_name, last_name, email, role, created_at FROM users WHERE user_id = ?',
    [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: user });
});

// Update user (admin or self)
router.put('/:id', async (req, res) => {
  const isSelf = req.user.user_id === parseInt(req.params.id);
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }

  const { first_name, last_name, email } = req.body;
  const db = await getDb();
  run(db, 'UPDATE users SET first_name = ?, last_name = ?, email = ?, updated_at = datetime("now") WHERE user_id = ?',
    [first_name, last_name, email, req.params.id]);
  const user = get(db, 'SELECT user_id, first_name, last_name, email, role, created_at FROM users WHERE user_id = ?',
    [req.params.id]);
  res.json({ success: true, data: user });
});

// Delete user (admin only)
router.delete('/:id', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM users WHERE user_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

// Budget endpoints will be added in Phase 7

export default router;
