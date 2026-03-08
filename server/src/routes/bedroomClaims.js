import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// List claims for a bedroom
router.get('/bedroom/:bedroomId', async (req, res) => {
  const db = await getDb();
  const claims = all(db, `
    SELECT bc.*, u.first_name, u.last_name
    FROM bedroom_claims bc JOIN users u ON bc.user_id = u.user_id
    WHERE bc.bedroom_id = ?
    ORDER BY bc.status DESC, bc.created_at
  `, [req.params.bedroomId]);
  res.json({ success: true, data: claims });
});

// Create claim (any user can request)
router.post('/', async (req, res) => {
  const { bedroom_id, user_id } = req.body;
  const claimUserId = user_id || req.user.user_id;
  const db = await getDb();

  // Check if user already has a claim on this bedroom
  const existing = get(db,
    'SELECT * FROM bedroom_claims WHERE bedroom_id = ? AND user_id = ?',
    [bedroom_id, claimUserId]);
  if (existing) {
    return res.status(409).json({ success: false, error: { message: 'Already claimed' } });
  }

  const result = run(db,
    'INSERT INTO bedroom_claims (bedroom_id, user_id) VALUES (?, ?)',
    [bedroom_id, claimUserId]);
  const claim = get(db, `
    SELECT bc.*, u.first_name, u.last_name
    FROM bedroom_claims bc JOIN users u ON bc.user_id = u.user_id
    WHERE bc.claim_id = ?
  `, [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: claim });
});

// Confirm a claim (admin only)
router.put('/:id/confirm', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, "UPDATE bedroom_claims SET status = 'confirmed' WHERE claim_id = ?", [req.params.id]);
  const claim = get(db, `
    SELECT bc.*, u.first_name, u.last_name
    FROM bedroom_claims bc JOIN users u ON bc.user_id = u.user_id
    WHERE bc.claim_id = ?
  `, [req.params.id]);
  res.json({ success: true, data: claim });
});

// Delete a claim (admin can remove any; non-admin can withdraw own pending)
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const claim = get(db, 'SELECT * FROM bedroom_claims WHERE claim_id = ?', [req.params.id]);
  if (!claim) return res.status(404).json({ success: false, error: { message: 'Not found' } });

  if (req.user.role !== 'admin') {
    if (claim.user_id !== req.user.user_id || claim.status !== 'requested') {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }
  }

  run(db, 'DELETE FROM bedroom_claims WHERE claim_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
