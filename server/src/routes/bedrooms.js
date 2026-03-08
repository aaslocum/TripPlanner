import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// List bedrooms for an accommodation
router.get('/accommodation/:accId', async (req, res) => {
  const db = await getDb();
  const bedrooms = all(db, 'SELECT * FROM bedrooms WHERE accommodation_id = ?', [req.params.accId]);
  for (const bedroom of bedrooms) {
    bedroom.beds = all(db, `
      SELECT b.*, u.first_name, u.last_name
      FROM beds b
      LEFT JOIN users u ON b.assigned_user_id = u.user_id
      WHERE b.bedroom_id = ?
    `, [bedroom.bedroom_id]);
  }
  res.json({ success: true, data: bedrooms });
});

// Create bedroom
router.post('/', adminMiddleware, async (req, res) => {
  const { accommodation_id, name, price_share_adjustment } = req.body;
  const db = await getDb();
  const result = run(db,
    'INSERT INTO bedrooms (accommodation_id, name, price_share_adjustment) VALUES (?, ?, ?)',
    [accommodation_id, name, price_share_adjustment || 0]);
  const bedroom = get(db, 'SELECT * FROM bedrooms WHERE bedroom_id = ?', [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: bedroom });
});

// Upsert bedroom by name (used by scraper auto-populate)
router.post('/upsert', adminMiddleware, async (req, res) => {
  const { accommodation_id, name, price_share_adjustment } = req.body;
  const db = await getDb();
  const existing = get(db,
    'SELECT * FROM bedrooms WHERE accommodation_id = ? AND name = ?',
    [accommodation_id, name]);

  let bedroom;
  if (existing) {
    // Update existing — keep price_share_adjustment if not provided
    if (price_share_adjustment !== undefined) {
      run(db, 'UPDATE bedrooms SET price_share_adjustment = ? WHERE bedroom_id = ?',
        [price_share_adjustment, existing.bedroom_id]);
    }
    // Delete existing beds so they get re-created from scrape
    run(db, 'DELETE FROM beds WHERE bedroom_id = ?', [existing.bedroom_id]);
    // Delete existing bedroom images so they get re-created
    run(db, 'DELETE FROM accommodation_images WHERE bedroom_id = ?', [existing.bedroom_id]);
    bedroom = get(db, 'SELECT * FROM bedrooms WHERE bedroom_id = ?', [existing.bedroom_id]);
  } else {
    const result = run(db,
      'INSERT INTO bedrooms (accommodation_id, name, price_share_adjustment) VALUES (?, ?, ?)',
      [accommodation_id, name, price_share_adjustment || 0]);
    bedroom = get(db, 'SELECT * FROM bedrooms WHERE bedroom_id = ?', [result.lastInsertRowid]);
  }
  res.status(200).json({ success: true, data: bedroom });
});

// Update bedroom
router.put('/:id', adminMiddleware, async (req, res) => {
  const { name, price_share_adjustment } = req.body;
  const db = await getDb();
  run(db, 'UPDATE bedrooms SET name = ?, price_share_adjustment = ? WHERE bedroom_id = ?',
    [name, price_share_adjustment, req.params.id]);
  const bedroom = get(db, 'SELECT * FROM bedrooms WHERE bedroom_id = ?', [req.params.id]);
  res.json({ success: true, data: bedroom });
});

// Delete bedroom
router.delete('/:id', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM bedrooms WHERE bedroom_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
