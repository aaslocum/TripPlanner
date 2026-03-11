import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// List eats for a trip
router.get('/trip/:tripId', async (req, res) => {
  const db = await getDb();
  const eats = all(db,
    'SELECT * FROM eats WHERE trip_id = ? ORDER BY start_datetime',
    [req.params.tripId]);
  res.json({ success: true, data: eats });
});

// Get single eat
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const eat = get(db, 'SELECT * FROM eats WHERE eat_id = ?', [req.params.id]);
  if (!eat) return res.status(404).json({ success: false, error: { message: 'Not found' } });
  res.json({ success: true, data: eat });
});

// Create eat — open to all authenticated users; non-admins are tagged as suggested
router.post('/', async (req, res) => {
  const { trip_id, title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost, address, latitude, longitude, rating, source_url } = req.body;
  const is_suggested = req.user.role === 'admin' ? 0 : 1;
  const db = await getDb();
  const result = run(db, `
    INSERT INTO eats (trip_id, title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost, address, latitude, longitude, rating, source_url, is_suggested)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [trip_id, title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost, address || null, latitude || null, longitude || null, rating || null, source_url || null, is_suggested]);
  const eat = get(db, 'SELECT * FROM eats WHERE eat_id = ?', [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: eat });
});

// Update eat
router.put('/:id', adminMiddleware, async (req, res) => {
  const { title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost, address, latitude, longitude, rating, source_url } = req.body;
  const db = await getDb();
  run(db, `
    UPDATE eats SET title = ?, description = ?, image_url = ?, google_place_id = ?,
    start_datetime = ?, end_datetime = ?, estimated_cost = ?, address = ?, latitude = ?, longitude = ?, rating = ?, source_url = ?
    WHERE eat_id = ?
  `, [title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost, address || null, latitude || null, longitude || null, rating || null, source_url || null, req.params.id]);
  const eat = get(db, 'SELECT * FROM eats WHERE eat_id = ?', [req.params.id]);
  res.json({ success: true, data: eat });
});

// Delete eat
router.delete('/:id', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM eats WHERE eat_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
