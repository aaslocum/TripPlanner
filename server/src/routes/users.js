import { Router } from 'express';
import { authMiddleware, adminMiddleware, selfOnlyMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';
import { encryptBudget, decryptBudget, encrypt, decrypt } from '../services/encryption.js';
import config from '../config/env.js';

const router = Router();
router.use(authMiddleware);

// List all users (admin only)
router.get('/', adminMiddleware, async (req, res) => {
  const db = await getDb();
  const users = all(db,
    `SELECT user_id, first_name, last_name, email, role, avatar_url, created_at,
            pref_activity_style, pref_dietary, pref_budget_tier, pref_mobility, pref_drinks
     FROM users`);
  res.json({ success: true, data: users });
});

// Get user by ID (sensitive fields excluded)
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const user = get(db,
    `SELECT user_id, first_name, last_name, email, role, avatar_url, created_at, updated_at,
            ai_notes, pref_activity_style, pref_dietary, pref_budget_tier, pref_mobility, pref_drinks
     FROM users WHERE user_id = ?`,
    [req.params.id]);
  if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });
  res.json({ success: true, data: user });
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

// Update user (admin or self) — basic fields; preferences admin-only
router.put('/:id', async (req, res) => {
  const isSelf = req.user.user_id === parseInt(req.params.id);
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) {
    return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
  }

  const { first_name, last_name, email,
          pref_activity_style, pref_dietary, pref_budget_tier, pref_mobility, pref_drinks } = req.body;

  // Only admins can update preference fields
  const db = await getDb();
  if (isAdmin) {
    run(db,
      `UPDATE users SET first_name = ?, last_name = ?, email = ?,
        pref_activity_style = ?, pref_dietary = ?, pref_budget_tier = ?,
        pref_mobility = ?, pref_drinks = ?,
        updated_at = datetime("now") WHERE user_id = ?`,
      [first_name, last_name, email,
       pref_activity_style || null, pref_dietary || null, pref_budget_tier || null,
       pref_mobility || null, pref_drinks || null,
       req.params.id]);
  } else {
    run(db,
      'UPDATE users SET first_name = ?, last_name = ?, email = ?, updated_at = datetime("now") WHERE user_id = ?',
      [first_name, last_name, email, req.params.id]);
  }

  const user = get(db,
    `SELECT user_id, first_name, last_name, email, role, created_at,
            pref_activity_style, pref_dietary, pref_budget_tier, pref_mobility, pref_drinks
     FROM users WHERE user_id = ?`,
    [req.params.id]);
  res.json({ success: true, data: user });
});

// Delete user (admin only)
router.delete('/:id', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM users WHERE user_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

// Get own budget (self only)
router.get('/:id/budget', selfOnlyMiddleware, async (req, res) => {
  const db = await getDb();
  const user = get(db, 'SELECT budget_encrypted FROM users WHERE user_id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });

  if (!user.budget_encrypted) {
    return res.json({ success: true, data: { budget: null } });
  }

  const budget = decryptBudget(user.budget_encrypted);
  res.json({ success: true, data: { budget } });
});

// Update own budget (self only)
router.put('/:id/budget', selfOnlyMiddleware, async (req, res) => {
  const { budget } = req.body;
  const db = await getDb();

  if (budget === null || budget === undefined || budget === '') {
    run(db, 'UPDATE users SET budget_encrypted = NULL, updated_at = datetime("now") WHERE user_id = ?',
      [req.params.id]);
  } else {
    const encrypted = encryptBudget(String(budget));
    run(db, 'UPDATE users SET budget_encrypted = ?, updated_at = datetime("now") WHERE user_id = ?',
      [encrypted, req.params.id]);
  }

  res.json({ success: true, data: { budget: budget || null } });
});

// Get user context (admin only — decrypts encrypted_context)
router.get('/:id/context', adminMiddleware, async (req, res) => {
  if (!config.userContextKey) {
    return res.status(500).json({ success: false, error: { message: 'USER_CONTEXT_ENCRYPTION_KEY not configured' } });
  }
  const db = await getDb();
  const user = get(db, 'SELECT encrypted_context FROM users WHERE user_id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });

  if (!user.encrypted_context) {
    return res.json({ success: true, data: { context: null } });
  }

  try {
    const context = decrypt(user.encrypted_context, config.userContextKey);
    res.json({ success: true, data: { context } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to decrypt context' } });
  }
});

// Update user context (admin only — encrypts and stores)
router.put('/:id/context', adminMiddleware, async (req, res) => {
  if (!config.userContextKey) {
    return res.status(500).json({ success: false, error: { message: 'USER_CONTEXT_ENCRYPTION_KEY not configured' } });
  }
  const { context } = req.body;
  const db = await getDb();

  const user = get(db, 'SELECT user_id FROM users WHERE user_id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });

  if (!context || context.trim() === '') {
    run(db, 'UPDATE users SET encrypted_context = NULL, updated_at = datetime("now") WHERE user_id = ?',
      [req.params.id]);
  } else {
    const encrypted = encrypt(context, config.userContextKey);
    run(db, 'UPDATE users SET encrypted_context = ?, updated_at = datetime("now") WHERE user_id = ?',
      [encrypted, req.params.id]);
  }

  res.json({ success: true, data: { context: context || null } });
});

export default router;
