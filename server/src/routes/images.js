import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// List images for an accommodation
router.get('/accommodation/:accId', async (req, res) => {
  const db = await getDb();
  const images = all(db,
    'SELECT * FROM accommodation_images WHERE accommodation_id = ? ORDER BY sort_order',
    [req.params.accId]);
  res.json({ success: true, data: images });
});

// Add image
router.post('/', adminMiddleware, async (req, res) => {
  const { accommodation_id, bedroom_id, image_url, sort_order } = req.body;
  const db = await getDb();
  const result = run(db,
    'INSERT INTO accommodation_images (accommodation_id, bedroom_id, image_url, sort_order) VALUES (?, ?, ?, ?)',
    [accommodation_id, bedroom_id || null, image_url, sort_order || 0]);
  const image = get(db, 'SELECT * FROM accommodation_images WHERE image_id = ?', [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: image });
});

// Delete image
router.delete('/:id', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM accommodation_images WHERE image_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
